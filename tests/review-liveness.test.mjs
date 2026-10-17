import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {web3,token} from '../tools/deps.mjs';
import {treasury,baseMint,baseAta,quoteAta,accumulator,jupiterBuyBurnInstruction,burnDusdInstruction} from '../tools/client.mjs';
import {callerFundedPreparation} from '../keeper/jupiter.mjs';
process.env.REVIEW_JUPITER_FIXTURES='1';
const {AuditVM,ROOT,floor,bytes,amount,cleanSandbox}=await import('../tools/audit-vm.mjs');
const build=JSON.parse(fs.readFileSync(ROOT+'/fixtures/jupiter-canonical/pump.json')),evidence=[];
test.after(()=>{fs.writeFileSync(ROOT+'/research/review-liveness-results.json',JSON.stringify(evidence,null,2));cleanSandbox();});
function reset(f){for(const v of Object.values(f)){
 if(v.pubkey===treasury.toBase58())v.account.lamports=Number(floor);
 if([baseAta.toBase58(),quoteAta.toBase58()].includes(v.pubkey)){const b=bytes(v.account);b.writeBigUInt64LE(0n,64);v.account.data[0]=b.toString('base64');if(v.pubkey===quoteAta.toBase58())v.account.lamports=Number(b.readBigUInt64LE(113));}
}}
async function fork(edit,fn){const vm=await AuditVM.start(f=>{reset(f);edit(f);});try{await fn(vm);}finally{vm.close();}}
function prefund(f,key,lamports){for(const[n,v]of Object.entries(f))if(v.pubkey===key.toBase58())delete f[n];f['prefund'+key.toBase58()]={pubkey:key.toBase58(),account:{lamports,owner:web3.SystemProgram.programId.toBase58(),data:['','base64'],executable:false,rentEpoch:0}};}
for(const [label,key]of [['accumulator',accumulator],['DUSD ATA',baseAta],['WSOL ATA',quoteAta]])for(const useJupiter of [false,true])test('one-lamport prefunding cannot block '+label+' via '+(useJupiter?'Jupiter':'direct'),()=>fork(f=>prefund(f,key,1),async vm=>{
 await vm.fund(10_000_000n);
 const r=useJupiter?await vm.send([...callerFundedPreparation(vm.caller.publicKey,{missingAccumulator:key.equals(accumulator)}),jupiterBuyBurnInstruction(vm.caller.publicKey,build)]):await vm.buy();
 evidence.push({label,useJupiter,...r});assert.equal(r.error,null,JSON.stringify(r));assert.equal(amount((await vm.accounts([baseAta]))[0]),0n);assert.equal(BigInt((await vm.accounts([treasury]))[0].lamports),floor);
}));
for(const useJupiter of [false,true])test('unsynchronized WSOL donation is preserved via '+(useJupiter?'Jupiter':'direct'),()=>fork(f=>{const v=Object.values(f).find(v=>v.pubkey===quoteAta.toBase58());v.account.lamports+=15_000_000;},async vm=>{
 await vm.fund(10_000_000n);const before=(await vm.accounts([quoteAta]))[0];assert.equal(amount(before),0n);
 const r=useJupiter?await vm.send([jupiterBuyBurnInstruction(vm.caller.publicKey,build)]):await vm.buy();evidence.push({label:'unsynced donation',useJupiter,...r});assert.equal(r.error,null,JSON.stringify(r));const after=(await vm.accounts([quoteAta]))[0];assert.equal(amount(after),15_000_000n);assert.equal(BigInt(after.lamports),BigInt(before.lamports));
}));
test('failed malformed route does not poison a later valid route or standalone burn',()=>fork(()=>{},async vm=>{
 await vm.fund(10_000_000n);const malformed=structuredClone(build),raw=Buffer.from(build.swapInstruction.data,'base64');raw[34]=255;malformed.swapInstruction.data=raw.toString('base64');
 const rejected=await vm.send([jupiterBuyBurnInstruction(vm.caller.publicKey,malformed)]);assert.notEqual(rejected.error,null);const r=await vm.send([jupiterBuyBurnInstruction(vm.caller.publicKey,build)]);assert.equal(r.error,null,JSON.stringify(r));
 const noop=await vm.send([burnDusdInstruction(vm.caller.publicKey)]);assert.equal(noop.error,null,JSON.stringify(noop));evidence.push({label:'failure followed by valid purchase',...r},{label:'later standalone no-op',...noop});
}));
