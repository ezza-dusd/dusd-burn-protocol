// Canonical-pool-only alternative. No API setup/cleanup transaction is trusted.
import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {web3,token} from './deps.mjs';import {ids,pk,pda,fromIdl,loadIdl,MIN} from './builders.mjs';
export const ROUTER='JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
const disc=name=>crypto.createHash('sha256').update('global:'+name).digest().subarray(0,8);
export function validateBuild(b,input){
 assert.equal(b.inputMint,token.NATIVE_MINT.toBase58());assert.equal(b.outputMint,ids.mint);
 assert.equal(b.swapMode,'ExactIn');assert.equal(BigInt(b.inAmount),input);
 assert.equal(b.routePlan?.length,1,'Only one canonical-pool hop is allowed');
 const r=b.routePlan[0];assert.equal(r.swapInfo.ammKey,ids.pool);assert.equal(r.bps,10000);
 assert.equal(r.swapInfo.inputMint,token.NATIVE_MINT.toBase58());assert.equal(r.swapInfo.outputMint,ids.mint);
 const ix=b.swapInstruction;assert.equal(ix?.programId,ROUTER);assert.ok(Array.isArray(ix.accounts)&&ix.accounts.length<=64);
 // Complete verified one-hop PumpSwap encoding, not a spoofable tail check.
 // Unknown adapters/serialization require review; this is not fee/price math.
 const data=Buffer.from(ix.data,'base64');assert.equal(data.length,40,'Unsupported Jupiter route length or trailing bytes');
 assert.ok(data.subarray(0,8).equals(disc('route_v2')));assert.equal(data.readBigUInt64LE(8),input);
 assert.equal(data.readUInt32LE(26),0,'Platform and surplus fees forbidden');assert.equal(data.readUInt32LE(30),1);
 assert.equal(data[34],193,'Unsupported Jupiter adapter');assert.ok(data[35]<=1,'Invalid adapter bool');
 assert.ok(data.subarray(36,40).equals(Buffer.from([16,39,0,1])));
 const fixed=[ids.treasury,ids.quote,ids.base,token.NATIVE_MINT.toBase58(),ids.mint,token.TOKEN_PROGRAM_ID.toBase58(),token.TOKEN_PROGRAM_ID.toBase58(),ids.base,pda(ROUTER,'__event_authority').toBase58(),ROUTER];
 for(let i=0;i<fixed.length;i++)assert.equal(ix.accounts[i]?.pubkey,fixed[i]);
 for(const a of ix.accounts){pk(a.pubkey);assert.ok(!a.isSigner||a.pubkey===ids.treasury,'Unexpected router signer');}
 assert.ok(ix.accounts.some(a=>a.pubkey===ids.pool));return data;
}
export function routerInstruction(payer,b,input){
 const raw=validateBuild(b,input),length=Buffer.alloc(4);length.writeUInt32LE(raw.length);
 assert.ok(!b.swapInstruction.accounts.some(a=>a.pubkey===payer.toBase58()),'Gas payer must not be forwarded');
 const fixed=[[payer,1,1],[ids.treasury,0,1],[ids.mint,0,1],[token.NATIVE_MINT,0,0],[ids.base,0,1],[ids.quote,0,1],[token.TOKEN_PROGRAM_ID,0,0],[web3.SystemProgram.programId,0,0],[token.ASSOCIATED_TOKEN_PROGRAM_ID,0,0],[ROUTER,0,0]];
 return new web3.TransactionInstruction({programId:pk(ids.program),data:Buffer.concat([disc('execute_jupiter_buy_and_burn'),length,raw]),keys:[...fixed.map(([pubkey,s,w])=>({pubkey:pk(pubkey),isSigner:!!s,isWritable:!!w})),...b.swapInstruction.accounts.map(a=>({pubkey:pk(a.pubkey),isSigner:false,isWritable:!!a.isWritable}))]});
}
export function callerFundedPreparation(payer,{missingAccumulator=false}={}){
 const common={system_program:web3.SystemProgram.programId,event_authority:pda(ids.amm,'__event_authority'),program:pk(ids.amm)};
 const ixs=[fromIdl(loadIdl('pump_amm'),'extend_account',{...common,account:pk(ids.pool),user:payer})];
 if(missingAccumulator)ixs.push(fromIdl(loadIdl('pump_amm'),'init_user_volume_accumulator',{...common,payer,user:pk(ids.treasury),user_volume_accumulator:pk(ids.accumulator)}));
 return ixs;
}
export async function canonicalAlternative(_connection,state,payer,{fetcher=fetch,apiKey=process.env.JUPITER_API_KEY,signal}={}){
 const input=state.native-state.rent;assert.ok(input>=MIN);
 const url=new URL('https://api.jup.ag/swap/v2/build');
 for(const[k,v]of Object.entries({inputMint:token.NATIVE_MINT.toBase58(),outputMint:ids.mint,amount:input.toString(),taker:ids.treasury,destinationTokenAccount:ids.base,dexes:'Pump.fun Amm',onlyDirectRoutes:'true',slippageBps:'0',platformFeeBps:'0',maxAccounts:'64'}))url.searchParams.set(k,v);
 const timeout=AbortSignal.timeout(15000),s=signal?AbortSignal.any([signal,timeout]):timeout;
 const response=await fetcher(url,{signal:s,headers:apiKey?{'x-api-key':apiKey}:{}});
 assert.ok(response.ok,'Canonical Jupiter build unavailable: '+response.status);
 const text=await response.text();assert.ok(text.length<=100000,'Oversized Jupiter response');const build=JSON.parse(text);
 return [...callerFundedPreparation(payer,{missingAccumulator:!state.accounts?.accumulator}),routerInstruction(payer,build,input)];
}
