// Offline provenance/consistency checks. Never loads production keys or contacts RPC.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {web3} from './deps.mjs';
const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root));
const json=path=>JSON.parse(read(path));
const hash=path=>crypto.createHash('sha256').update(read(path)).digest('hex');
export function verifyArtifacts(){
 const programs=json('fixtures/programs/manifest.json');
 const upstream=json('research/upstream/manifest.json');
 const inventory=json('research/onchain-inventory.json');
 const entries={};
 const local=json('fixtures/local/public-addresses.json');
 for(const name of fs.readdirSync(new URL('fixtures/accounts/',root))){
  if(!name.endsWith('.json'))continue;
  const path='fixtures/accounts/'+name,fixture=json(path),label=name.slice(0,-5);
  const expected=structuredClone(inventory.accounts[label]);
  if(!expected||fixture.pubkey!==inventory.addresses[label])throw new Error('Unknown fixture '+name);
  expected.rentEpoch=0;
  if(label==='sharingConfig'){
   const bytes=Buffer.from(expected.data[0],'base64');
   new web3.PublicKey(local.caller).toBuffer().copy(bytes,43);
   expected.data[0]=bytes.toString('base64');
  }
  // The only fork mutation permitted here is the sharing administrator.
  if(JSON.stringify(expected)!==JSON.stringify(fixture.account))throw new Error('Unexpected fork mutation: '+name);
  entries[path]=hash(path);
 }
 for(const p of programs.programs){
  const path='fixtures/programs/'+p.file;
  if(hash(path)!==p.sha256||read(path).length!==p.bytes||inventory.addresses[p.name]!==p.address)throw new Error('Pinned program mismatch: '+p.name);
  entries[path]=p.sha256;
 }
 for(const s of upstream.sources){
  const path='research/upstream/'+s.path.split('/').at(-1);
  if(hash(path)!==s.sha256)throw new Error('Pinned upstream file mismatch: '+path);
  entries[path]=s.sha256;
 }
 for(const path of ['programs/dusd_burn/src/lib.rs','tools/client.mjs','tools/claims.mjs','harness/src/main.rs',
  'tests/local-validator.test.mjs','tests/policy.test.mjs','tools/run-tests.mjs','tools/artifacts.mjs',
  'Cargo.lock','harness/Cargo.lock','package-lock.json','target/deploy/dusd_burn.so','research/onchain-inventory.json','research/rent-sysvar.json'])entries[path]=hash(path);
 return {verifiedAt:new Date().toISOString(),node:process.version,upstreamCommit:upstream.commit,
  snapshotObservedAt:inventory.observedAt,snapshotSlot:inventory.slot,binaryReadSlot:programs.readSlot,
  externalPrograms:programs.programs.map(({name,address,slot,upgradeAuthority,sha256})=>({name,address,slot,upgradeAuthority,sha256})),sha256:entries};
}
