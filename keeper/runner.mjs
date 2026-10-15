// Coordinator has no admin/creator/treasury key. Its signer pays network/setup only.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {web3,bs58} from './deps.mjs';import {ids,pk,MIN,assertMigrated,collection,buyBurn,burn,unwrap} from './builders.mjs';import {snapshot,chooseBuyback} from './state.mjs';
const stringify=v=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x,2);
export class Keeper {
 constructor({connection,signer,stateDirectory,inspect=snapshot,feeRecipient=chooseBuyback}){this.c=connection;this.signer=signer;this.dir=stateDirectory;this.inspect=inspect;this.feeRecipient=feeRecipient;this.file=path.join(this.dir,'journal.json');}
 read(){return fs.existsSync(this.file)?JSON.parse(fs.readFileSync(this.file)): {transactions:[]};}
 save(j){fs.mkdirSync(this.dir,{recursive:true,mode:0o700});const tmp=this.file+'.tmp',fd=fs.openSync(tmp,'w',0o600);try{fs.writeFileSync(fd,stringify(j));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,this.file);if(process.platform!=='win32'){const d=fs.openSync(this.dir,'r');try{fs.fsyncSync(d);}finally{fs.closeSync(d);}}}
 async recover(j){const p=j.pending;if(!p)return true;const status=(await this.c.getSignatureStatuses([p.signature],{searchTransactionHistory:true})).value[0];
  if(status?.confirmationStatus==='finalized'){const r=await this.c.getTransaction(p.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});if(!r)return false;j.transactions.push({...p,status:r.meta.err?'failed':'finalized',slot:r.slot,feeLamports:r.meta.fee,computeUnits:r.meta.computeUnitsConsumed,error:r.meta.err,receipt:r});delete j.pending;this.save(j);if(r.meta.err)throw Error('Finalized operation failed; fresh state required next scheduled run');return true;}
  // Never create a replacement signature while a submitted operation is uncertain.
  // Persist/alert even after expiry; absence from a single provider is not proof.
  j.lastWait={at:new Date().toISOString(),signature:p.signature,state:status?.confirmationStatus??'unknown',requiresReview:!status&&await this.c.getBlockHeight('finalized')>p.lastValidBlockHeight};this.save(j);return false;
 }
 async submit(kind,ixs,j){const bh=await this.c.getLatestBlockhash('confirmed'),tx=new web3.Transaction({feePayer:this.signer.publicKey,recentBlockhash:bh.blockhash}).add(web3.ComputeBudgetProgram.setComputeUnitLimit({units:400000}),...ixs);assert.ok(tx.instructions.every(i=>i.programId.equals(web3.ComputeBudgetProgram.programId)||[ids.program,ids.pump,ids.amm].includes(i.programId.toBase58())),'No admin/fee-update/transfer instruction can be sent');tx.sign(this.signer);const wire=tx.serialize();assert.ok(wire.length<=1232);const sim=await this.c.simulateTransaction(web3.VersionedTransaction.deserialize(wire),{sigVerify:true,commitment:'confirmed'});if(sim.value.err)throw Error('Simulation rejected '+kind+' '+JSON.stringify(sim.value.err));
  const signature=bs58.encode(tx.signature);j.pending={kind,signature,at:new Date().toISOString(),blockhash:bh.blockhash,lastValidBlockHeight:bh.lastValidBlockHeight,wireBase64:wire.toString('base64')};this.save(j);
  assert.equal(await this.c.sendRawTransaction(wire,{skipPreflight:false,preflightCommitment:'confirmed',maxRetries:1}),signature);
  for(let n=0;n<10;n++){if(await this.recover(j))return;await new Promise(r=>setTimeout(r,1800));}throw Error('Awaiting finalization; next run reconciles saved signature without re-signing');
 }
 async once(){assert.equal(await this.c.getGenesisHash(),'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');let s=await this.inspect(this.c);assertMigrated(s.sharing);const j=this.read();if(!await this.recover(j))return {outcome:'awaiting-signature-review',pending:j.pending?.signature};
  assert.ok(![ids.treasury,'Ei8d6LZSjbzQ4v9EMBLJSpp2NfVUdckJ39sBXDmNRzSq','FzPw22y8fMnsFYBnXh2p6sfsFzTHYLtLMWybS9d2RS2q'].includes(this.signer.publicKey.toBase58()),'Privileged identities forbidden');
  let sent=0;const run=async(kind,ixs)=>{assert.ok(++sent<=3);assert.ok(await this.c.getBalance(this.signer.publicKey,'finalized')>=500000,'Gas-only keeper needs an external top-up; treasury is never used for gas');await this.submit(kind,ixs,j);s=await this.inspect(this.c);assertMigrated(s.sharing);};
  if(s.wsol>=MIN)await run('unwrap', [unwrap(this.signer.publicKey)]);
  const spendable=()=>s.native>s.rent?s.native-s.rent:0n;
  if(s.fees>0n&&spendable()+s.fees>=MIN)await run('collect',collection(this.signer.publicKey));
  if(spendable()>=MIN)await run('buy-and-full-burn',[buyBurn(this.signer.publicKey,await this.feeRecipient(this.c,s))]);
  else if(s.dusd>0n)await run('standalone-full-burn',[burn(this.signer.publicKey)]);
  j.lastRun={at:new Date().toISOString(),slot:s.slot,transactions:sent,remainingCreatorFees:s.fees.toString(),nativeTreasury:s.native.toString(),dusd:s.dusd.toString()};this.save(j);return {outcome:sent?'completed':'no-eligible-work',...j.lastRun};
 }
}
