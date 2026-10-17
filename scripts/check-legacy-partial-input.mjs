// Optional local reproduction of a missing full-input postcondition. No RPC.
import fs from 'node:fs';import assert from 'node:assert/strict';
assert.ok(process.env.DUSD_BASELINE_BINARY,'Select an older local ELF explicitly');
process.env.REVIEW_BURN_BINARY=process.env.DUSD_BASELINE_BINARY;
const root=fs.realpathSync(new URL('../',import.meta.url));process.env.REVIEW_AMM_BINARY=root+'/fixtures/programs/review_mock_amm.so';
const {AuditVM,key,bytes,amount,modify,treasuryAtaFixture,cleanSandbox}=await import('../tools/audit-vm.mjs');
const {treasury,quoteAta,accumulator}=await import('../tools/client.mjs');
const vm=await AuditVM.start(f=>{modify(f,'pool',b=>b[8]=7);treasuryAtaFixture(f,'quote');modify(f,'quoteAta',(b,a)=>{b.writeBigUInt64LE(10_000_000n,64);a.lamports=b.readBigUInt64LE(113)+10_000_000n;});const d=Buffer.alloc(137);Buffer.from([86,255,112,14,102,53,154,250]).copy(d);treasury.toBuffer().copy(d,8);f.accumulator={pubkey:accumulator.toBase58(),account:{lamports:2_000_000,owner:key('ammProgram').toBase58(),data:[d.toString('base64'),'base64'],executable:false,rentEpoch:0}};});
try{await vm.fund(10_000_000n);const before=amount((await vm.accounts([quoteAta]))[0]),r=await vm.buy(),after=amount((await vm.accounts([quoteAta]))[0]);assert.equal(r.error,null);assert.equal(after-before,1n);
 const evidence={scope:'local hostile-upstream test double, not a demonstrated current Pump exploit',at:new Date().toISOString(),acceptedPartialInput:true,inputLamports:'10000000',spentLamports:'9999999',leftUnspentLamports:'1',error:r.error,computeUnits:r.computeUnits,transactionsSubmittedToNetwork:0};fs.writeFileSync(root+'/verification/candidate/OLDER-PARTIAL-INPUT-PROOF.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{vm.close();cleanSandbox();}
