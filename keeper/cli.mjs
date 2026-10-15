// Portable permissionless caller. Check mode never opens a key or sends a tx.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {web3} from './deps.mjs';
import {snapshot} from './state.mjs';
import {assertMigrated,ids,pk} from './builders.mjs';

// Best effort only: JavaScript/runtime copies cannot be guaranteed erased.
// web3.js 1.98.4's public secretKey getter returns a copy; clear its retained
// backing buffer as well. Version is pinned and this behavior is tested.
export function disposeSigner(key){
  key?.secretKey.fill(0);
  if(key?._keypair?.secretKey instanceof Uint8Array)key._keypair.secretKey.fill(0);
}
export function newGasWallet(filename){
  const key=web3.Keypair.generate();
  try{fs.writeFileSync(filename,JSON.stringify(Array.from(key.secretKey))+'\n',{flag:'wx',mode:0o600});return key.publicKey.toBase58();}
  finally{disposeSigner(key);}
}
export function acquireLock(directory){
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const file=path.join(directory,'run.lock');
  const fd=fs.openSync(file,'wx',0o600);
  fs.writeFileSync(fd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()})+'\n');fs.fsyncSync(fd);fs.closeSync(fd);
  return ()=>fs.unlinkSync(file);
}
export function readGasSigner(filename){
  const stat=fs.lstatSync(filename);
  assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Use a regular, local gas-wallet file');
  if(process.platform!=='win32')assert.equal(stat.mode&0o077,0,'Gas-wallet file must be owner-only (chmod 600)');
  const raw=fs.readFileSync(filename);let bytes;
  try{bytes=JSON.parse(raw.toString());assert.ok(Array.isArray(bytes)&&bytes.length===64&&bytes.every(n=>Number.isInteger(n)&&n>=0&&n<=255));return web3.Keypair.fromSecretKey(Uint8Array.from(bytes));}
  catch{throw new Error('Invalid gas-wallet file: expected a valid Solana JSON keypair (64 bytes); file contents are never included in errors');}
  finally{raw.fill(0);if(Array.isArray(bytes))bytes.fill(0);}
}
const help=`DUSD public keeper — Node 22+, mainnet only
node cli.mjs --check                       Read-only; no key needed (default)
node cli.mjs --new-wallet ./keeper-gas.json Create a new UNFUNDED gas-only wallet
node cli.mjs --execute                     One live cycle; explicit opt-in

SOLANA_RPC_URL     Optional HTTPS RPC (public mainnet by default)
KEEPER_KEYPAIR     Your gas-only JSON keypair, required ONLY with --execute
DUSD_KEEPER_STATE  Persistent journal/lock directory (default ./state)

No reward or reimbursement. --execute spends your wallet's gas/setup funds.
Never use a creator, treasury, upgrade-authority or primary savings key.
No cron/service is installed by this program. Do not delete pending journals.
`;

export async function main(args=process.argv.slice(2),env=process.env,{inspect=snapshot,makeConnection,makeKeeper}={}){
  assert.ok(args.length<=2,'Unknown arguments; use --help');
  if(args[0]==='--help'){assert.equal(args.length,1);console.log(help);return;}
  if(args[0]==='--new-wallet'){assert.equal(args.length,2,'Provide a new local wallet filename');console.log(JSON.stringify({mode:'created-unfunded-gas-wallet',publicKey:newGasWallet(path.resolve(args[1])),warning:'No recovery phrase is printed; protect this file. Fund only a small gas allowance.'}));return;}
  assert.ok(!args.length||(args.length===1&&['--check','--execute'].includes(args[0])),'Unknown arguments; use --help');
  const execute=args[0]==='--execute',url=env.SOLANA_RPC_URL??'https://api.mainnet-beta.solana.com';
  const parsed=new URL(url);assert.equal(parsed.protocol,'https:','Use an HTTPS mainnet RPC');assert.ok(!parsed.username&&!parsed.password,'Do not embed HTTP user credentials');
  let queue=Promise.resolve(),last=0;
  const paced=(input,init)=>{const work=queue.then(async()=>{const method=JSON.parse(init.body).method;assert.ok(method.startsWith('get')||(execute&&['simulateTransaction','sendTransaction'].includes(method)),'Unexpected RPC method');await new Promise(r=>setTimeout(r,Math.max(0,last+750-Date.now())));last=Date.now();return fetch(input,{...init,signal:AbortSignal.timeout(20000)});});queue=work.catch(()=>{});return work;};
  const c=makeConnection?makeConnection():new web3.Connection(url,{commitment:'finalized',disableRetryOnRateLimit:true,fetch:paced});
  assert.equal(await c.getGenesisHash(),'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d','Not Solana mainnet');
  const state=await inspect(c);assertMigrated(state.sharing);
  const summary={mode:execute?'execute':'read-only-check',slot:state.slot,adminRevoked:state.sharing.admin_revoked,shares:state.sharing.shareholders,treasuryLamports:state.native.toString(),spendableLamports:(state.native>state.rent?state.native-state.rent:0n).toString(),creatorFeesLamports:state.fees.toString(),dusdRaw:state.dusd.toString(),wsolRaw:state.wsol.toString(),keyAccessed:false};
  if(!execute){console.log(JSON.stringify(summary));return summary;}
  assert.ok(env.KEEPER_KEYPAIR,'Set KEEPER_KEYPAIR to your own gas-only JSON keypair');
  const directory=path.resolve(env.DUSD_KEEPER_STATE??'./state');let unlock,key;
  try{
    unlock=acquireLock(directory);key=readGasSigner(path.resolve(env.KEEPER_KEYPAIR));
    assert.ok(![ids.treasury,'Ei8d6LZSjbzQ4v9EMBLJSpp2NfVUdckJ39sBXDmNRzSq','FzPw22y8fMnsFYBnXh2p6sfsFzTHYLtLMWybS9d2RS2q'].includes(key.publicKey.toBase58()),'Privileged or retired identities forbidden');
    const {Keeper}=await import('./runner.mjs');
    const keeper=makeKeeper?makeKeeper({connection:c,signer:key,stateDirectory:directory}):new Keeper({connection:c,signer:key,stateDirectory:directory});
    const result=await keeper.once();console.log(JSON.stringify(result));return result;
  }finally{disposeSigner(key);unlock?.();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{await main();}catch(e){console.error(JSON.stringify({outcome:'refused-or-failed',reason:String(e.message).replace(/https?:\/\/\S+/g,'[RPC URL REDACTED]').slice(0,500)}));process.exitCode=1;}
}
