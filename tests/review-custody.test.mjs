import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {web3,token} from '../tools/deps.mjs';
import {treasury,baseMint,baseAta,quoteAta,pool,jupiterBuyBurnInstruction,burnDusdInstruction,unwrapInstruction} from '../tools/client.mjs';
const root=fs.realpathSync(new URL('../',import.meta.url));
process.env.REVIEW_JUPITER_FIXTURES='1';
process.env.REVIEW_AMM_BINARY=root+'/fixtures/programs/review_mock_amm.so';
const {AuditVM,floor,bytes,amount,cleanSandbox}=await import('../tools/audit-vm.mjs');
const build=JSON.parse(fs.readFileSync(root+'/fixtures/jupiter-canonical/pump.json'));
const evidence=[];
const json=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v);
async function fork(edit,fn){
 const vm=await AuditVM.start(f=>{
  for(const v of Object.values(f)){
   if(v.pubkey===treasury.toBase58())v.account.lamports=Number(floor);
   if([baseAta.toBase58(),quoteAta.toBase58()].includes(v.pubkey)){
    const b=bytes(v.account);b.writeBigUInt64LE(0n,64);v.account.data[0]=b.toString('base64');
    if(v.pubkey===quoteAta.toBase58())v.account.lamports=Number(b.readBigUInt64LE(113));
   }
  }
  edit(f);
 });
 try{await fn(vm);}finally{vm.close();}
}
function patch(f,key,fn){const v=Object.values(f).find(v=>v.pubkey===key.toBase58());assert.ok(v);const b=bytes(v.account);fn(b,v.account);v.account.data[0]=b.toString('base64');}
async function watched(vm){const keys=[...new Set(Object.values(vm.fixtures).map(v=>v.pubkey))].filter(k=>k!==vm.caller.publicKey.toBase58());return vm.accounts(keys.map(k=>new web3.PublicKey(k)));}
async function rejected(vm,label,ixs){const before=await watched(vm),r=await vm.send(ixs);evidence.push({label,...r});assert.notEqual(r.error,null,label);assert.deepEqual(await watched(vm),before,label);return r;}
test.after(()=>{fs.writeFileSync(root+'/research/review-custody-results.json',JSON.stringify(evidence,null,2));cleanSandbox();});
for(let mode=0;mode<8;mode++)test('actual Jupiter over hostile local AMM mode '+mode,()=>fork(f=>{
 patch(f,pool,b=>b[8]=mode);
 patch(f,quoteAta,(b,a)=>{b.writeBigUInt64LE(10_000_000n,64);a.lamports=Number(b.readBigUInt64LE(113)+10_000_000n);});
},async vm=>{
 await vm.fund(10_000_000n);
 if(mode!==3){await rejected(vm,'Jupiter hostile mode '+mode,[jupiterBuyBurnInstruction(vm.caller.publicKey,build)]);return;}
 const before=(await vm.accounts([baseMint]))[0],r=await vm.send([jupiterBuyBurnInstruction(vm.caller.publicKey,build)]);evidence.push({label:'honest minimal mock via real Jupiter',...r});assert.equal(r.error,null,json(r));
 const [m,b,q,t]=await vm.accounts([baseMint,baseAta,quoteAta,treasury]);assert.equal(bytes(before).readBigUInt64LE(36)-bytes(m).readBigUInt64LE(36),1n);assert.equal(amount(b),0n);assert.equal(amount(q),10_000_000n);assert.equal(BigInt(t.lamports),floor);
}));
test('Jupiter signer privilege does not escape into a later native withdrawal',()=>fork(f=>patch(f,pool,b=>b[8]=3),async vm=>{
 await vm.fund(10_000_000n);
 const steal=web3.SystemProgram.transfer({fromPubkey:treasury,toPubkey:vm.caller.publicKey,lamports:1n});steal.keys[0].isSigner=false;
 const r=await rejected(vm,'native signer escape',[jupiterBuyBurnInstruction(vm.caller.publicKey,build),steal]);assert.ok(r.logs.some(x=>x.includes('Program data: ')));
}));
test('Jupiter signer privilege does not escape into a later WSOL withdrawal',()=>fork(f=>{
 patch(f,pool,b=>b[8]=3);patch(f,quoteAta,(b,a)=>{b.writeBigUInt64LE(10_000_000n,64);a.lamports=Number(b.readBigUInt64LE(113)+10_000_000n);});
},async vm=>{
 await vm.fund(10_000_000n);
 const dst=token.getAssociatedTokenAddressSync(token.NATIVE_MINT,vm.caller.publicKey);
 assert.equal((await vm.send([token.createAssociatedTokenAccountIdempotentInstruction(vm.caller.publicKey,dst,vm.caller.publicKey,token.NATIVE_MINT)])).error,null);
 const steal=token.createTransferInstruction(quoteAta,dst,treasury,1n);steal.keys[2].isSigner=false;
 await rejected(vm,'WSOL signer escape',[jupiterBuyBurnInstruction(vm.caller.publicKey,build),steal]);assert.equal(amount((await vm.accounts([dst]))[0]),0n);
}));
for(const [label,edit]of [
 ['base delegate',(f)=>patch(f,baseAta,b=>{b.writeUInt32LE(1,72);pool.toBuffer().copy(b,76);})],
 ['quote close authority',(f)=>patch(f,quoteAta,b=>{b.writeUInt32LE(1,129);pool.toBuffer().copy(b,133);})],
 ['base frozen',(f)=>patch(f,baseAta,b=>b[108]=2)],
 ['mint authority',(f)=>patch(f,baseMint,b=>{b.writeUInt32LE(1,0);pool.toBuffer().copy(b,4);})],
])test('Jupiter rejects unsafe starting '+label,()=>fork(f=>{patch(f,pool,b=>b[8]=3);edit(f);},async vm=>{await vm.fund(10_000_000n);await rejected(vm,label,[jupiterBuyBurnInstruction(vm.caller.publicKey,build)]);}));
test('Jupiter requires caller signature even though only the PDA signs the inner route',()=>fork(f=>patch(f,pool,b=>b[8]=3),async vm=>{
 await vm.fund(10_000_000n);const ix=jupiterBuyBurnInstruction(vm.caller.publicKey,build),fake=web3.Keypair.generate().publicKey;ix.keys[0]={pubkey:fake,isSigner:false,isWritable:true};
 await rejected(vm,'unsigned fake caller',[ix]);
}));
test('WSOL unwrap sends rent and all wrapped principal only to treasury',()=>fork(f=>patch(f,quoteAta,(b,a)=>{b.writeBigUInt64LE(10_000_000n,64);a.lamports=Number(b.readBigUInt64LE(113)+10_000_000n);}),async vm=>{
 const [before,q]=await vm.accounts([treasury,quoteAta]);const r=await vm.send([unwrapInstruction(vm.caller.publicKey)]);evidence.push({label:'unwrap destination',...r});assert.equal(r.error,null,json(r));
 const [after,closed]=await vm.accounts([treasury,quoteAta]);assert.equal(closed,null);assert.equal(BigInt(after.lamports),BigInt(before.lamports)+BigInt(q.lamports));
}));
test('standalone burn ignores unavailable AMM and requires no native treasury principal',()=>fork(f=>{patch(f,pool,b=>b[8]=0);patch(f,baseAta,b=>b.writeBigUInt64LE(123n,64));},async vm=>{
 const [before,t]=await vm.accounts([baseMint,treasury]);const r=await vm.send([burnDusdInstruction(vm.caller.publicKey)]);evidence.push({label:'independent standalone burn',...r});assert.equal(r.error,null,json(r));const [after,b,t2]=await vm.accounts([baseMint,baseAta,treasury]);assert.equal(bytes(before).readBigUInt64LE(36)-bytes(after).readBigUInt64LE(36),123n);assert.equal(amount(b),0n);assert.deepEqual(t2,t);
}));
