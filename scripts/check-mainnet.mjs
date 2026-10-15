// Public reads only. No SDK, signing material or transaction submission.
import crypto from 'node:crypto';import fs from 'node:fs';import assert from 'node:assert/strict';
const release=JSON.parse(fs.readFileSync(new URL('../verification/release.json',import.meta.url)));
const url=process.env.SOLANA_RPC_URL??'https://api.mainnet-beta.solana.com';assert.equal(new URL(url).protocol,'https:');
async function rpc(method,params=[]){assert.ok(['getGenesisHash','getMultipleAccounts'].includes(method));const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(30000)});assert.ok(r.ok,'RPC HTTP '+r.status);const j=await r.json();assert.ok(!j.error,'RPC error');return j.result;}
function base58(bytes){let n=0n;for(const b of bytes)n=n*256n+BigInt(b);let s='';const abc='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';while(n){s=abc[Number(n%58n)]+s;n/=58n;}for(const b of bytes){if(b!==0)break;s='1'+s;}return s;}
assert.equal(await rpc('getGenesisHash'),'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');
const addresses=[release.programId,release.programData,release.treasury,release.dusdAccount,release.wsolAccount];const r=await rpc('getMultipleAccounts',[addresses,{commitment:'finalized',encoding:'base64'}]);assert.ok(r.value.every(Boolean));
const [program,programData,treasury,base,quote]=r.value;const p=Buffer.from(program.data[0],'base64'),pd=Buffer.from(programData.data[0],'base64');
assert.ok(program.executable);assert.equal(program.owner,'BPFLoaderUpgradeab1e11111111111111111111111');assert.equal(programData.owner,program.owner);assert.equal(p.readUInt32LE(),2);assert.equal(base58(p.subarray(4,36)),release.programData);assert.equal(pd.readUInt32LE(),3);
const elf=pd.subarray(45);assert.equal(elf.length,release.elfBytes);const sha=crypto.createHash('sha256').update(elf).digest('hex');assert.equal(sha,release.fullElfSha256);
let end=elf.length;while(end&&elf[end-1]===0)end--;const verifyHash=crypto.createHash('sha256').update(elf.subarray(0,end)).digest('hex');assert.equal(verifyHash,release.solanaVerifyExecutableHash);
const authority=pd[12]===1?base58(pd.subarray(13,45)):null;
assert.equal(treasury.owner,'11111111111111111111111111111111');assert.equal(Buffer.from(treasury.data[0],'base64').length,0);
for(const [a,mint]of [[base,release.mint],[quote,'So11111111111111111111111111111111111111112']]){assert.equal(a.owner,'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');const data=Buffer.from(a.data[0],'base64');assert.equal(base58(data.subarray(0,32)),mint);assert.equal(base58(data.subarray(32,64)),release.treasury);}
console.log(JSON.stringify({slot:r.context.slot,program:release.programId,fullElfSha256:sha,solanaVerifyExecutableHash:verifyHash,sourceReleaseMatchesDeployedBytes:true,currentUpgradeAuthority:authority,immutable:authority===null,releaseAuthorityUnchanged:authority===release.upgradeAuthority,treasury:release.treasury}));
