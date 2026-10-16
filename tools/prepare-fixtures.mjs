import fs from 'node:fs';import {web3} from './deps.mjs';
const root=new URL('../',import.meta.url),inventory=JSON.parse(fs.readFileSync(new URL('research/onchain-inventory.json',root)));
fs.mkdirSync(new URL('fixtures/accounts/',root),{recursive:true});
// Unmodified public account snapshots. No production credentials copied.
for(const [name,a] of Object.entries(inventory.accounts)){
 if(!a||a.executable||['ammCreatorVault'].includes(name))continue;
 const clone=structuredClone(a);clone.rentEpoch=0; // RPC JSON rounds u64::MAX; local rent epoch is not economic state
 fs.writeFileSync(new URL(`fixtures/accounts/${name}.json`,root),JSON.stringify({pubkey:inventory.addresses[name],account:clone}));
}
const p=new URL('fixtures/local/caller.keypair.json',root);
fs.mkdirSync(new URL('fixtures/local/',root),{recursive:true});
const caller=fs.existsSync(p)?web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p)))):web3.Keypair.generate();
if(!fs.existsSync(p))fs.writeFileSync(p,JSON.stringify(Array.from(caller.secretKey)),{mode:0o600});
// Controlled fork mutation: ONLY sharing_config.admin becomes the disposable
// LOCAL signer. The original snapshot and all deployed binaries remain intact.
// This permits signed finalisation tests without ever loading Ei8d's private key.
const sharing=structuredClone(inventory.accounts.sharingConfig),sharingBytes=Buffer.from(sharing.data[0],'base64');sharing.rentEpoch=0;
caller.publicKey.toBuffer().copy(sharingBytes,43);sharing.data[0]=sharingBytes.toString('base64');
fs.writeFileSync(new URL('fixtures/accounts/sharingConfig.json',root),JSON.stringify({pubkey:inventory.addresses.sharingConfig,account:sharing}));
const treasury=web3.PublicKey.findProgramAddressSync([Buffer.from('treasury')],new web3.PublicKey(inventory.addresses.burnProgram??'Cfd92kkjkkw7oyZN6ZwRDJBCSSUjmALzp9EgDararj7s'))[0];
fs.writeFileSync(new URL('fixtures/local/public-addresses.json',root),JSON.stringify({caller:caller.publicKey.toBase58(),treasury:treasury.toBase58(),testProgram:'Cfd92kkjkkw7oyZN6ZwRDJBCSSUjmALzp9EgDararj7s'},null,2));
console.log('Public chain fixtures prepared; disposable test identity exists.');
