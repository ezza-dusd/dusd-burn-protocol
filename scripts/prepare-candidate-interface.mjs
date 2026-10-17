// Mechanical public candidate metadata generation. No wallet or RPC.
import fs from 'node:fs';import crypto from 'node:crypto';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const candidate=JSON.parse(read('verification/candidate/release.json'));
const idl=JSON.parse(read('idl/dusd_burn.json'));
idl.metadata.description='UNDEPLOYED candidate interface. Historical mainnet release remains separately pinned. Hand-transcribed interface checked against local execution.';
idl.instructions=idl.instructions.filter(i=>i.name!=='execute_jupiter_buy_and_burn');
const rows=[['caller',true,true],['treasury',true,false],['base_mint',true,false],['quote_mint',false,false],['base_ata',true,false],['quote_ata',true,false],['token_program',false,false],['system_program',false,false],['associated_token_program',false,false],['jupiter_program',false,false]];
idl.instructions.push({name:'execute_jupiter_buy_and_burn',discriminator:[...crypto.createHash('sha256').update('global:execute_jupiter_buy_and_burn').digest().subarray(0,8)],accounts:rows.map(([name,writable,signer])=>({name,...(writable?{writable}:{}),...(signer?{signer}:{})})),args:[{name:'route_data',type:'bytes'}]});
idl.errors=idl.errors.filter(e=>e.code<6009);idl.errors.push({code:6009,name:'BadRoute',msg:'Invalid Jupiter route or account privileges'},{code:6010,name:'UnapprovedPool',msg:'Route contains a pool outside the immutable allowlist'});
fs.writeFileSync(new URL('idl/dusd_burn.json',root),JSON.stringify(idl,null,2)+'\n');
const manifest=JSON.parse(read('keeper/UPSTREAM-COPY-MANIFEST.json'));manifest.description='Undeployed canonical-only Jupiter candidate; current public runtime hashes, not a live-release claim.';
if(!manifest.files.some(f=>f.file==='jupiter.mjs'))manifest.files.push({file:'jupiter.mjs'});
for(const f of manifest.files)f.sha256=hash(read('keeper/'+f.file));
fs.writeFileSync(new URL('keeper/UPSTREAM-COPY-MANIFEST.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log('Candidate IDL and runtime manifest generated.');
