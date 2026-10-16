// LiteSVM RPC adapter for the Node test suite. Binds ONLY loopback. The Rust
// process contains real Solana execution; this adapter only formats RPC replies.
import fs from 'node:fs';import http from 'node:http';import readline from 'node:readline';import {spawn} from 'node:child_process';
import {WebSocketServer} from 'ws';import bs58 from 'bs58';import {web3} from './deps.mjs';
import {verifyArtifacts} from './artifacts.mjs';
verifyArtifacts(); // Reject corrupted/mixed upstream snapshots before starting the VM.
const root=fs.realpathSync(new URL('../',import.meta.url));
const executable=process.platform==='win32'?root+'/harness/target/debug/dusd-svm-harness.exe':root+'/harness/target/debug/dusd-svm-harness';
if(!fs.existsSync(executable))throw new Error('Build the local LiteSVM harness first.');
const vm=spawn(executable,[root],{stdio:['pipe','pipe','inherit'],windowsHide:true});
const pending=new Map(),records=new Map();let nextId=1;
const ready=new Promise((resolve,reject)=>{
 const lines=readline.createInterface({input:vm.stdout});
 lines.on('line',line=>{const v=JSON.parse(line);if(v.ready)resolve(v);else {const p=pending.get(v.id);if(p){pending.delete(v.id);p(v.result);}}});
 vm.once('exit',code=>{if(code)reject(new Error('Local VM process failed: '+code));});
});
const ask=(method,values={})=>new Promise(resolve=>{const id=nextId++;pending.set(id,resolve);vm.stdin.write(JSON.stringify({id,method,...values})+'\n');});
await ready;
const ctx=value=>({context:{slot:1,apiVersion:'4.3.0'},value});
function txRecord(wire,r){
 const tx=web3.Transaction.from(Buffer.from(wire,'base64')),m=tx.compileMessage();
 return {slot:1,blockTime:0,meta:{err:r.error,fee:r.fee,computeUnitsConsumed:r.computeUnits,logMessages:r.logs,
  preBalances:m.accountKeys.map(()=>0),postBalances:m.accountKeys.map(()=>0),preTokenBalances:[],postTokenBalances:[],innerInstructions:[],rewards:[]},
  transaction:{signatures:tx.signatures.map(s=>bs58.encode(s.signature)),message:{header:m.header,accountKeys:m.accountKeys.map(k=>k.toBase58()),recentBlockhash:m.recentBlockhash,instructions:m.instructions}},version:'legacy'};
}
async function rpc(method,p){
 switch(method){
  case 'getVersion':return {'solana-core':'4.3.0-local-LiteSVM-0.18.0','feature-set':0};
  case 'getGenesisHash':return '11111111111111111111111111111111';
  case 'getLatestBlockhash':return ctx({blockhash:await ask('blockhash'),lastValidBlockHeight:10000});
  case 'getBlockHeight':return 1;
  case 'getSlot':return 1;
  case 'getMinimumBalanceForRentExemption':return ask('rent',{bytes:p[0]});
  case 'getBalance':return ctx((await ask('accounts',{addresses:[p[0]]}))[0]?.lamports??0);
  case 'getAccountInfo':return ctx((await ask('accounts',{addresses:[p[0]]}))[0]);
  case 'getMultipleAccounts':return ctx(await ask('accounts',{addresses:p[0]}));
  case 'requestAirdrop':{const r=await ask('airdrop',{address:p[0],lamports:p[1]});if(r.error)throw new Error(JSON.stringify(r.error));records.set(r.signature,{error:null});return r.signature;}
  case 'sendTransaction':{const r=await ask('send',{transaction:p[0]});if(!r.signature)throw new Error(JSON.stringify(r));records.set(r.signature,{...r,record:txRecord(p[0],r)});return r.signature;}
  case 'getSignatureStatuses':return ctx(p[0].map(s=>records.has(s)?{slot:1,confirmations:null,err:records.get(s).error,confirmationStatus:'confirmed'}:null));
  case 'getTransaction':return records.get(p[0])?.record??null;
  default:throw new Error('Unsupported local RPC method: '+method);
 }
}
const server=http.createServer(async(req,res)=>{
 let body='';for await(const part of req)body+=part;
 let input;try{input=JSON.parse(body);const result=await rpc(input.method,input.params??[]);res.end(JSON.stringify({jsonrpc:'2.0',id:input.id,result}));}
 catch(e){res.end(JSON.stringify({jsonrpc:'2.0',id:input?.id,error:{code:-32000,message:String(e.message)}}));}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(19899,'127.0.0.1',resolve)});
const ws=new WebSocketServer({host:'127.0.0.1',port:19900});let subscription=1;
ws.on('connection',socket=>socket.on('message',raw=>{
 const msg=JSON.parse(raw);if(msg.method==='signatureSubscribe'){
  const id=subscription++;socket.send(JSON.stringify({jsonrpc:'2.0',id:msg.id,result:id}));
  setTimeout(()=>{if(socket.readyState===1)socket.send(JSON.stringify({jsonrpc:'2.0',method:'signatureNotification',params:{subscription:id,result:ctx({err:records.get(msg.params[0])?.error??null})}}));},10);
 }else socket.send(JSON.stringify({jsonrpc:'2.0',id:msg.id,result:true}));
}));
const startedAt=new Date().toISOString();let transcript='';
const child=spawn(process.execPath,['--test','--test-reporter=tap',root+'/tests/policy.test.mjs',root+'/tests/local-validator.test.mjs'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
child.stdout.on('data',chunk=>{transcript+=chunk.toString();process.stdout.write(chunk)});
child.stderr.on('data',chunk=>process.stderr.write(chunk));
const code=await new Promise(resolve=>{child.once('error',()=>resolve(1));child.once('close',resolve)});
fs.writeFileSync(root+'/research/latest-test-output.tap',transcript);
const count=name=>{const match=transcript.match(new RegExp('^# '+name+' (\\d+)\\s*$','m'));return match?Number(match[1]):null;};
fs.writeFileSync(root+'/research/test-run-summary.json',JSON.stringify({startedAt,finishedAt:new Date().toISOString(),exitCode:code,
 tests:count('tests'),passed:count('pass'),failed:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),
 engine:'LiteSVM 0.18.0',network:'loopback only',artifacts:verifyArtifacts()},null,2));
for(const socket of ws.clients)socket.terminate();ws.close();server.close();vm.stdin.end();vm.kill();process.exitCode=code??1;
