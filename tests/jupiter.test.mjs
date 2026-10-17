import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {web3,token} from '../tools/deps.mjs';
import {treasury,baseMint,baseAta,quoteAta,jupiterBuyBurnInstruction,burnDusdInstruction,buyBurnInstruction,pool,accumulator} from '../tools/client.mjs';
import {callerFundedPreparation} from '../keeper/jupiter.mjs';
import {feeInstructions,finalizeTestShares} from '../tools/claims.mjs';
process.env.REVIEW_JUPITER_FIXTURES='1';
const {AuditVM,ROOT,floor,bytes,amount,cleanSandbox,key}=await import('../tools/audit-vm.mjs');
const build=JSON.parse(fs.readFileSync(ROOT+'/fixtures/jupiter-canonical/pump.json'));
const results={at:new Date().toISOString(),scope:'local copied Jupiter and Pump binaries only',receipts:[]};
function edit(f){
 for(const[name,v]of Object.entries(f)){
  if(v.pubkey===treasury.toBase58())v.account.lamports=Number(floor);
  if([baseAta.toBase58(),quoteAta.toBase58()].includes(v.pubkey)){const b=bytes(v.account);b.writeBigUInt64LE(0n,64);v.account.data[0]=b.toString('base64');if(v.pubkey===quoteAta.toBase58())v.account.lamports=Number(b.readBigUInt64LE(113));}
 }
}
async function fork(fn,extra=()=>{}){const vm=await AuditVM.start((f,caller)=>{edit(f);extra(f,caller);});try{return await fn(vm);}finally{vm.close();}}
async function state(vm){const[t,m,b,q]=await vm.accounts([treasury,baseMint,baseAta,quoteAta]);return {native:BigInt(t?.lamports??0),supply:bytes(m).readBigUInt64LE(36),dusd:b?amount(b):0n,wsol:q?amount(q):0n};}
function record(name,r){results.receipts.push({name,...r});return r;}
async function rejected(vm,name,ix,options){const before=await vm.snapshot(),r=record(name,await vm.send([ix],vm.caller,options));assert.notEqual(r.error,null);assert.deepEqual(await vm.snapshot(),before);return r;}
function changedBytes(fn){const b=structuredClone(build),raw=Buffer.from(b.swapInstruction.data,'base64');fn(raw);b.swapInstruction.data=raw.toString('base64');return b;}
function changedAccount(index,key){const b=structuredClone(build);b.swapInstruction.accounts[index].pubkey=key.toBase58();return b;}
async function purchase(vm,label,b=build,caller=vm.caller){const before=await state(vm),r=record(label,await vm.send([jupiterBuyBurnInstruction(caller.publicKey,b)],caller));assert.equal(r.error,null,JSON.stringify(r));const after=await state(vm);assert.equal(after.native,floor);assert.equal(after.dusd,0n);assert.ok(after.wsol>=before.wsol);assert.ok(before.supply>after.supply);return {r,before,after};}
test('canonical-only Jupiter CPI integration',async t=>{
 t.after(()=>{fs.writeFileSync(ROOT+'/research/jupiter-results.json',JSON.stringify(results,(_,v)=>typeof v==='bigint'?v.toString():v,2));cleanSandbox();});
 await t.test('actual router buys with PDA principal and burns full output',()=>fork(async vm=>{
  await vm.fund(10_000_000n);const before=await state(vm);
  const r=record('canonical router purchase',await vm.send([jupiterBuyBurnInstruction(vm.caller.publicKey,build)]));
  assert.equal(r.error,null,JSON.stringify(r,null,2));
  const after=await state(vm);assert.equal(after.native,floor);assert.equal(after.dusd,0n);assert.equal(after.wsol,0n);assert.ok(before.supply>after.supply);
 }));
 await t.test('full pre-existing donation and output burn',()=>fork(async vm=>{
  await vm.fund(10_000_000n);const {before,after}=await purchase(vm,'purchase plus donation');
  assert.equal(before.dusd,987654n);assert.ok(before.supply-after.supply>987654n);
 },f=>{for(const v of Object.values(f))if(v.pubkey===baseAta.toBase58()){const b=bytes(v.account);b.writeBigUInt64LE(987654n,64);v.account.data[0]=b.toString('base64');}}));
 await t.test('five consecutive purchases by unrelated wallets',()=>fork(async vm=>{
  const ids=new Set();for(let i=0;i<5;i++){const k=web3.Keypair.generate();ids.add(k.publicKey.toBase58());assert.equal((await vm.ask('airdrop',{address:k.publicKey.toBase58(),lamports:100_000_000})).error,null);await vm.fund(10_000_000n);await purchase(vm,'unrelated Jupiter caller '+i,build,k);}assert.equal(ids.size,5);
 }));
 await t.test('three full fee-generation, collection, native distribution and Jupiter burn cycles',()=>fork(async vm=>{
  const finalization=record('LOCAL-ONLY fee-sharing setup',await vm.send(finalizeTestShares(vm.caller.publicKey,key('rewardWallet'))));assert.equal(finalization.error,null,JSON.stringify(finalization));
  for(let i=0;i<3;i++){
   const trade=await vm.direct(10_000_000_000n);assert.equal(trade.error,null);
   const collector=web3.Keypair.generate();assert.equal((await vm.ask('airdrop',{address:collector.publicKey.toBase58(),lamports:100_000_000})).error,null);
   const f=feeInstructions(collector.publicKey),before=await state(vm);
   const collected=record('Jupiter lifecycle fee collection '+i,await vm.send([f.curveSweep,f.poolSweep,f.transfer,f.distribute],collector));assert.equal(collected.error,null,JSON.stringify(collected));
   const funded=await state(vm);assert.ok(funded.native>before.native);const input=funded.native-floor;assert.ok(input>=10_000_000n);
   await purchase(vm,'complete fee-to-Jupiter-burn cycle '+i,changedBytes(d=>d.writeBigUInt64LE(input,8)),collector);
  }
 },(f,caller)=>{const v=Object.values(f).find(v=>v.pubkey===key('sharingConfig').toBase58());const b=bytes(v.account);caller.toBuffer().copy(b,43);v.account.data[0]=b.toString('base64');}));
 await t.test('standalone real donation burn after Jupiter with no spendable SOL',()=>fork(async vm=>{
  await vm.fund(10_000_000n);await purchase(vm,'before standalone');
  const bought=await vm.direct(100_000_000n);assert.equal(bought.error,null,JSON.stringify(bought,(_,v)=>typeof v==='bigint'?v.toString():v));
  const donor=token.getAssociatedTokenAddressSync(baseMint,vm.caller.publicKey);
  assert.equal((await vm.send([token.createTransferCheckedInstruction(donor,baseMint,baseAta,vm.caller.publicKey,7n,6)])).error,null);
  const before=await state(vm),r=record('standalone donated seven raw',await vm.send([burnDusdInstruction(vm.caller.publicKey)]));assert.equal(r.error,null);const after=await state(vm);assert.equal(after.native,floor);assert.equal(before.supply-after.supply,7n);assert.equal(after.dusd,0n);
 }));
 for(const n of [0n,9_999_999n])await t.test('threshold rejects '+n,()=>fork(async vm=>{await vm.fund(n);await rejected(vm,'threshold '+n,jupiterBuyBurnInstruction(vm.caller.publicKey,build));}));
 for(const n of [10_000_001n,1_000_000_000n,1_000_000_000_000n])await t.test('exact current input '+n,()=>fork(async vm=>{await vm.fund(n);await purchase(vm,'input '+n,changedBytes(b=>b.writeBigUInt64LE(n,8)));}));
 for(const[name,fn]of [
  ['wrong discriminator',b=>b[0]^=1],['stale input',b=>b.writeBigUInt64LE(9_999_999n,8)],
  ['platform fee',b=>b.writeUInt16LE(1,26)],['surplus fee',b=>b.writeUInt16LE(1,28)],
  ['multiple hops',b=>b.writeUInt32LE(2,30)],['partial allocation',b=>b.writeUInt16LE(9999,b.length-4)],
  ['wrong source index',b=>b[b.length-2]=1],['wrong destination index',b=>b[b.length-1]=0],
  ['unsupported adapter',b=>b[34]=255]
 ])await t.test('reject '+name,()=>fork(async vm=>{await vm.fund(10_000_000n);await rejected(vm,name,jupiterBuyBurnInstruction(vm.caller.publicKey,changedBytes(fn)));}));
 for(const[index,name]of [[0,'trader'],[1,'source'],[2,'destination'],[3,'input mint'],[4,'output mint'],[8,'event authority'],[10,'external program'],[11,'pool'],[18,'base vault'],[19,'quote vault'],[25,'fee recipient']])await t.test('reject substituted '+name,()=>fork(async vm=>{await vm.fund(10_000_000n);await rejected(vm,name,jupiterBuyBurnInstruction(vm.caller.publicKey,changedAccount(index,web3.Keypair.generate().publicKey)));}));
 await t.test('reject using caller as route recipient',()=>fork(async vm=>{await vm.fund(10_000_000n);await rejected(vm,'caller recipient',jupiterBuyBurnInstruction(vm.caller.publicKey,changedAccount(25,vm.caller.publicKey)));}));
 await t.test('outdated quote does not impose a price cap',()=>fork(async vm=>{await vm.fund(10_000_000n);await purchase(vm,'huge quoted output normalized',changedBytes(b=>{b.writeBigUInt64LE((1n<<64n)-1n,16);b.writeUInt16LE(100,24);}));}));
 await t.test('compute failure rolls principal back and retry works',()=>fork(async vm=>{await vm.fund(10_000_000n);await rejected(vm,'compute failure',jupiterBuyBurnInstruction(vm.caller.publicKey,build),{limit:50000});await purchase(vm,'compute retry');}));
 await t.test('later transaction failure rolls purchase and emitted burn event back',()=>fork(async vm=>{
  await vm.fund(10_000_000n);const before=await vm.snapshot();const r=record('rollback after emitted burn',await vm.send([jupiterBuyBurnInstruction(vm.caller.publicKey,build),buyBurnInstruction(vm.caller.publicKey)]));assert.notEqual(r.error,null);assert.ok(r.logs.some(l=>l.startsWith('Program data: ')));assert.deepEqual(await vm.snapshot(),before);await purchase(vm,'retry after rollback');
 }));
 await t.test('preserves previously held WSOL principal',()=>fork(async vm=>{await vm.fund(10_000_000n);const {after}=await purchase(vm,'WSOL donation preserved');assert.equal(after.wsol,11_000_000n);},f=>{for(const v of Object.values(f))if(v.pubkey===quoteAta.toBase58()){const b=bytes(v.account);b.writeBigUInt64LE(11_000_000n,64);v.account.data[0]=b.toString('base64');v.account.lamports=Number(b.readBigUInt64LE(113)+11_000_000n);}}));
 await t.test('missing accumulator fails safely rather than spending treasury rent',()=>fork(async vm=>{await vm.fund(10_000_000n);await rejected(vm,'missing AMM setup',jupiterBuyBurnInstruction(vm.caller.publicKey,build));},f=>{for(const[n,v]of Object.entries(f))if(v.pubkey===accumulator.toBase58())delete f[n];}));
 await t.test('fresh caller funds accumulator and ATA setup atomically with Jupiter purchase',()=>fork(async vm=>{
  await vm.fund(10_000_000n);const before=await state(vm);
  const r=record('fresh caller-funded complete setup',await vm.send([...callerFundedPreparation(vm.caller.publicKey,{missingAccumulator:true}),jupiterBuyBurnInstruction(vm.caller.publicKey,build)]));assert.equal(r.error,null,JSON.stringify(r));const after=await state(vm);assert.equal(after.native,floor);assert.equal(after.dusd,0n);assert.equal(after.wsol,0n);assert.ok(before.supply>after.supply);assert.ok(r.bytes<=1232);
 },f=>{for(const[n,v]of Object.entries(f))if([accumulator,baseAta,quoteAta].some(p=>v.pubkey===p.toBase58()))delete f[n];}));
 await t.test('well-formed alternate pool is rejected even with canonical decoy appended',()=>fork(async vm=>{
  await vm.fund(10_000_000n);const b=structuredClone(build),fake=new web3.PublicKey(vm.fixtures.alternatePool.pubkey);b.swapInstruction.accounts[11].pubkey=fake.toBase58();b.swapInstruction.accounts.push({pubkey:pool.toBase58(),isSigner:false,isWritable:true});
  const r=await rejected(vm,'real alternate pool plus decoy',jupiterBuyBurnInstruction(vm.caller.publicKey,b));assert.ok(r.logs.some(l=>l.includes('UnapprovedPool')));
 },f=>{const original=Object.values(f).find(x=>x.pubkey===pool.toBase58());f.alternatePool=structuredClone(original);f.alternatePool.pubkey=web3.Keypair.generate().publicKey.toBase58();}));
 await t.test('missing token ATAs are initialized using caller rent',()=>fork(async vm=>{await vm.fund(10_000_000n);await purchase(vm,'caller-funded ATA setup');},f=>{for(const[n,v]of Object.entries(f))if([baseAta.toBase58(),quoteAta.toBase58()].includes(v.pubkey))delete f[n];}));
 await t.test('empty pool rejects and restores native treasury',()=>fork(async vm=>{await vm.fund(10_000_000n);await rejected(vm,'empty canonical pool',jupiterBuyBurnInstruction(vm.caller.publicKey,build));},f=>{for(const v of Object.values(f))if(v.pubkey==='F65BeadRvnfMwfTK1f6VRfRagLvNVYXDBkDpRZvJVZ8u'){const b=bytes(v.account);b.writeBigUInt64LE(0n,64);v.account.data[0]=b.toString('base64');}}));
 await t.test('40 truncated route payloads and 80 deterministic header mutations fail atomically',()=>fork(async vm=>{
  await vm.fund(10_000_000n);const original=Buffer.from(build.swapInstruction.data,'base64');
  for(let n=0;n<40;n++){const b=structuredClone(build);b.swapInstruction.data=original.subarray(0,n).toString('base64');await rejected(vm,'truncated route '+n,jupiterBuyBurnInstruction(vm.caller.publicKey,b));}
  let seed=0x44555344;for(let n=0;n<80;n++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const at=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,26,27,28,29,30,31,32,33,36,37,38,39][seed%28];const b=changedBytes(d=>d[at]^=1+(seed%255));await rejected(vm,'mutated header '+n,jupiterBuyBurnInstruction(vm.caller.publicKey,b));}
 }));
});
