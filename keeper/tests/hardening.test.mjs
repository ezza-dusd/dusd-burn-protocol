import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Keeper} from '../runner.mjs';
import {main,acquireLock} from '../cli.mjs';
import {buyBurn,pk,ids} from '../builders.mjs';
import {web3,bs58} from '../deps.mjs';
import {installRuntime,runtimeFiles} from '../scripts/install-runtime.mjs';
const MAINNET='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';
const fixture=()=>fs.mkdtempSync(path.join(os.tmpdir(),'dusd-hardened-keeper-'));
function clean(dir){assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('dusd-hardened-keeper-'));fs.rmSync(dir,{recursive:true,force:true});}
const recipient=pk('HjQjngTDqoHE6aaGhUqfz9aQ7WZcBRjy5xB8PScLSr8i');
const sharing={version:2,status:'Active',admin_revoked:true,shareholders:[{address:ids.treasury,share_bps:10000}]};
const state={slot:1,sharing,native:650240n,rent:650240n,fees:0n,dusd:0n,wsol:0n};
function rpc({height=20,slot=100,status=null,receipt=null,statusSlot=slot}={}){
 return {getGenesisHash:async()=>MAINNET,getBlockHeight:async()=>height,getSlot:async()=>slot,
 getSignatureStatuses:async()=>({context:{slot:statusSlot},value:[status]}),getTransaction:async()=>receipt};
}
const pending=()=>({transactions:[],pending:{signature:'test-signature',lastValidBlockHeight:10,at:new Date().toISOString()}});

test('expiry requires both independent configured observations and archives rather than counts a burn',async()=>{
 const dir=fixture();try{
 const k=new Keeper({connection:rpc(),recoveryConnection:rpc(),stateDirectory:dir});const j=pending();
 assert.equal(await k.recover(j),true);assert.equal(j.pending,undefined);assert.equal(j.transactions[0].status,'expired-unobserved');
 assert.equal(j.transactions[0].resolution.evidence.length,2);assert.equal(j.transactions[0].receipt,undefined);
 }finally{clean(dir);}
});
for(const [name,second] of [
 ['lagging status context',()=>rpc({statusSlot:99})],
 ['still valid on second provider',()=>rpc({height:10})],
 ['confirmed receipt on second provider',()=>rpc({status:{confirmationStatus:'confirmed',err:null}})],
 ['receipt without status',()=>rpc({receipt:{slot:1}})]
])test('expiry does not discard evidence when '+name,async()=>{
 const dir=fixture();try{
 const k=new Keeper({connection:rpc(),recoveryConnection:second(),stateDirectory:dir});const j=pending();
 assert.equal(await k.recover(j),false);assert.ok(j.pending);assert.equal(j.transactions.length,0);assert.equal(j.lastWait.requiresReview,true);
 }finally{clean(dir);}
});
test('RPC errors preserve the pending journal',async()=>{
 const dir=fixture();try{
 const second=rpc();second.getTransaction=async()=>{throw Error('history unavailable');};
 const k=new Keeper({connection:rpc(),recoveryConnection:second,stateDirectory:dir}),j=pending();k.save(j);
 await assert.rejects(k.recover(j),/history unavailable/);assert.ok(k.read().pending);assert.equal(k.read().transactions.length,0);
 }finally{clean(dir);}
});
test('finalized receipt must belong to the recorded signature',async()=>{
 const dir=fixture();try{
 const k=new Keeper({connection:rpc({status:{confirmationStatus:'finalized',err:null},receipt:{transaction:{signatures:['other']},meta:{err:null}}}),stateDirectory:dir}),j=pending();
 await assert.rejects(k.recover(j),/does not match/);assert.ok(j.pending);
 }finally{clean(dir);}
});
test('after expired reconciliation a new finalized snapshot is read before deciding work',async()=>{
 const dir=fixture();try{
 let reads=0;const k=new Keeper({connection:rpc(),recoveryConnection:rpc(),signer:web3.Keypair.generate(),stateDirectory:dir,inspect:async()=>{reads++;return state;}});
 k.save(pending());const r=await k.once({initialState:{...state,native:10650240n}});
 assert.equal(reads,1);assert.equal(r.outcome,'no-eligible-work');assert.equal(r.transactions,0);
 }finally{clean(dir);}
});

function submitFixture(dir,{simulationError=null,debit=5400,owner=web3.SystemProgram.programId.toBase58(),omitAccount=false,abort}={}){
 const signer=web3.Keypair.generate();let emitted=false,sends=0,signature;
 const c={...rpc(),getLatestBlockhash:async()=>({blockhash:web3.PublicKey.default.toBase58(),lastValidBlockHeight:10}),getBalance:async()=>10000000,
 simulateTransaction:async(tx,config)=>{
   assert.equal(config.sigVerify,false);assert.ok(tx.signatures.every(s=>s.every(b=>b===0)));assert.equal(fs.existsSync(path.join(dir,'journal.json')),false);
   assert.deepEqual(config.accounts.addresses,[signer.publicKey.toBase58()]);abort?.abort();
   return {value:{err:simulationError,accounts:omitAccount?null:[{lamports:10000000-debit,owner}]}};
 },sendRawTransaction:async(wire,config)=>{
   sends++;const tx=web3.Transaction.from(wire);assert.equal(tx.verifySignatures(),true);signature=bs58.encode(tx.signature);
   const j=JSON.parse(fs.readFileSync(path.join(dir,'journal.json'),'utf8'));
   assert.equal(j.pending.signature,signature);assert.equal(j.pending.wireBase64,wire.toString('base64'));assert.equal(config.maxRetries,3);emitted=true;return signature;
 },getSignatureStatuses:async()=>({context:{slot:1},value:[{confirmationStatus:'finalized',err:null}]}),
 getTransaction:async()=>({slot:1,transaction:{signatures:[signature]},meta:{err:null,fee:5400,computeUnitsConsumed:88000}})};
 const k=new Keeper({connection:c,signer,stateDirectory:dir,signal:abort?.signal});
 return {k,signer,result:()=>({emitted,sends})};
}
test('unsigned simulation precedes signing; durable signed wire precedes first broadcast; receipt counted once',async()=>{
 const dir=fixture();try{
 const f=submitFixture(dir);const j={transactions:[]};await f.k.submit('buy-and-full-burn',[buyBurn(f.signer.publicKey,recipient)],j);
 assert.equal(f.result().emitted,true);assert.equal(j.transactions.length,1);assert.equal(j.transactions[0].status,'finalized');assert.equal(j.pending,undefined);
 await f.k.recover(j);assert.equal(j.transactions.length,1);
 }finally{clean(dir);}
});
for(const [name,options,message] of [
 ['excessive debit',{debit:5000001},/exceeds approved budget/],
 ['missing caller account',{omitAccount:true},/missing caller balance/],
 ['changed caller owner',{owner:ids.program},/changes gas-wallet ownership/],
 ['rejected simulation',{simulationError:{InstructionError:[0,'test']}},/Simulation rejected/]
])test('no signature exposure or broadcast on '+name,async()=>{
 const dir=fixture();try{const f=submitFixture(dir,options);await assert.rejects(f.k.submit('buy-and-full-burn',[buyBurn(f.signer.publicKey,recipient)],{transactions:[]}),message);assert.equal(f.result().sends,0);assert.equal(fs.existsSync(f.k.file),false);}finally{clean(dir);}
});
test('shutdown during simulation stops before signing and broadcasting',async()=>{
 const dir=fixture();try{const abort=new AbortController(),f=submitFixture(dir,{abort});await assert.rejects(f.k.submit('buy-and-full-burn',[buyBurn(f.signer.publicKey,recipient)],{transactions:[]}));assert.equal(f.result().sends,0);assert.equal(fs.existsSync(f.k.file),false);}finally{clean(dir);}
});
test('send error preserves the signed pending record for reconciliation',async()=>{
 const dir=fixture();try{const f=submitFixture(dir);f.k.c.sendRawTransaction=async()=>{assert.ok(f.k.read().pending);throw Error('network after possible submission');};await assert.rejects(f.k.submit('buy-and-full-burn',[buyBurn(f.signer.publicKey,recipient)],{transactions:[]}),/network after possible/);assert.ok(f.k.read().pending.wireBase64);}finally{clean(dir);}
});
test('bounded priority fee and caller debit settings reject invalid values',()=>{
 for(const price of [-1,25001,NaN,1.5])assert.throws(()=>new Keeper({stateDirectory:'.',priorityMicroLamports:price}),/Priority price/);
 for(const budget of [1,NaN,Infinity,1.5])assert.throws(()=>new Keeper({stateDirectory:'.',maxDebitLamports:budget}),/Invalid maximum/);
});
test('one pre-key safety snapshot is reused on a healthy idle cycle',async()=>{
 const dir=fixture();try{
 let reads=0;const k=new Keeper({connection:{getGenesisHash:()=>{throw Error('duplicate genesis read');}},signer:web3.Keypair.generate(),stateDirectory:dir,inspect:()=>{reads++;throw Error('duplicate snapshot');}});
 const r=await k.once({initialState:state});assert.equal(r.outcome,'no-eligible-work');assert.equal(reads,0);
 }finally{clean(dir);}
});
test('local status reads no key, makes no RPC and exposes no signed wire',async()=>{
 const dir=fixture();try{
 fs.writeFileSync(path.join(dir,'journal.json'),JSON.stringify({...pending(),lastRun:{at:'test'},lastWait:{requiresReview:true}}));
 const r=await main(['--status'],{DUSD_KEEPER_STATE:dir,KEEPER_KEYPAIR:'must-not-open'},{makeConnection:()=>{throw Error('must not connect');}});
 assert.equal(r.keyAccessed,false);assert.equal(r.healthy,false);assert.equal(JSON.stringify(r).includes('wireBase64'),false);
 }finally{clean(dir);}
});
test('kernel exclusion survives metadata deletion and releases after a killed process',async()=>{
 const dir=fixture();let child;try{
 const script=`import {acquireLock} from ${JSON.stringify(new URL('../lock.mjs',import.meta.url).href)};await acquireLock(${JSON.stringify(dir)});console.log('ready');setInterval(()=>{},1000);`;
 child=spawn(process.execPath,['--input-type=module','-e',script],{stdio:['ignore','pipe','pipe'],windowsHide:true});
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('child timeout')),10000);child.once('error',e=>{clearTimeout(t);reject(e);});child.stdout.once('data',()=>{clearTimeout(t);resolve();});});
 fs.unlinkSync(path.join(dir,'run.lock'));await assert.rejects(acquireLock(dir),e=>e.code==='EEXIST');
 const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await exited;
 const release=await acquireLock(dir);await release();assert.equal(fs.existsSync(path.join(dir,'run.lock')),false);
 }finally{child?.kill();clean(dir);}
});
test('kernel lock recovers stale diagnostic metadata without removing a pending journal',async()=>{
 const dir=fixture();try{
 fs.writeFileSync(path.join(dir,'run.lock'),JSON.stringify({kind:'kernel-ipc-v1',pid:123,nonce:'old'}));
 const marker=JSON.stringify(pending());fs.writeFileSync(path.join(dir,'journal.json'),marker);
 const release=await acquireLock(dir);assert.equal(fs.readFileSync(path.join(dir,'journal.json'),'utf8'),marker);await release();
 }finally{clean(dir);}
});

function installerFixture(dir){
 const repo=path.join(dir,'repo'),source=path.join(repo,'keeper');fs.mkdirSync(source,{recursive:true});
 for(const file of runtimeFiles){fs.mkdirSync(path.dirname(path.join(source,file)),{recursive:true});fs.copyFileSync(fileURLToPath(new URL('../'+file,import.meta.url)),path.join(source,file));}
 assert.equal(spawnSync('git',['init','--quiet',repo],{windowsHide:true}).status,0);
 assert.equal(spawnSync('git',['add','keeper'],{cwd:repo,windowsHide:true}).status,0);return source;
}
test('installer copies only runtime allowlist and never node_modules or private data',()=>{
 const dir=fixture();try{
 const source=installerFixture(dir);fs.mkdirSync(path.join(source,'node_modules'));fs.writeFileSync(path.join(source,'node_modules','not-copied'),'test');
 const dest=path.join(dir,'out'),r=installRuntime(source,dest,{requireRoot:false});assert.equal(r.files,runtimeFiles.length);
 assert.equal(fs.existsSync(path.join(dest,'keeper','node_modules')),false);assert.equal(fs.existsSync(path.join(dest,'keeper','gas.json')),false);
 assert.throws(()=>installRuntime(source,dest,{requireRoot:false}),/already exists/);
 }finally{clean(dir);}
});
for(const file of ['gas.json','keeper-gas.json','rpc.env','state/journal.json'])test('installer refuses contaminated source containing '+file,()=>{
 const dir=fixture();try{
 const source=installerFixture(dir),bad=path.join(source,file);fs.mkdirSync(path.dirname(bad),{recursive:true});fs.writeFileSync(bad,'nonsecret test sentinel');
 const dest=path.join(dir,'out');assert.throws(()=>installRuntime(source,dest,{requireRoot:false}),/Unexpected/);assert.equal(fs.existsSync(dest),false);
 }finally{clean(dir);}
});
