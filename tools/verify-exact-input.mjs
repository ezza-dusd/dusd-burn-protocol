// Feasibility gate: only direct calls to the pinned PumpSwap SBF in a local VM.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {AuditVM,ROOT,reserves,oneTier,modify,cleanSandbox} from './audit-vm.mjs';
import {verifyArtifacts} from './artifacts.mjs';
const dir=ROOT+'/research/lifecycle-2026-10-14';fs.mkdirSync(dir,{recursive:true});
const result={startedAt:new Date().toISOString(),artifacts:verifyArtifacts(),cases:[]};
const configs=[['saved',()=>{}],['zero fees',f=>oneTier(f,{lp:0n,protocol:0n,creator:0n})],['501 bps',f=>oneTier(f,{lp:100n,protocol:200n,creator:201n})],
 ['65 tiers',f=>oneTier(f,{count:65})],['below first tier',f=>oneTier(f,{threshold:1n<<100n})],
 ['custom creator rate',f=>{modify(f,'globalConfig',b=>b[940]=1);modify(f,'pool',b=>{b.writeBigUInt64LE(200n,261);b[269]=1;});}],
 ['one raw output',f=>{reserves(f,2n,1_000_000n);oneTier(f);}],['large input',()=>{}]];
try{
 for(const [name,edit]of configs)for(const minimum of [0n,1n]){
  const vm=await AuditVM.start(edit);try{
   const input=name==='large input'?1_000_000_000_000n:10_000_000n,r=await vm.direct(input,minimum);
   const entry={name,input:input.toString(),minimum:minimum.toString(),output:r.output.toString(),quoteSpent:r.quoteSpent.toString(),error:r.error,computeUnits:r.computeUnits,bytes:r.bytes,logs:r.error?r.logs.slice(-9):undefined};
   result.cases.push(entry);console.log(JSON.stringify(entry));
   if(minimum===1n){assert.equal(r.error,null);assert.ok(r.output>0n);assert.equal(r.quoteSpent,input);}else{assert.notEqual(r.error,null);assert.match(r.logs.join('\n'),/ZeroBaseAmount/);}
  }finally{vm.close();}
 }
 const vm=await AuditVM.start(f=>reserves(f,1n,1_000_000_000n));try{const r=await vm.direct(10_000_000n,1n);assert.notEqual(r.error,null);result.cases.push({name:'no achievable raw output',minimum:'1',error:r.error,logs:r.logs.slice(-9)});}finally{vm.close();}
 result.feasible=true;result.minimumUsedForWrapper='1';
}finally{result.finishedAt=new Date().toISOString();fs.writeFileSync(dir+'/feasibility.json',JSON.stringify(result,null,2));cleanSandbox();}
console.log('Exact-input feasibility confirmed: one raw unit minimum, native fee calculation.');
