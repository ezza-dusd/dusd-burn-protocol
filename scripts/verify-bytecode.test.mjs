import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, compareMainnet } from './verify-bytecode.mjs';
const release = { programId: 'test', programData: '11111111111111111111111111111111' };
const elf = Buffer.from([127,69,76,70,1,2,0,0]);
const p = Buffer.alloc(36); p.writeUInt32LE(2);
const pd = Buffer.concat([Buffer.alloc(45),elf]); pd.writeUInt32LE(3);
function transport({ genesis = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d', owner = 'BPFLoaderUpgradeab1e11111111111111111111111', data = pd, programData = p, executable = true, error = false, ok = true } = {}) {
  return async (_url, opts) => {
    const req = JSON.parse(opts.body);
    assert.ok(['getGenesisHash','getMultipleAccounts'].includes(req.method));
    if (req.method === 'getMultipleAccounts') assert.equal(req.params[1].commitment,'finalized');
    return { ok, status:429, json:async()=>error ? {error:{message:'rejected'}} : {result:req.method==='getGenesisHash' ? genesis : {context:{slot:123},value:[{owner,executable,data:[programData.toString('base64'),'base64']},{owner,data:[data.toString('base64'),'base64']}]}} };
  };
}
test('normalization strips trailing zeros only',()=>{
  assert.equal(fingerprint(elf).executableHash,fingerprint(elf.subarray(0,6)).executableHash);
  assert.notEqual(fingerprint(elf).fullSha256,fingerprint(elf.subarray(0,6)).fullSha256);
});
test('matches independently fetched bytes without trusting manifest digest',async()=>{
  const r=await compareMainnet(elf,release,transport());assert.equal(r.match,true);assert.equal(r.releaseReferenceUnchanged,false);
});
test('one changed byte is a mismatch',async()=>{ const b=Buffer.from(elf);b[4]++;assert.equal((await compareMainnet(b,release,transport())).match,false); });
test('extra trailing padding fails full-byte comparison',async()=>{ assert.equal((await compareMainnet(Buffer.concat([elf,Buffer.alloc(1)]),release,transport())).match,false); });
test('rejects wrong cluster',async()=>{await assert.rejects(compareMainnet(elf,release,transport({genesis:'devnet'})));});
test('rejects owner substitution',async()=>{await assert.rejects(compareMainnet(elf,release,transport({owner:'fake'})));});
test('rejects malformed ProgramData',async()=>{await assert.rejects(compareMainnet(elf,release,transport({data:Buffer.alloc(20)})));});
test('rejects RPC errors',async()=>{await assert.rejects(compareMainnet(elf,release,transport({error:true})));});
test('rejects HTTP failures',async()=>{await assert.rejects(compareMainnet(elf,release,transport({ok:false})));});
test('rejects non-executable program',async()=>{await assert.rejects(compareMainnet(elf,release,transport({executable:false})));});
test('rejects substituted ProgramData binding',async()=>{const q=Buffer.from(p);q[4]=1;await assert.rejects(compareMainnet(elf,release,transport({programData:q})));});
