import fs from 'node:fs';import path from 'node:path';import test from 'node:test';import assert from 'node:assert/strict';
import {web3,bs58} from '../deps.mjs';import {Keeper} from '../runner.mjs';
import {ids,MIN,pk} from '../builders.mjs';import {routerInstruction} from '../jupiter.mjs';
const root=fs.realpathSync(new URL('../../',import.meta.url));
const build=JSON.parse(fs.readFileSync(root+'/fixtures/jupiter-canonical/pump.json'));
const sharing={version:2,status:'Active',admin_revoked:true,shareholders:[{address:ids.treasury,share_bps:10000}]};
const state={sharing,native:MIN+650240n,rent:650240n,fees:0n,wsol:0n,dusd:0n,slot:1},evidence=[];
test.after(()=>fs.writeFileSync(root+'/research/review-keeper-results.json',JSON.stringify(evidence,null,2)));
for(const mode of ['direct-success','unsigned-rejection','transport-during-simulation','debit-rejected','send-uncertain','wrong-returned-signature','finalized-failed','alternative-rejected','balance-raced-away'])test('real coordinator submission path: '+mode,async()=>{
 const dir=fs.mkdtempSync(path.join(root,'research','keeper-state-'));let simulations=0,sends=0,alternatives=0,signature,reads=0;
 const signer=web3.Keypair.generate();
 const c={
  getBalance:async()=>10_000_000,getLatestBlockhash:async()=>({blockhash:web3.PublicKey.default.toBase58(),lastValidBlockHeight:50}),
  simulateTransaction:async(tx)=>{
   simulations++;assert.ok(tx.signatures.every(s=>s.every(x=>x===0)),'A signed simulation leaked to the provider');
   if(mode==='transport-during-simulation')throw Error('RPC unavailable');
   const rejected=(mode==='unsigned-rejection'||mode==='alternative-rejected'||mode==='balance-raced-away')&&(simulations===1||mode==='alternative-rejected');
   return {value:{err:rejected?{InstructionError:[2,{Custom:6005}]}:null,accounts:[{lamports:mode==='debit-rejected'?1:9_994_600,owner:web3.SystemProgram.programId.toBase58()}]}};
  },
  sendRawTransaction:async(wire)=>{
   sends++;const tx=web3.Transaction.from(wire);assert.ok(tx.verifySignatures());signature=bs58.encode(tx.signature);
   const j=k.read();assert.equal(j.pending.signature,signature);assert.equal(j.pending.wireBase64,wire.toString('base64'));
   if(mode==='send-uncertain')throw Error('Network dropped after possible acceptance');
   if(mode==='wrong-returned-signature')return 'wrong';return signature;
  },
  getSignatureStatuses:async()=>({context:{slot:100},value:[{confirmationStatus:'finalized',err:mode==='finalized-failed'?{InstructionError:[2,'failed']}:null}]}),
  getTransaction:async()=>({slot:100,transaction:{signatures:[signature]},meta:{fee:5400,computeUnitsConsumed:110000,err:mode==='finalized-failed'?{InstructionError:[2,'failed']}:null}}),
 };
 const k=new Keeper({connection:c,signer,stateDirectory:dir,feeRecipient:async()=>pk(build.swapInstruction.accounts[25].pubkey),
  inspect:async()=>{reads++;return mode==='balance-raced-away'||sends>0?{...state,native:state.rent}:state;},
  alternative:async()=>{alternatives++;return [routerInstruction(signer.publicKey,build,MIN)];},
 });
 try{
  if(['direct-success','unsigned-rejection','balance-raced-away','alternative-rejected'].includes(mode))await k.once({initialState:state});else await assert.rejects(k.once({initialState:state}));
  assert.equal(alternatives,['unsigned-rejection','alternative-rejected'].includes(mode)?1:0);
  assert.equal(sends,['direct-success','unsigned-rejection','send-uncertain','wrong-returned-signature','finalized-failed'].includes(mode)?1:0);
  if(mode==='alternative-rejected'){assert.equal(k.read().lastRun.blocked.length,2);}
  const j=k.read();assert.equal(!!j.pending,['send-uncertain','wrong-returned-signature'].includes(mode));
  if(mode==='finalized-failed'){assert.equal(j.transactions.length,1);assert.equal(j.transactions[0].status,'failed');}
  if(mode==='unsigned-rejection'){assert.equal(j.transactions.length,1);assert.equal(j.transactions[0].kind,'jupiter-canonical-buy-and-full-burn');}
  evidence.push({mode,simulations,sends,alternatives,reads,pending:!!j.pending,status:j.transactions[0]?.status??null});
 }finally{
  // Contains only fresh, unfunded simulation signers' signed mock wire. Never
  // remove state belonging to any real keeper or unresolved live signature.
  assert.equal(path.dirname(dir),path.join(root,'research'));assert.ok(path.basename(dir).startsWith('keeper-state-'));fs.rmSync(dir,{recursive:true});
 }
});
