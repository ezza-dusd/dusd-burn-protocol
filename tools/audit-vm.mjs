// Isolated synthetic forks, using the EXISTING compiled LiteSVM harness.
// No RPC socket, production key, network client or contract modification.
import fs from 'node:fs';import path from 'node:path';import readline from 'node:readline';import crypto from 'node:crypto';import {spawn} from 'node:child_process';
import {web3,token} from './deps.mjs';import {inventory,PROGRAM,treasury,baseMint,baseAta,quoteAta,accumulator,buyBurnInstruction} from './client.mjs';
import {fromIdl} from './claims.mjs';import {loadIdl} from './codec.mjs';
export const ROOT=fs.realpathSync(new URL('../',import.meta.url));
const generated=path.join(ROOT,'research/lifecycle-2026-10-14/generated');fs.mkdirSync(generated,{recursive:true});
const sandbox=fs.mkdtempSync(path.join(generated,'fork-'));
for(const folder of ['research','fixtures/accounts','fixtures/programs','target/deploy'])fs.mkdirSync(path.join(sandbox,folder),{recursive:true});
for(const file of ['research/onchain-inventory.json','research/rent-sysvar.json','target/deploy/dusd_burn.so',
 'fixtures/programs/pumpProgram.so','fixtures/programs/ammProgram.so','fixtures/programs/feesProgram.so'])fs.copyFileSync(file==='target/deploy/dusd_burn.so'&&process.env.REVIEW_BURN_BINARY?process.env.REVIEW_BURN_BINARY:file==='fixtures/programs/ammProgram.so'&&process.env.REVIEW_AMM_BINARY?process.env.REVIEW_AMM_BINARY:path.join(ROOT,file),path.join(sandbox,file));
const originals=Object.fromEntries(fs.readdirSync(path.join(ROOT,'fixtures/accounts')).filter(n=>n.endsWith('.json')).map(n=>[n.slice(0,-5),JSON.parse(fs.readFileSync(path.join(ROOT,'fixtures/accounts',n)))]));
export const key=name=>new web3.PublicKey(inventory.addresses[name]);
export const floor=BigInt(inventory.rent['0']);
export const encode=value=>JSON.stringify(value,(_,v)=>typeof v==='bigint'?JSON.rawJSON(v.toString()):v);
export const decode=text=>JSON.parse(text,(k,v,ctx)=>typeof v==='number'&&!Number.isSafeInteger(v)?BigInt(ctx.source):v);
export const bytes=account=>Buffer.from(account.data[0],'base64');
export const amount=account=>bytes(account).readBigUInt64LE(64);
export function modify(fixtures,label,fn){const a=fixtures[label].account,b=bytes(a);fn(b,a);a.data[0]=b.toString('base64');}
export function reserves(fixtures,base,quote,virtual=0n){
 modify(fixtures,'poolBase',b=>b.writeBigUInt64LE(BigInt(base),64));
 modify(fixtures,'poolQuote',(b,a)=>{b.writeBigUInt64LE(BigInt(quote),64);a.lamports=b.readBigUInt64LE(113)+BigInt(quote);});
 modify(fixtures,'pool',b=>{b.writeBigUInt64LE(0n,271);b.writeBigUInt64LE(0n,279);b.writeBigUInt64LE(BigInt.asUintN(128,virtual)&((1n<<64n)-1n),245);b.writeBigUInt64LE(BigInt.asUintN(128,virtual)>>64n,253);});
}
export function oneTier(fixtures,{lp=2n,protocol=93n,creator=30n,threshold=0n,count=1}={}){
 const a=fixtures.feeConfig.account,original=bytes(a),oldCount=original.readUInt32LE(65),tail=original.subarray(69+oldCount*40);
 const b=Buffer.alloc(Math.max(original.length,69+count*40+tail.length));original.copy(b,0,0,65);b.writeUInt32LE(count,65);
 for(let i=0;i<count;i++){
   const at=69+i*40,t=BigInt(threshold)+BigInt(i);
   b.writeBigUInt64LE(t&((1n<<64n)-1n),at);b.writeBigUInt64LE(t>>64n,at+8);
   b.writeBigUInt64LE(BigInt(lp),at+16);b.writeBigUInt64LE(BigInt(protocol),at+24);b.writeBigUInt64LE(BigInt(creator),at+32);
 }
 tail.copy(b,69+count*40);a.data[0]=b.toString('base64');
}
export class AuditVM {
 static async start(edit=()=>{}){
  const caller=web3.Keypair.generate();
  const fixtures=structuredClone(originals);
  if(process.env.REVIEW_JUPITER_FIXTURES==='1'){
   const extra=path.join(ROOT,'fixtures/jupiter-canonical');
   const programs=JSON.parse(fs.readFileSync(extra+'/programs.json'));
   fs.copyFileSync(extra+'/programs.json',sandbox+'/additional-programs.json');
   fs.copyFileSync(extra+'/runtime-clock.json',sandbox+'/runtime-clock.json');
   for(const p of programs)fs.copyFileSync(extra+'/programs/'+p.file,sandbox+'/fixtures/programs/'+p.file);
   for(const name of fs.readdirSync(extra+'/accounts')){
    const item=JSON.parse(fs.readFileSync(extra+'/accounts/'+name));
    for(const[label,original]of Object.entries(fixtures))if(original.pubkey===item.pubkey)delete fixtures[label];
    // Use alphanumeric labels compatible with this isolated harness's cleanup guard.
    fixtures['jup'+item.pubkey]=item;
   }
  }
  edit(fixtures,caller.publicKey);
  // Synthetic payer funding avoids the finite LiteSVM faucet limiting stress
  // cases. Only its public address is persisted; the ephemeral key stays in RAM.
  fixtures.auditPayer={pubkey:caller.publicKey.toBase58(),account:{lamports:1_000_000_000_000_000_000n,owner:web3.SystemProgram.programId.toBase58(),data:['','base64'],executable:false,rentEpoch:0}};
  for(const fixture of Object.values(fixtures)){
   const a=fixture.account;if(a.owner!==token.TOKEN_PROGRAM_ID.toBase58()||bytes(a).length!==165)continue;
   const raw=token.AccountLayout.decode(bytes(a));
   if(raw.isNativeOption===1&&BigInt(a.lamports)<raw.isNative+raw.amount)throw new Error('Synthetic WSOL balance is not backed by lamports');
  }
  // Remove only generated per-case JSON, so extra ATA/treasury/sysvar fixtures
  // from one synthetic fork cannot contaminate another fork.
  for(const file of fs.readdirSync(path.join(sandbox,'fixtures/accounts'))){if(!/^[A-Za-z0-9]+\.json$/.test(file))throw new Error('Unexpected generated fixture');fs.unlinkSync(path.join(sandbox,'fixtures/accounts',file));}
  for(const [name,value]of Object.entries(fixtures))fs.writeFileSync(path.join(sandbox,'fixtures/accounts',name+'.json'),encode(value));
  const vm=new AuditVM();vm.fixtures=fixtures;
  const ready=new Promise((resolve,reject)=>{vm.resolveReady=resolve;vm.rejectReady=reject;});
  vm.child=spawn(process.env.DUSD_SVM_HARNESS??path.join(ROOT,'harness/target/debug/dusd-svm-harness'+(process.platform==='win32'?'.exe':'')),[sandbox],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  vm.child.stderr.on('data',chunk=>{vm.stderr=(vm.stderr??'')+chunk.toString()});
  const lines=readline.createInterface({input:vm.child.stdout});
  lines.on('line',line=>{const v=decode(line);if(v.ready)vm.resolveReady();else{const p=vm.pending.get(v.id);if(p){clearTimeout(p.timer);vm.pending.delete(v.id);p.resolve(v.result)}}});
  vm.child.once('error',e=>vm.rejectReady(e));
  vm.child.once('exit',code=>{vm.rejectReady(new Error('Local VM exited '+code+': '+(vm.stderr??'')));for(const p of vm.pending.values()){clearTimeout(p.timer);p.reject(new Error('Local VM exited'));}});
  let timer;try{await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Local VM startup timeout')),20000)})]);}catch(e){vm.close();throw e;}finally{clearTimeout(timer);}
  vm.caller=caller;return vm;
 }
 pending=new Map();id=0;
 ask(method,values={}){return new Promise((resolve,reject)=>{const id=++this.id,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Local VM request timed out: '+method));},20000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(encode({id,method,...values})+'\n');});}
 async accounts(addresses){return this.ask('accounts',{addresses:addresses.map(a=>a.toBase58())});}
 async snapshot(){const addresses=[treasury,baseMint,baseAta,quoteAta,accumulator,key('pool'),key('poolBase'),key('poolQuote'),key('buybackAta'),key('feeConfig')];return (await this.accounts(addresses)).map(a=>a?crypto.createHash('sha256').update(encode(a)).digest('hex'):null);}
 async send(ixs,caller=this.caller,{limit=1_400_000,blockhash}={}){
  const tx=new web3.Transaction({feePayer:caller.publicKey,recentBlockhash:blockhash??await this.ask('blockhash')}).add(web3.ComputeBudgetProgram.setComputeUnitLimit({units:limit}),...ixs);tx.sign(caller);
  const wire=tx.serialize();if(wire.length>1232)throw new Error('Oversized signed packet');
  const result=await this.ask('send',{transaction:wire.toString('base64')});return {...result,bytes:wire.length};
 }
 async fund(input){
  const balance=BigInt((await this.accounts([this.caller.publicKey]))[0].lamports),needed=floor+BigInt(input)+10_000_000n;
  if(needed>balance){const minted=await this.ask('airdrop',{address:this.caller.publicKey.toBase58(),lamports:needed-balance});if(minted.error)throw new Error('Sandbox airdrop failed');}
  const old=(await this.accounts([treasury]))[0],topup=floor+BigInt(input)-(old?BigInt(old.lamports):0n);
  if(topup<0n)throw new Error('Requested treasury balance below existing balance');if(topup===0n)return;
  const r=await this.send([web3.SystemProgram.transfer({fromPubkey:this.caller.publicKey,toPubkey:treasury,lamports:topup})]);if(r.error)throw new Error('Local funding failed '+encode(r));
 }
 async buy(caller=this.caller,substitutions={}){return this.send([buyBurnInstruction(caller.publicKey,substitutions)],caller);}
 async direct(input,minimum=1n,substitutions={}){
  const caller=this.caller.publicKey,base=token.getAssociatedTokenAddressSync(baseMint,caller),quote=token.getAssociatedTokenAddressSync(token.NATIVE_MINT,caller);
  const userVolume=web3.PublicKey.findProgramAddressSync([Buffer.from('user_volume_accumulator'),caller.toBuffer()],key('ammProgram'))[0];
  const args=Buffer.alloc(16);args.writeBigUInt64LE(BigInt(input));args.writeBigUInt64LE(BigInt(minimum),8);
  const values={pool:key('pool'),user:caller,global_config:key('globalConfig'),base_mint:baseMint,quote_mint:token.NATIVE_MINT,
   user_base_token_account:base,user_quote_token_account:quote,pool_base_token_account:key('poolBase'),pool_quote_token_account:key('poolQuote'),base_token_program:token.TOKEN_PROGRAM_ID,
   quote_token_program:token.TOKEN_PROGRAM_ID,system_program:web3.SystemProgram.programId,user_volume_accumulator:userVolume,fee_config:key('feeConfig'),buyback_fee_recipient:key('buybackAta'),
   event_authority:web3.PublicKey.findProgramAddressSync([Buffer.from('__event_authority')],key('ammProgram'))[0],program:key('ammProgram'),...substitutions};
  this.tradeValues=values;
  const ix=fromIdl(loadIdl('pump_amm'),'buy_exact_quote_in_v2',values,args);
  const [before,beforeQuote]=await this.accounts([base,quote]);
  const result=await this.send([token.createAssociatedTokenAccountIdempotentInstruction(caller,base,caller,baseMint),token.createAssociatedTokenAccountIdempotentInstruction(caller,quote,caller,token.NATIVE_MINT),
   web3.SystemProgram.transfer({fromPubkey:caller,toPubkey:quote,lamports:BigInt(input)}),token.createSyncNativeInstruction(quote),ix]);
  const [after,afterQuote]=await this.accounts([base,quote]);return {...result,output:after?amount(after)-(before?amount(before):0n):0n,
   quoteSpent:result.error?0n:(beforeQuote?amount(beforeQuote):0n)+BigInt(input)-(afterQuote?amount(afterQuote):0n)};
 }
 async directSell(input){const args=Buffer.alloc(16);args.writeBigUInt64LE(BigInt(input));args.writeBigUInt64LE(1n,8);return this.send([fromIdl(loadIdl('pump_amm'),'sell_v2',this.tradeValues,args)]);}
 close(){this.child?.stdin.end();this.child?.kill();for(const p of this.pending.values()){clearTimeout(p.timer);}this.pending.clear();}
}
export function cleanSandbox(){const resolved=fs.realpathSync(sandbox),parent=fs.realpathSync(generated);if(path.dirname(resolved)!==parent||!path.basename(resolved).startsWith('fork-'))throw new Error('Unsafe generated sandbox path');fs.rmSync(resolved,{recursive:true});}
export function treasuryAtaFixture(fixtures,which){
 const isQuote=which==='quote',source=structuredClone(fixtures[isQuote?'poolQuote':'poolBase']);
 source.pubkey=(isQuote?quoteAta:baseAta).toBase58();const b=bytes(source.account);
 treasury.toBuffer().copy(b,32);b.writeBigUInt64LE(0n,64);b.writeUInt32LE(0,72);b.fill(0,76,108);b[108]=1;b.writeUInt32LE(0,129);
 // Model a newly created ATA under the pinned rent sysvar, not the older
 // native reserve stored in the historical pool vault. Legacy rent is tested
 // separately: SyncNative legitimately releases its excess into WSOL amount.
 if(isQuote)b.writeBigUInt64LE(BigInt(inventory.rent['165']),113);
 source.account.data[0]=b.toString('base64');source.account.lamports=BigInt(inventory.rent['165']);
 fixtures[which+'Ata']=source;
}
