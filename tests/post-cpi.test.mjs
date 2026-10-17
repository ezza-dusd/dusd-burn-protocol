// Hostile AMM test double under a local VM only. No current Pump compromise is alleged.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const root=fs.realpathSync(new URL('../',import.meta.url));
process.env.REVIEW_AMM_BINARY=root+'/fixtures/programs/review_mock_amm.so';
const {AuditVM,key,bytes,amount,modify,treasuryAtaFixture,cleanSandbox}=await import('../tools/audit-vm.mjs');
const {treasury,baseAta,quoteAta,accumulator}=await import('../tools/client.mjs');
const evidence=[];
test('post-CPI custody invariants against hostile upstream mock',async t=>{
 t.after(()=>{fs.writeFileSync(root+'/research/post-cpi-results.json',JSON.stringify(evidence,null,2));cleanSandbox();});
 for(const mode of [0,1,2,3,4,5,6,7])await t.test(['fake success without output','upstream spends then fails','upstream overspends','honest minimal trade','WSOL delegate takeover','treasury owner takeover','WSOL authority takeover','upstream leaves input unspent'][mode],async()=>{
  const vm=await AuditVM.start(f=>{
   modify(f,'pool',b=>b[8]=mode);treasuryAtaFixture(f,'quote');modify(f,'quoteAta',(b,a)=>{b.writeBigUInt64LE(10_000_000n,64);a.lamports=b.readBigUInt64LE(113)+10_000_000n;});
   const d=Buffer.alloc(137);Buffer.from([86,255,112,14,102,53,154,250]).copy(d);treasury.toBuffer().copy(d,8);
   f.accumulator={pubkey:accumulator.toBase58(),account:{lamports:2_000_000,owner:key('ammProgram').toBase58(),data:[d.toString('base64'),'base64'],executable:false,rentEpoch:0}};
  });try{await vm.fund(10_000_000n);const before=await vm.snapshot(),r=await vm.buy();evidence.push({mode,error:r.error,computeUnits:r.computeUnits,bytes:r.bytes});
   if(mode===3){assert.equal(r.error,null);assert.equal(amount((await vm.accounts([baseAta]))[0]),0n);}
   else{assert.notEqual(r.error,null,JSON.stringify(r));assert.deepEqual(await vm.snapshot(),before);}
  }finally{vm.close();}
 });
});
