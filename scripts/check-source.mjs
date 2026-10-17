import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),isCandidate=fs.existsSync(new URL('verification/candidate/release.json',root)),release=JSON.parse(fs.readFileSync(new URL(isCandidate?'verification/candidate/release.json':'verification/release.json',root)));
for(const [file,expected]of Object.entries(release.sourceHashes)){
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),expected,file);
}
const idl=JSON.parse(fs.readFileSync(new URL('idl/dusd_burn.json',root)));
const source=fs.readFileSync(new URL('programs/dusd_burn/src/lib.rs',root),'utf8');
assert.ok(source.includes(`declare_id!("${release.programId}")`));assert.equal(idl.address,release.programId);
assert.deepEqual(idl.instructions.map(x=>x.name),['execute_buy_and_burn','burn_dusd','unwrap_quote',...(isCandidate?['execute_jupiter_buy_and_burn']:[])]);
for(const ix of idl.instructions){assert.deepEqual(ix.args,ix.name==='execute_jupiter_buy_and_burn'?[{name:'route_data',type:'bytes'}]:[]);assert.deepEqual(ix.discriminator,[...crypto.createHash('sha256').update('global:'+ix.name).digest().subarray(0,8)]);}
for(const event of idl.events)assert.deepEqual(event.discriminator,[...crypto.createHash('sha256').update('event:'+event.name).digest().subarray(0,8)]);
assert.equal(idl.instructions[0].accounts.length,18);assert.equal(idl.instructions[1].accounts.length,5);assert.equal(idl.instructions[2].accounts.length,5);
assert.ok(fs.readFileSync(new URL('programs/dusd_burn/Cargo.toml',root),'utf8').includes('default = ["no-idl"]'));
console.log(JSON.stringify({sourceHashesMatch:true,programId:release.programId,instructionDiscriminatorsMatch:true,noIdlUnchanged:true}));
