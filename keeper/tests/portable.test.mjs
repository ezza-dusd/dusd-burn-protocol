import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {main,newGasWallet,acquireLock,readGasSigner} from '../cli.mjs';
import {Keeper} from '../runner.mjs';
import {web3} from '../deps.mjs';
import {ids,MIN,APPROVED_HASH,plan,assertMigrated,collection,buyBurn,burn,unwrap,pk} from '../builders.mjs';
const sharing={version:2,status:'Active',admin_revoked:true,shareholders:[{address:ids.treasury,share_bps:10000}]};
const state=(extra={})=>({slot:1,sharing,native:650240n,rent:650240n,fees:0n,dusd:0n,wsol:0n,...extra});
const fixture=()=>fs.mkdtempSync(path.join(os.tmpdir(),'dusd-public-keeper-'));
const finish=dir=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('dusd-public-keeper-'));fs.rmSync(dir,{recursive:true,force:true});};
const buyback=pk('HjQjngTDqoHE6aaGhUqfz9aQ7WZcBRjy5xB8PScLSr8i');

test('copied tested modules and IDLs retain their hashes',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../UPSTREAM-COPY-MANIFEST.json',import.meta.url)));
 for(const {file,sha256}of manifest.files)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),sha256,file);
 assert.equal(APPROVED_HASH,'39cccb5c353c4b519aec1f2397c7dc068b3e492c83a3cdfc5a309cddaf8f9659');
});
test('wallet generation is local, refuses overwrite and prints no key material',()=>{
 const dir=fixture();try{const file=path.join(dir,'gas.json'),address=newGasWallet(file);assert.equal(readGasSigner(file).publicKey.toBase58(),address);assert.throws(()=>newGasWallet(file),/EEXIST/);if(process.platform!=='win32')assert.equal(fs.statSync(file).mode&0o077,0);}finally{finish(dir);}
});
test('single-writer lock is exclusive and releases normally',async()=>{
 const dir=fixture();try{const release=await acquireLock(dir);await assert.rejects(acquireLock(dir),e=>e.code==='EEXIST');await release();await(await acquireLock(dir))();}finally{finish(dir);}
});
test('gas signer refuses invalid key arrays',()=>{
 const dir=fixture();try{const file=path.join(dir,'bad.json');fs.writeFileSync(file,'[1,2]',{mode:0o600});assert.throws(()=>readGasSigner(file),/64 bytes/);const marker='DO_NOT_ECHO_WALLET_CONTENT';fs.writeFileSync(file,marker);assert.throws(()=>readGasSigner(file),e=>e.message.includes('64 bytes')&&!e.message.includes(marker));}finally{finish(dir);}
});
test('check and default modes never open the configured wallet',async()=>{
 const env={KEEPER_KEYPAIR:'this-file-does-not-exist'};
 for(const args of [[],['--check']]){const r=await main(args,env,{makeConnection:()=>({getGenesisHash:async()=>'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'}),inspect:async()=>state()});assert.equal(r.keyAccessed,false);assert.equal(r.mode,'read-only-check');}
});
test('wrong network refuses before inspection or key loading',async()=>{
 await assert.rejects(main(['--execute'],{KEEPER_KEYPAIR:'absent'},{makeConnection:()=>({getGenesisHash:async()=>'devnet'}),inspect:()=>{throw Error('must not inspect');}}),/Not Solana mainnet/);
});
test('wrong fee sharing refuses before gas key loading',async()=>{
 await assert.rejects(main(['--execute'],{KEEPER_KEYPAIR:'absent'},{makeConnection:()=>({getGenesisHash:async()=>'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'}),inspect:async()=>state({sharing:{...sharing,admin_revoked:false}})}),/not finalized/);
});
test('portable execute path releases its lock on failure and clears signer bytes',async()=>{
 const dir=fixture();try{const file=path.join(dir,'gas.json');newGasWallet(file);let heldKey;
 await assert.rejects(main(['--execute'],{KEEPER_KEYPAIR:file,DUSD_KEEPER_STATE:path.join(dir,'state')},{makeConnection:()=>({getGenesisHash:async()=>'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'}),inspect:async()=>state(),makeKeeper:({signer})=>{heldKey=signer;return{once:async()=>{throw Error('mock failure');}};}}),/mock failure/);
 assert.equal(fs.existsSync(path.join(dir,'state/run.lock')),false);assert.ok(heldKey.secretKey.every(b=>b===0));
 }finally{finish(dir);}
});
test('unknown arguments and insecure RPC refuse',async()=>{await assert.rejects(main(['--deploy']),/Unknown arguments/);await assert.rejects(main(['--check'],{SOLANA_RPC_URL:'http://example.com'}),/HTTPS/);});
for(const [label,changes]of [['not revoked',{admin_revoked:false}],['wrong allocation',{shareholders:[{address:ids.treasury,share_bps:9999}]}],['alternate recipient',{shareholders:[{address:web3.PublicKey.default.toBase58(),share_bps:10000}]}],['wrong version',{version:1}],['inactive',{status:'Inactive'}]])test('sharing guard: '+label,()=>assert.throws(()=>assertMigrated({...sharing,...changes})));
for(const [label,s,expected]of [['idle',state(),[]],['dust fees',state({fees:1n}),[]],['below threshold',state({native:650240n+MIN-1n}),[]],['exact threshold',state({native:650240n+MIN}),['buy']],['combined eligibility',state({native:650241n,fees:MIN-1n}),['collect']],['standalone without SOL',state({native:0n,dusd:1n}),['burn']],['large balance',state({native:650240n+1000000000000n}),['buy']],['WSOL recovery',state({wsol:MIN}),['unwrap']],['WSOL dust',state({wsol:MIN-1n}),[]]])test('plan: '+label,()=>assert.deepEqual(plan(s),expected));
test('all recurring instruction signers are only the external caller',()=>{
 const caller=web3.Keypair.generate().publicKey;
 const instructions=[...collection(caller),buyBurn(caller,buyback),burn(caller),unwrap(caller)];
 for(const ix of instructions)for(const account of ix.keys.filter(k=>k.isSigner))assert.ok(account.pubkey.equals(caller));
 assert.equal(instructions.length,7);
});
test('pending unknown signature blocks replacement and survives expiry',async()=>{
 const dir=fixture();try{const keeper=new Keeper({stateDirectory:dir,signer:web3.Keypair.generate(),connection:{getSignatureStatuses:async()=>({value:[null]}),getBlockHeight:async()=>20}});const journal={transactions:[],pending:{signature:'existing',lastValidBlockHeight:10}};assert.equal(await keeper.recover(journal),false);assert.equal(keeper.read().pending.signature,'existing');assert.equal(journal.lastWait.requiresReview,true);}finally{finish(dir);}
});
for(const failed of [false,true])test('finalized '+(failed?'failure is not counted as a burn':'success reconciles once'),async()=>{
 const dir=fixture();try{const error=failed?{InstructionError:[1,{Custom:6004}]}:null;const keeper=new Keeper({stateDirectory:dir,signer:web3.Keypair.generate(),connection:{getSignatureStatuses:async()=>({value:[{confirmationStatus:'finalized',err:error}]}),getTransaction:async()=>({slot:1,transaction:{signatures:['existing']},meta:{err:error,fee:5000,computeUnitsConsumed:10}})}});const journal={transactions:[],pending:{signature:'existing'}};
 if(failed)await assert.rejects(keeper.recover(journal));else assert.equal(await keeper.recover(journal),true);
 assert.equal(journal.transactions[0].status,failed?'failed':'finalized');assert.equal(journal.pending,undefined);await keeper.recover(journal);assert.equal(journal.transactions.length,1);
 }finally{finish(dir);}
});
test('rejected simulation sends nothing',async()=>{
 const dir=fixture();try{const signer=web3.Keypair.generate();let sent=false;const keeper=new Keeper({stateDirectory:dir,signer,connection:{getBalance:async()=>1000000,getLatestBlockhash:async()=>({blockhash:web3.PublicKey.default.toBase58(),lastValidBlockHeight:10}),simulateTransaction:async()=>({value:{err:{InstructionError:[1,{Custom:6004}]}}}),sendRawTransaction:()=>{sent=true;}}});await assert.rejects(keeper.submit('buy-and-full-burn',[buyBurn(signer.publicKey,buyback)],{transactions:[]}),/Simulation rejected/);assert.equal(sent,false);assert.equal(fs.existsSync(keeper.file),false);}finally{finish(dir);}
});
for(const [label,states,kinds]of [['collect then buy',[state({fees:MIN}),state({native:650240n+MIN}),state()],['collect','buy-and-full-burn']],['another caller already burned',[state({fees:MIN}),state()],['collect']],['standalone donation',[state({native:0n,dusd:1n}),state()],['standalone-full-burn']],['unwrap then collect then buy',[state({wsol:MIN,fees:MIN}),state({native:650240n+MIN,fees:MIN}),state({native:650240n+2n*MIN}),state()],['unwrap','collect','buy-and-full-burn']]])test('coordinator: '+label,async()=>{
 const dir=fixture();try{let at=0;const actual=[];const keeper=new Keeper({stateDirectory:dir,signer:web3.Keypair.generate(),inspect:async()=>states[at],feeRecipient:async()=>buyback,connection:{getGenesisHash:async()=>'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',getBalance:async()=>1000000}});keeper.submit=async kind=>{actual.push(kind);at++;};const r=await keeper.once();assert.deepEqual(actual,kinds);assert.equal(r.transactions,kinds.length);}finally{finish(dir);}
});
