import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {web3,token} from '../deps.mjs';import {ids,pk,MIN,pda} from '../builders.mjs';
import {validateBuild,routerInstruction,canonicalAlternative,ROUTER,callerFundedPreparation} from '../jupiter.mjs';
import {Keeper,SimulationRejected} from '../runner.mjs';
import crypto from 'node:crypto';
function fixture(){const data=Buffer.alloc(40);crypto.createHash('sha256').update('global:route_v2').digest().copy(data,0,0,8);data.writeBigUInt64LE(MIN,8);data.writeBigUInt64LE(999999n,16);data.writeUInt32LE(1,30);data[34]=193;Buffer.from([16,39,0,1]).copy(data,36);
 const accounts=[ids.treasury,ids.quote,ids.base,token.NATIVE_MINT.toBase58(),ids.mint,token.TOKEN_PROGRAM_ID.toBase58(),token.TOKEN_PROGRAM_ID.toBase58(),ids.base,pda(ROUTER,'__event_authority').toBase58(),ROUTER,ids.amm,ids.pool].map(pubkey=>({pubkey,isSigner:pubkey===ids.treasury,isWritable:true}));
 return {inputMint:token.NATIVE_MINT.toBase58(),outputMint:ids.mint,inAmount:MIN.toString(),swapMode:'ExactIn',routePlan:[{bps:10000,swapInfo:{ammKey:ids.pool,inputMint:token.NATIVE_MINT.toBase58(),outputMint:ids.mint}}],swapInstruction:{programId:ROUTER,data:data.toString('base64'),accounts}};
}
test('canonical builder forwards only PDA signer privileges internally, not as outer signatures',()=>{const b=fixture(),payer=web3.Keypair.generate().publicKey,ix=routerInstruction(payer,b,MIN);assert.equal(ix.programId.toBase58(),ids.program);assert.deepEqual(ix.keys.filter(k=>k.isSigner).map(k=>k.pubkey.toBase58()),[payer.toBase58()]);assert.equal(validateBuild(b,MIN).readBigUInt64LE(8),MIN);});
for(const[name,edit]of [['pool',b=>b.routePlan[0].swapInfo.ammKey=web3.PublicKey.default.toBase58()],['mint',b=>b.outputMint=token.NATIVE_MINT.toBase58()],['split',b=>b.routePlan[0].bps=5000],['multihop',b=>b.routePlan.push(b.routePlan[0])],['router',b=>b.swapInstruction.programId=ids.amm],['signer',b=>b.swapInstruction.accounts[1].isSigner=true],['stale input',b=>b.inAmount='9999999'],['fee',b=>{const d=Buffer.from(b.swapInstruction.data,'base64');d.writeUInt16LE(1,26);b.swapInstruction.data=d.toString('base64');}]])test('builder rejects '+name,()=>{const b=fixture();edit(b);assert.throws(()=>validateBuild(b,MIN));});
test('API setup/cleanup is ignored and setup is generated as caller-funded fixed instructions',async()=>{
 const b=fixture();b.setupInstructions=[{programId:'malicious'}];b.cleanupInstruction={programId:'malicious'};
 let seen;const ixs=await canonicalAlternative(null,{native:MIN+1n,rent:1n,accounts:{}},web3.Keypair.generate().publicKey,{fetcher:async u=>{seen=u;return {ok:true,text:async()=>JSON.stringify(b)};}});
 assert.equal(seen.searchParams.get('dexes'),'Pump.fun Amm');assert.equal(seen.searchParams.get('onlyDirectRoutes'),'true');assert.equal(ixs.length,3);assert.equal(ixs[0].programId.toBase58(),ids.amm);assert.equal(ixs[1].programId.toBase58(),ids.amm);assert.equal(ixs[2].programId.toBase58(),ids.program);
});
test('existing accumulator needs no extra initialization',()=>assert.equal(callerFundedPreparation(web3.Keypair.generate().publicKey).length,1));
const sharing={version:2,status:'Active',admin_revoked:true,shareholders:[{address:ids.treasury,share_bps:10000}]},s={sharing,native:MIN+650240n,rent:650240n,fees:0n,wsol:0n,dusd:0n,slot:1};
for(const mode of ['unsigned-rejection','network-error','pending-wire','raced-balance','fallback-rejected'])test('alternative orchestration '+mode,async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dusd-jupiter-keeper-test-'));try{
  let alternatives=0;const calls=[],payer=web3.Keypair.generate();
  const k=new Keeper({connection:{getBalance:async()=>1000000},signer:payer,stateDirectory:dir,inspect:async()=>mode==='raced-balance'?{...s,native:s.rent}:s,feeRecipient:async()=>pk(ids.poolQuote),alternative:async()=>{alternatives++;return []}});
  k.submit=async(kind,_ixs,j)=>{calls.push(kind);if(kind==='buy-and-full-burn'){if(mode==='network-error')throw Error('Network timeout');if(mode==='pending-wire'){j.pending={signature:'unknown'};k.save(j);}throw new SimulationRejected('Simulation rejected');}if(mode==='fallback-rejected')throw new SimulationRejected('Alternative rejected');};
  if(['unsigned-rejection','raced-balance'].includes(mode))await k.once({initialState:s});
  else if(mode==='fallback-rejected'){const r=await k.once({initialState:s});assert.equal(r.healthy,false);assert.equal(r.outcome,'blocked');}
  else await assert.rejects(k.once({initialState:s}));
  assert.equal(alternatives,['unsigned-rejection','fallback-rejected'].includes(mode)?1:0);
  assert.equal(calls.length,['unsigned-rejection','fallback-rejected'].includes(mode)?2:1);
 }finally{assert.ok(path.basename(dir).startsWith('dusd-jupiter-keeper-test-'));fs.rmSync(dir,{recursive:true});}
});
