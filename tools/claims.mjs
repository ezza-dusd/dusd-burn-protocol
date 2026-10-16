// Offline builders from pinned public IDLs. No RPC, signing or submission.
import {web3,token} from './deps.mjs';import {inventory,treasury} from './client.mjs';import {loadIdl} from './codec.mjs';
const {PublicKey,TransactionInstruction}=web3,addr=n=>new PublicKey(inventory.addresses[n]);
const pump=loadIdl('pump'),amm=loadIdl('pump_amm'),fees=loadIdl('pump_fees');
const pda=(pid,...seeds)=>PublicKey.findProgramAddressSync(seeds.map(s=>typeof s==='string'?Buffer.from(s):s.toBuffer()),new PublicKey(pid))[0];
const ata=owner=>token.getAssociatedTokenAddressSync(token.NATIVE_MINT,owner,true);
export function fromIdl(idl,name,values,data=Buffer.alloc(0),remaining=[]){
 const spec=idl.instructions.find(i=>i.name===name);if(!spec)throw new Error('Instruction absent from pinned IDL');
 const keys=spec.accounts.map(a=>{if(!values[a.name])throw new Error('Missing '+a.name);return {pubkey:new PublicKey(values[a.name]),isSigner:!!a.signer,isWritable:!!a.writable};});
 return new TransactionInstruction({programId:new PublicKey(idl.address),data:Buffer.concat([Buffer.from(spec.discriminator),data]),keys:[...keys,...remaining.map(p=>({pubkey:p,isSigner:false,isWritable:true}))]});
}
export function feeInstructions(payer,recipient=treasury){
 const common={payer,base_mint:addr('mint'),mint:addr('mint'),quote_mint:token.NATIVE_MINT,quote_token_program:token.TOKEN_PROGRAM_ID,
 token_program:token.TOKEN_PROGRAM_ID,associated_token_program:token.ASSOCIATED_TOKEN_PROGRAM_ID,system_program:web3.SystemProgram.programId,
 global:addr('global'),global_config:addr('globalConfig'),bonding_curve:addr('bondingCurve'),pool:addr('pool'),pool_quote_token_account:addr('poolQuote'),
 sharing_config:addr('sharingConfig'),coin_creator:addr('sharingConfig'),coin_creator_vault_authority:addr('ammCreatorVault'),
 coin_creator_vault_ata:addr('ammCreatorWsol'),pump_creator_vault:addr('pumpCreatorVault'),pump_creator_vault_ata:ata(addr('pumpCreatorVault')),
 creator_vault:addr('pumpCreatorVault'),creator_vault_quote_token_account:ata(addr('pumpCreatorVault')),
 associated_quote_bonding_curve:ata(addr('bondingCurve'))};
 const curveSweep=fromIdl(pump,'sweep_creator_fee',{...common,recipient:addr('pumpCreatorVault'),associated_quote_recipient:ata(addr('pumpCreatorVault')),
  event_authority:pda(pump.address,'__event_authority'),program:pump.address});
 const poolSweep=fromIdl(amm,'sweep_creator_fee',{...common,recipient:addr('ammCreatorVault'),recipient_token_account:addr('ammCreatorWsol'),
  event_authority:pda(amm.address,'__event_authority'),program:amm.address});
 const transfer=fromIdl(amm,'transfer_creator_fees_to_pump_v2',{...common,event_authority:pda(amm.address,'__event_authority'),program:amm.address});
 const distribute=fromIdl(pump,'distribute_creator_fees_v2',{...common,event_authority:pda(pump.address,'__event_authority'),program:pump.address},Buffer.from([false]),[recipient]);
 return {curveSweep,poolSweep,transfer,distribute,common};
}
export function finalizeTestShares(authority,currentRecipient){
 const {common,curveSweep,poolSweep}=feeInstructions(authority);
 const args=Buffer.alloc(4+32+2);args.writeUInt32LE(1);treasury.toBuffer().copy(args,4);args.writeUInt16LE(10000,36);
 const update=fromIdl(fees,'update_fee_shares_v2',{...common,authority,event_authority:pda(fees.address,'__event_authority'),program:fees.address,
  pump_program:pump.address,pump_event_authority:pda(pump.address,'__event_authority'),pump_amm_program:amm.address,amm_event_authority:pda(amm.address,'__event_authority')},args,[currentRecipient]);
 // Deployed program + official 4.1.0 SDK require the graduated canonical pool
 // LAST, after current shareholders. The instruction MD table omits this detail.
 update.keys.push({pubkey:addr('pool'),isSigner:false,isWritable:false});
 return [curveSweep,poolSweep,update];
}
