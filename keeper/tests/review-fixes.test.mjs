import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import test from 'node:test';import assert from 'node:assert/strict';
import {web3} from '../deps.mjs';import {ids,MIN,pk} from '../builders.mjs';import {Keeper,SimulationRejected} from '../runner.mjs';import {validateBuild} from '../jupiter.mjs';
const template=JSON.parse(fs.readFileSync(new URL('../../fixtures/jupiter-canonical/pump.json',import.meta.url)));
for(const [name,mutate]of [
 ['valid ignored suffix',d=>Buffer.concat([d,d.subarray(-4)])],
 ['forged partial allocation',d=>{d.writeUInt16LE(5000,36);return Buffer.concat([d,Buffer.from([16,39,0,1])]);}],
 ['forged indexes',d=>{d[38]=1;d[39]=0;return Buffer.concat([d,Buffer.from([16,39,0,1])]);}],
 ['unsupported enum',d=>{d[34]=194;return d;}],
 ['invalid bool',d=>{d[35]=2;return d;}],
 ['missing bool',d=>Buffer.concat([d.subarray(0,35),d.subarray(36)])],
])test('strict route framing rejects '+name,()=>{const b=structuredClone(template);b.swapInstruction.data=mutate(Buffer.from(b.swapInstruction.data,'base64')).toString('base64');assert.throws(()=>validateBuild(b,MIN));});
const sharing={version:2,status:'Active',admin_revoked:true,shareholders:[{address:ids.treasury,share_bps:10000}]};
const initial={sharing,native:MIN+650240n,rent:650240n,fees:0n,wsol:0n,dusd:123n,slot:1};
for(const mode of ['swaps-reject','collection-reject','unwrap-reject','API-build-fails','RPC-submit-uncertain','pending-wire','finalized-failed','shutdown','fresh-donation-disappears','direct-reject-alternative-succeeds','standalone-rejects'])test('independent donation scheduling '+mode,async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dusd-review-fix-'));let s={...initial},calls=[],builds=0;
 if(mode==='collection-reject')s={...s,native:s.rent,fees:MIN};
 if(mode==='unwrap-reject')s={...s,native:s.rent,wsol:MIN};
 const k=new Keeper({connection:{getBalance:async()=>10_000_000},signer:web3.Keypair.generate(),stateDirectory:dir,
  inspect:async()=>({...s}),feeRecipient:async()=>pk(template.swapInstruction.accounts[25].pubkey),
  alternative:async()=>{builds++;if(mode==='API-build-fails')throw Error('Build endpoint unavailable');return [];},
 });
 k.submit=async(kind,_ixs,j)=>{
  calls.push(kind);
  if(mode==='RPC-submit-uncertain')throw Error('Transport failed; no safe replacement');
  if(mode==='pending-wire'){j.pending={signature:'unknown-test-wire'};k.save(j);throw new SimulationRejected('Artificial rejection after pending persisted');}
  if(mode==='finalized-failed')throw Error('Finalized operation failed');
  if(mode==='shutdown'){k.checkAbort=()=>{throw Error('Shutdown requested');};throw new SimulationRejected('Swap rejected');}
  if(kind==='standalone-full-burn'){
   if(mode==='standalone-rejects')throw new SimulationRejected('Standalone rejected');
   s={...s,dusd:0n};return;
  }
  if(mode==='direct-reject-alternative-succeeds'&&kind==='jupiter-canonical-buy-and-full-burn'){s={...s,native:s.rent,dusd:0n};return;}
  if(mode==='fresh-donation-disappears')s={...s,dusd:0n,native:s.rent};
  throw new SimulationRejected('Unsigned upstream rejection');
 };
 try{
  if(['RPC-submit-uncertain','pending-wire','finalized-failed','shutdown'].includes(mode)){
   await assert.rejects(k.once({initialState:s}));assert.equal(calls.length,1);assert.equal(builds,0);assert.ok(!calls.includes('standalone-full-burn'));return;
  }
  const result=await k.once({initialState:s});
  assert.ok(result.transactions<=3);assert.equal(result.healthy,['fresh-donation-disappears','direct-reject-alternative-succeeds'].includes(mode));
  if(mode==='direct-reject-alternative-succeeds'){assert.equal(result.blocked.length,0);assert.equal(result.rejections.length,1);assert.equal(calls.includes('standalone-full-burn'),false);}
  else if(mode==='fresh-donation-disappears'){assert.deepEqual(calls,['buy-and-full-burn']);assert.equal(result.transactions,0);}
  else {assert.equal(calls.at(-1),'standalone-full-burn');assert.ok(result.blocked.length>0);if(mode!=='standalone-rejects'){assert.equal(result.dusd,'0');assert.equal(result.transactions,1);assert.equal(result.outcome,'partial-completion');}else assert.equal(result.outcome,'blocked');}
  assert.equal(k.read().pending,undefined);
 }finally{assert.ok(path.basename(dir).startsWith('dusd-review-fix-'));fs.rmSync(dir,{recursive:true});}
});
test('three successful sends remain a hard cycle limit even when a new donation arrives',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dusd-review-fix-'));let s={...initial,wsol:MIN,fees:MIN},kinds=[];
 const k=new Keeper({connection:{getBalance:async()=>10_000_000},signer:web3.Keypair.generate(),stateDirectory:dir,inspect:async()=>s,feeRecipient:async()=>pk(template.swapInstruction.accounts[25].pubkey)});
 k.submit=async kind=>{kinds.push(kind);if(kind==='unwrap')s={...s,wsol:0n,native:s.native+MIN};else if(kind==='collect')s={...s,fees:0n,native:s.native+MIN};else s={...s,native:s.rent,dusd:1n};};
 try{const r=await k.once({initialState:s});assert.equal(r.transactions,3);assert.deepEqual(kinds,['unwrap','collect','buy-and-full-burn']);assert.equal(r.dusd,'1');}
 finally{assert.ok(path.basename(dir).startsWith('dusd-review-fix-'));fs.rmSync(dir,{recursive:true});}
});
