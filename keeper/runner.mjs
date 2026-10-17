// Public gas-paying coordinator. Never holds treasury/admin keys.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as pause} from 'node:timers/promises';
import {web3,bs58} from './deps.mjs';
import {ids,MIN,assertMigrated,collection,buyBurn,burn,unwrap} from './builders.mjs';
import {snapshot,chooseBuyback} from './state.mjs';
import {canonicalAlternative} from './jupiter.mjs';
export class SimulationRejected extends Error {}
const MAINNET='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const stringify=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2);

export class Keeper {
  constructor({connection, recoveryConnection, signer, stateDirectory, inspect=snapshot, feeRecipient=chooseBuyback, alternative=canonicalAlternative, signal, priorityMicroLamports=1000, maxDebitLamports=5000000}) {
    Object.assign(this,{c:connection,recoveryConnection,signer,dir:stateDirectory,inspect,feeRecipient,signal,priorityMicroLamports,maxDebitLamports});
    this.alternative=alternative;
    assert.ok(Number.isSafeInteger(priorityMicroLamports)&&priorityMicroLamports>=0&&priorityMicroLamports<=25000,'Priority price must be 0..25000 micro-lamports/CU');
    assert.ok(Number.isSafeInteger(maxDebitLamports)&&maxDebitLamports>=5000,'Invalid maximum caller debit');
    this.file=path.join(this.dir,'journal.json');
  }
  checkAbort(){this.signal?.throwIfAborted();}
  read(){return fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file,'utf8')):{transactions:[]};}
  save(j){
    fs.mkdirSync(this.dir,{recursive:true,mode:0o700});const tmp=this.file+'.tmp',fd=fs.openSync(tmp,'w',0o600);
    try{fs.writeFileSync(fd,stringify(j));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(tmp,this.file);
    if(process.platform!=='win32'){const d=fs.openSync(this.dir,'r');try{fs.fsyncSync(d);}finally{fs.closeSync(d);}}
  }
  async finalized(j,c,status){
    if(status?.confirmationStatus!=='finalized')return false;
    const p=j.pending,r=await c.getTransaction(p.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
    if(!r)return false;
    assert.ok(r.meta && r.transaction?.signatures?.[0]===p.signature,'Finalized receipt does not match pending transaction');
    assert.ok(!r.meta.err||status.err,'Inconsistent finalized status/receipt');
    assert.ok(!!r.meta.err===!!status.err,'Inconsistent finalized status/receipt');
    j.transactions.push({...p,status:r.meta.err?'failed':'finalized',slot:r.slot,feeLamports:r.meta.fee,computeUnits:r.meta.computeUnitsConsumed,error:r.meta.err,receipt:r});
    delete j.pending;delete j.lastWait;this.save(j);
    if(r.meta.err)throw Error('Finalized operation failed; fresh state required next scheduled run');
    return true;
  }
  async expiredObservation(c,p){
    this.checkAbort();assert.equal(await c.getGenesisHash(),MAINNET,'Recovery RPC is not mainnet');
    // Height first, then a rooted slot and status/history reads. Expiry alone
    // does not establish that the transaction never executed earlier.
    const height=await c.getBlockHeight('finalized');
    if(height<=p.lastValidBlockHeight)return {state:'not-expired',height};
    const slot=await c.getSlot('finalized');
    const response=await c.getSignatureStatuses([p.signature],{searchTransactionHistory:true});
    if(response.context.slot<slot)return {state:'lagging',height,slot,statusSlot:response.context.slot};
    const status=response.value[0];
    if(status)return {state:'found',height,slot,status};
    const receipt=await c.getTransaction(p.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
    if(receipt)return {state:'receipt-without-status',height,slot};
    return {state:'expired-absent',height,slot};
  }
  async recover(j){
    this.checkAbort();const p=j.pending;if(!p)return true;
    const status=(await this.c.getSignatureStatuses([p.signature],{searchTransactionHistory:true})).value[0];
    if(await this.finalized(j,this.c,status))return true;
    let reason='Awaiting finalized receipt',evidence=[];
    if(!status && await this.c.getBlockHeight('finalized')>p.lastValidBlockHeight){
      reason='Expired signature requires consistent historical RPC evidence';
      if(this.recoveryConnection){
        // Two configured providers are an explicit RPC trust assumption, not
        // a cryptographic proof of absence. Errors/disagreement never retire it.
        const first=await this.expiredObservation(this.c,p);
        const second=await this.expiredObservation(this.recoveryConnection,p);
        evidence=[first,second];
        if(first.state==='expired-absent'&&second.state==='expired-absent'){
          j.transactions.push({...p,status:'expired-unobserved',resolution:{at:new Date().toISOString(),evidence,trust:'Two configured RPC providers; not a successful burn'}});
          delete j.pending;delete j.lastWait;this.save(j);return true;
        }
        if(first.state==='found'&&second.state==='found'&&first.status.confirmationStatus==='finalized'&&second.status.confirmationStatus==='finalized'){
          if(await this.finalized(j,this.c,first.status))return true;
        }
      }else reason='Configure a distinct recovery RPC to reconcile this expired signature';
    }
    j.lastWait={at:new Date().toISOString(),signature:p.signature,state:status?.confirmationStatus??'unknown',requiresReview:true,reason,evidence};
    this.save(j);return false;
  }
  async submit(kind,ixs,j){
    this.checkAbort();const bh=await this.c.getLatestBlockhash('confirmed');
    const tx=new web3.Transaction({feePayer:this.signer.publicKey,recentBlockhash:bh.blockhash}).add(
      web3.ComputeBudgetProgram.setComputeUnitLimit({units:400000}),
      web3.ComputeBudgetProgram.setComputeUnitPrice({microLamports:this.priorityMicroLamports}),...ixs);
    assert.ok(tx.instructions.every(i=>i.programId.equals(web3.ComputeBudgetProgram.programId)||[ids.program,ids.pump,ids.amm].includes(i.programId.toBase58())),'Unexpected instruction program');
    const unsigned=tx.serialize({requireAllSignatures:false,verifySignatures:false});assert.ok(unsigned.length<=1232,'Transaction too large');
    const before=await this.c.getBalance(this.signer.publicKey,'confirmed');
    const sim=await this.c.simulateTransaction(web3.VersionedTransaction.deserialize(unsigned),{
      sigVerify:false,commitment:'confirmed',accounts:{encoding:'base64',addresses:[this.signer.publicKey.toBase58()]}});
    this.checkAbort();if(sim.value.err)throw new SimulationRejected('Simulation rejected '+kind+' '+JSON.stringify(sim.value.err));
    const after=sim.value.accounts?.[0];
    assert.ok(after&&Number.isSafeInteger(before)&&Number.isSafeInteger(after.lamports),'Simulation missing caller balance');
    assert.ok(after.owner===web3.SystemProgram.programId.toBase58(),'Simulation changes gas-wallet ownership');
    const debit=BigInt(before)-BigInt(after.lamports);
    assert.ok(debit<=BigInt(this.maxDebitLamports),'Simulated caller debit exceeds approved budget');
    // Nothing usable for broadcast has left the host yet. Sign only after
    // simulation, then fsync before the FIRST network exposure of signed wire.
    this.checkAbort();tx.sign(this.signer);const wire=tx.serialize();
    const signature=bs58.encode(tx.signature);
    j.pending={kind,signature,at:new Date().toISOString(),blockhash:bh.blockhash,lastValidBlockHeight:bh.lastValidBlockHeight,wireBase64:wire.toString('base64'),simulatedCallerDebitLamports:debit.toString()};
    this.save(j);this.checkAbort();
    assert.equal(await this.c.sendRawTransaction(wire,{skipPreflight:false,preflightCommitment:'confirmed',maxRetries:3}),signature);
    for(let n=0;n<10;n++){if(await this.recover(j))return;await pause(1800,undefined,{signal:this.signal});}
    throw Error('Awaiting finalization; pending signature preserved for next scheduled run');
  }
  async once({initialState}={}){
    this.checkAbort();let s=initialState;
    if(!s){assert.equal(await this.c.getGenesisHash(),MAINNET);s=await this.inspect(this.c);}
    assertMigrated(s.sharing);const j=this.read(),hadPending=!!j.pending;
    if(!await this.recover(j))return {outcome:'awaiting-signature-review',healthy:false,pending:j.pending?.signature,reason:j.lastWait?.reason};
    if(hadPending){s=await this.inspect(this.c);assertMigrated(s.sharing);}
    assert.ok(![ids.treasury,'Ei8d6LZSjbzQ4v9EMBLJSpp2NfVUdckJ39sBXDmNRzSq','FzPw22y8fMnsFYBnXh2p6sfsFzTHYLtLMWybS9d2RS2q'].includes(this.signer.publicKey.toBase58()),'Privileged identities forbidden');
    let sent=0;const rejections=[];const run=async(kind,ixs)=>{
      this.checkAbort();assert.ok(++sent<=3);assert.ok(await this.c.getBalance(this.signer.publicKey,'finalized')>=500000,'Gas-only keeper needs an external top-up; treasury is never used for gas');
      await this.submit(kind,ixs,j);s=await this.inspect(this.c);assertMigrated(s.sharing);
    };
    // Only this explicit pre-signing rejection can be isolated. Transport
    // errors, signed wire and finalized failures still stop the entire cycle.
    const attempt=async(kind,ixs)=>{
      try{await run(kind,ixs);return true;}
      catch(e){
        if(!(e instanceof SimulationRejected)||j.pending||this.read().pending)throw e;
        sent--;s=await this.inspect(this.c);assertMigrated(s.sharing);this.checkAbort();
        rejections.push({kind,reason:e.message.replace(/https?:\/\/\S+/g,'[URL REDACTED]').slice(0,300)});
        return false;
      }
    };
    if(s.wsol>=MIN)await attempt('unwrap',[unwrap(this.signer.publicKey)]);
    const spendable=()=>s.native>s.rent?s.native-s.rent:0n;
    if(s.fees>0n&&spendable()+s.fees>=MIN)await attempt('collect',collection(this.signer.publicKey));
    if(spendable()>=MIN){
      const bought=await attempt('buy-and-full-burn',[buyBurn(this.signer.publicKey,await this.feeRecipient(this.c,s))]);
      if(!bought&&spendable()>=MIN){
        let alternative;
        // This builder receives only a public payer address, never a signer.
        // An API/layout error cannot create signed wire. It must not block an
        // independent donation burn, unlike uncertainty inside submit().
        try{alternative=await this.alternative(this.c,s,this.signer.publicKey,{signal:this.signal});}
        catch(e){
          this.checkAbort();if(j.pending||this.read().pending)throw e;
          s=await this.inspect(this.c);assertMigrated(s.sharing);
          rejections.push({kind:'jupiter-build',reason:String(e.message).replace(/https?:\/\/\S+/g,'[URL REDACTED]').slice(0,300)});
        }
        if(alternative)await attempt('jupiter-canonical-buy-and-full-burn',alternative);
      }
    }
    // Independent phase: eligible SOL or a rejected collection/swap must not
    // suppress burning existing donations. Never exceed three signed sends.
    if(s.dusd>0n&&sent<3)await attempt('standalone-full-burn',[burn(this.signer.publicKey)]);
    // Successful alternative execution resolves the direct rejection; report
    // unhealthy only when rejected phases still have eligible work left.
    const blocked=rejections.filter(({kind})=>kind==='unwrap'?s.wsol>=MIN:
      kind==='collect'?s.fees>0n&&spendable()+s.fees>=MIN:
      kind==='standalone-full-burn'?s.dusd>0n:spendable()>=MIN);
    delete j.lastWait;j.lastRun={at:new Date().toISOString(),slot:s.slot,transactions:sent,remainingCreatorFees:s.fees.toString(),nativeTreasury:s.native.toString(),dusd:s.dusd.toString(),blocked,rejections};
    this.save(j);return {outcome:blocked.length?(sent?'partial-completion':'blocked'):sent?'completed':'no-eligible-work',healthy:blocked.length===0,...j.lastRun};
  }
}
