// Portable permissionless caller. Check mode never opens a key or sends a tx.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {web3} from './deps.mjs';
import {snapshot} from './state.mjs';
import {assertMigrated,ids,pk} from './builders.mjs';
import {acquireLock} from './lock.mjs';
export {acquireLock} from './lock.mjs';

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
node cli.mjs --status                      Local health summary; no RPC or key
node cli.mjs --reconcile                   Resolve saved receipt/expiry; no key or send

SOLANA_RPC_URL     Optional HTTPS RPC (public mainnet by default)
KEEPER_KEYPAIR     Your gas-only JSON keypair, required ONLY with --execute
DUSD_KEEPER_STATE  Persistent journal/lock directory (default ./state)
SOLANA_RECOVERY_RPC_URL  Second HTTPS provider for expired-signature checks
KEEPER_MAX_DEBIT_LAMPORTS  Simulation budget per transaction (default 5000000)
KEEPER_PRIORITY_MICROLAMPORTS  CU price (default 1000, maximum 25000)

No reward or reimbursement. --execute spends your wallet's gas/setup funds.
Never use a creator, treasury, upgrade-authority or primary savings key.
No cron/service is installed by this program. Do not delete pending journals.
`;

export async function main(args=process.argv.slice(2),env=process.env,{inspect=snapshot,makeConnection,makeKeeper,signal}={}){
  assert.ok(args.length<=2,'Unknown arguments; use --help');
  if(args[0]==='--help'){assert.equal(args.length,1);console.log(help);return;}
  if(args[0]==='--new-wallet'){assert.equal(args.length,2,'Provide a new local wallet filename');console.log(JSON.stringify({mode:'created-unfunded-gas-wallet',publicKey:newGasWallet(path.resolve(args[1])),warning:'No recovery phrase is printed; protect this file. Fund only a small gas allowance.'}));return;}
  assert.ok(!args.length||(args.length===1&&['--check','--execute','--status','--reconcile'].includes(args[0])),'Unknown arguments; use --help');
  const directory=path.resolve(env.DUSD_KEEPER_STATE??'./state');
  if(args[0]==='--status'){
    const file=path.join(directory,'journal.json'),j=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
    const result={mode:'local-status',healthy:!!j.lastRun&&!j.pending,pending:j.pending?{signature:j.pending.signature,lastValidBlockHeight:j.pending.lastValidBlockHeight}:null,lastRun:j.lastRun??null,lastWait:j.lastWait??null,keyAccessed:false};
    console.log(JSON.stringify(result));return result;
  }
  const execute=args[0]==='--execute',url=env.SOLANA_RPC_URL??'https://api.mainnet-beta.solana.com';
  const validateUrl=value=>{const p=new URL(value);assert.equal(p.protocol,'https:','Use an HTTPS mainnet RPC');assert.ok(!p.username&&!p.password,'Do not embed HTTP user credentials');return p;};
  const parsed=validateUrl(url);
  const connection=(endpoint,writes)=>{
    let queue=Promise.resolve(),last=0;
    const paced=(input,init)=>{const work=queue.then(async()=>{signal?.throwIfAborted();const method=JSON.parse(init.body).method;assert.ok(method.startsWith('get')||(writes&&['simulateTransaction','sendTransaction'].includes(method)),'Unexpected RPC method');await new Promise(r=>setTimeout(r,Math.max(0,last+750-Date.now())));signal?.throwIfAborted();last=Date.now();return fetch(input,{...init,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});});queue=work.catch(()=>{});return work;};
    return new web3.Connection(endpoint,{commitment:'finalized',disableRetryOnRateLimit:true,fetch:paced});
  };
  const c=makeConnection?makeConnection():connection(url,execute);
  assert.equal(await c.getGenesisHash(),'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d','Not Solana mainnet');
  const state=await inspect(c);assertMigrated(state.sharing);
  const summary={mode:execute?'execute':'read-only-check',slot:state.slot,adminRevoked:state.sharing.admin_revoked,shares:state.sharing.shareholders,treasuryLamports:state.native.toString(),spendableLamports:(state.native>state.rent?state.native-state.rent:0n).toString(),creatorFeesLamports:state.fees.toString(),dusdRaw:state.dusd.toString(),wsolRaw:state.wsol.toString(),keyAccessed:false};
  const reconcile=args[0]==='--reconcile';
  if(!execute&&!reconcile){console.log(JSON.stringify(summary));return summary;}
  if(execute)assert.ok(env.KEEPER_KEYPAIR,'Set KEEPER_KEYPAIR to your own gas-only JSON keypair');
  const recoveryUrl=env.SOLANA_RECOVERY_RPC_URL??'https://solana-rpc.publicnode.com';
  assert.notEqual(validateUrl(recoveryUrl).hostname,parsed.hostname,'Recovery RPC must use a distinct provider hostname');
  const recoveryConnection=connection(recoveryUrl,false);
  let unlock,key;
  try{
    unlock=await acquireLock(directory);signal?.throwIfAborted();
    if(execute){key=readGasSigner(path.resolve(env.KEEPER_KEYPAIR));assert.ok(![ids.treasury,'Ei8d6LZSjbzQ4v9EMBLJSpp2NfVUdckJ39sBXDmNRzSq','FzPw22y8fMnsFYBnXh2p6sfsFzTHYLtLMWybS9d2RS2q'].includes(key.publicKey.toBase58()),'Privileged or retired identities forbidden');}
    const {Keeper}=await import('./runner.mjs');
    const options={connection:c,recoveryConnection,signer:key,stateDirectory:directory,signal,priorityMicroLamports:Number(env.KEEPER_PRIORITY_MICROLAMPORTS??1000),maxDebitLamports:Number(env.KEEPER_MAX_DEBIT_LAMPORTS??5000000)};
    const keeper=makeKeeper?makeKeeper(options):new Keeper(options);
    let result;
    if(reconcile){const j=keeper.read(),done=await keeper.recover(j);result={mode:'reconcile-only',healthy:done,outcome:done?'reconciled':'awaiting-signature-review',pending:j.pending?.signature??null,keyAccessed:false};}
    else result=await keeper.once({initialState:state});
    console.log(JSON.stringify(result));return result;
  }finally{disposeSigner(key);await unlock?.();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const stop=new AbortController();let signalCode;
  const term=()=>{signalCode=143;stop.abort(new Error('Shutdown requested; pending state preserved'));};
  const interrupt=()=>{signalCode=130;stop.abort(new Error('Interrupted; pending state preserved'));};
  process.once('SIGTERM',term);process.once('SIGINT',interrupt);
  try{const r=await main(undefined,undefined,{signal:stop.signal});if(r?.healthy===false)process.exitCode=2;}
  catch(e){console.error(JSON.stringify({outcome:'refused-or-failed',reason:String(e.message).replace(/https?:\/\/\S+/g,'[RPC URL REDACTED]').slice(0,500)}));process.exitCode=signalCode??1;}
  finally{process.removeListener('SIGTERM',term);process.removeListener('SIGINT',interrupt);}
}
