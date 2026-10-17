import fs from 'node:fs';import crypto from 'node:crypto';import {web3,token} from './deps.mjs';
export const inventory=JSON.parse(fs.readFileSync(new URL('../research/onchain-inventory.json',import.meta.url)));
export const PROGRAM=new web3.PublicKey(inventory.addresses.burnProgram??'Cfd92kkjkkw7oyZN6ZwRDJBCSSUjmALzp9EgDararj7s');
export const treasury=web3.PublicKey.findProgramAddressSync([Buffer.from('treasury')],PROGRAM)[0];
export const baseMint=new web3.PublicKey(inventory.addresses.mint),pool=new web3.PublicKey(inventory.addresses.pool);
export const amm=new web3.PublicKey(inventory.addresses.ammProgram);
export const baseAta=token.getAssociatedTokenAddressSync(baseMint,treasury,true),quoteAta=token.getAssociatedTokenAddressSync(token.NATIVE_MINT,treasury,true);
export const accumulator=web3.PublicKey.findProgramAddressSync([Buffer.from('user_volume_accumulator'),treasury.toBuffer()],amm)[0];
export const eventAuthority=web3.PublicKey.findProgramAddressSync([Buffer.from('__event_authority')],amm)[0];
export const disc=name=>crypto.createHash('sha256').update('global:'+name).digest().subarray(0,8);
export const jupiter=new web3.PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
export function jupiterBuyBurnInstruction(caller,build){
 const raw=Buffer.from(build.swapInstruction.data,'base64'),size=Buffer.alloc(4);size.writeUInt32LE(raw.length);
 const fixed=[[caller,true,true],[treasury,false,true],[baseMint,false,true],[token.NATIVE_MINT,false,false],
 [baseAta,false,true],[quoteAta,false,true],[token.TOKEN_PROGRAM_ID,false,false],[web3.SystemProgram.programId,false,false],
 [token.ASSOCIATED_TOKEN_PROGRAM_ID,false,false],[jupiter,false,false]].map(([pubkey,isSigner,isWritable])=>({pubkey,isSigner,isWritable}));
 if(build.swapInstruction.programId!==jupiter.toBase58())throw Error('Wrong router');
 return new web3.TransactionInstruction({programId:PROGRAM,data:Buffer.concat([disc('execute_jupiter_buy_and_burn'),size,raw]),keys:[...fixed,
 ...build.swapInstruction.accounts.map(a=>({pubkey:new web3.PublicKey(a.pubkey),isSigner:false,isWritable:a.isWritable}))]});
}
export function buyBurnInstruction(caller,substitutions={}){
 if(!substitutions||typeof substitutions!=='object')throw new Error('Exact-input ABI takes only caller and account substitutions; no amount or quote');
 const entries=[['caller',caller,true,true],['treasury',treasury,false,true],['pool',pool,false,true],
 ['global_config',inventory.addresses.globalConfig,false,false],['base_mint',baseMint,false,true],['quote_mint',token.NATIVE_MINT,false,false],
 ['base_ata',baseAta,false,true],['quote_ata',quoteAta,false,true],['base_vault',inventory.addresses.poolBase,false,true],
 ['quote_vault',inventory.addresses.poolQuote,false,true],['token_program',token.TOKEN_PROGRAM_ID,false,false],
 ['system_program',web3.SystemProgram.programId,false,false],['user_volume_accumulator',accumulator,false,true],
 ['fee_config',inventory.addresses.feeConfig,false,false],['buyback_fee_recipient',inventory.addresses.buybackAta,false,true],
 ['event_authority',eventAuthority,false,false],['amm_program',amm,false,false],['associated_token_program',token.ASSOCIATED_TOKEN_PROGRAM_ID,false,false]];
 const data=disc('execute_buy_and_burn');
 return new web3.TransactionInstruction({programId:PROGRAM,data,keys:entries.map(([name,address,isSigner,isWritable])=>({pubkey:new web3.PublicKey(substitutions[name]??address),isSigner,isWritable}))});
}
export function burnDusdInstruction(caller,substitutions={}){
 const entries=[['caller',caller,true,false],['treasury',treasury,false,false],['base_mint',baseMint,false,true],['base_ata',baseAta,false,true],['token_program',token.TOKEN_PROGRAM_ID,false,false]];
 return new web3.TransactionInstruction({programId:PROGRAM,data:disc('burn_dusd'),keys:entries.map(([name,address,isSigner,isWritable])=>({pubkey:new web3.PublicKey(substitutions[name]??address),isSigner,isWritable}))});
}
export function unwrapInstruction(caller){return new web3.TransactionInstruction({programId:PROGRAM,data:disc('unwrap_quote'),keys:[
 {pubkey:caller,isSigner:true,isWritable:false},{pubkey:treasury,isSigner:false,isWritable:true},
 {pubkey:token.NATIVE_MINT,isSigner:false,isWritable:false},{pubkey:quoteAta,isSigner:false,isWritable:true},{pubkey:token.TOKEN_PROGRAM_ID,isSigner:false,isWritable:false}]});}
export function assertLocalConnection(connection){
 const url=new URL(connection.rpcEndpoint);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.port!=='19899')throw new Error('Execution is restricted to isolated loopback validator');
}
