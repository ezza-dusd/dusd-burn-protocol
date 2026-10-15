import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {web3,token} from './deps.mjs';import {ids,pk,ata,loadIdl,APPROVED_HASH} from './builders.mjs';import {decodeAccount} from './codec.mjs';
export const watched={...ids,pumpVaultWsol:ata(ids.pumpVault).toBase58()};
export async function snapshot(c){
 const names=Object.keys(watched),r=await c.getMultipleAccountsInfoAndContext(names.map(n=>pk(watched[n])),'finalized'),a=Object.fromEntries(names.map((n,i)=>[n,r.value[i]]));
 const data=n=>{assert.ok(a[n],'Missing '+n);return a[n].data;},owned=(n,id)=>{assert.equal(a[n]?.owner.toBase58(),id,'Wrong owner '+n);};
 owned('sharing',ids.fees);owned('pool',ids.amm);owned('curve',ids.pump);owned('ammGlobal',ids.amm);owned('programData','BPFLoaderUpgradeab1e11111111111111111111111');assert.ok(a.program?.executable);assert.equal(pk(data('program').subarray(4,36)).toBase58(),ids.programData);assert.equal(crypto.createHash('sha256').update(data('programData').subarray(45)).digest('hex'),APPROVED_HASH,'Unapproved program bytes');
 const sharing=decodeAccount(loadIdl('pump_fees'),'SharingConfig',data('sharing')).value,pool=decodeAccount(loadIdl('pump_amm'),'Pool',data('pool')).value,curve=decodeAccount(loadIdl('pump'),'BondingCurve',data('curve')).value,global=decodeAccount(loadIdl('pump_amm'),'GlobalConfig',data('ammGlobal')).value;
 assert.equal(sharing.mint,ids.mint);assert.equal(pool.base_mint,ids.mint);assert.equal(pool.quote_mint,token.NATIVE_MINT.toBase58());assert.equal(pool.coin_creator,ids.sharing);assert.equal(curve.creator,ids.sharing);assert.equal(pool.pool_base_token_account,ids.poolBase);assert.equal(pool.pool_quote_token_account,ids.poolQuote);
 const mint=token.unpackMint(pk(ids.mint),a.mint);assert.equal(mint.decimals,6);assert.equal(mint.mintAuthority,null);assert.equal(mint.freezeAuthority,null);
 const amount=(n,mint,authority)=>{if(!a[n])return 0n;const t=token.unpackAccount(pk(watched[n]),a[n]);assert.equal(t.mint.toBase58(),mint);assert.equal(t.owner.toBase58(),authority);assert.equal(t.delegate,null);return t.amount;};
 const floor=BigInt(await c.getMinimumBalanceForRentExemption(0,'finalized'));
 if(a.treasury){owned('treasury',web3.SystemProgram.programId.toBase58());assert.equal(data('treasury').length,0);}
 const native=BigInt(a.treasury?.lamports??0),legacy=amount('ammVaultWsol',token.NATIVE_MINT.toBase58(),ids.ammVault),pumpNative=BigInt(a.pumpVault?.lamports??0),pumpWrapped=amount('pumpVaultWsol',token.NATIVE_MINT.toBase58(),ids.pumpVault);
 const fees=BigInt(pool.creator_fees??0)+BigInt(curve.creator_fee??0)+legacy+(pumpNative>floor?pumpNative-floor:0n)+pumpWrapped;
 return {slot:r.context.slot,sharing,pool,curve,global,native,rent:floor,fees,dusd:amount('base',ids.mint,ids.treasury),wsol:amount('quote',token.NATIVE_MINT.toBase58(),ids.treasury),feeBuckets:{pool:BigInt(pool.creator_fees??0),curve:BigInt(curve.creator_fee??0),ammWsol:legacy,pumpNative:pumpNative>floor?pumpNative-floor:0n,pumpWsol:pumpWrapped},accounts:a};
}
export async function chooseBuyback(c,state){const addrs=state.global.buyback_fee_recipients.map(ata),accounts=await c.getMultipleAccountsInfo(addrs,'finalized');const at=accounts.findIndex((a,i)=>{if(!a||!a.owner.equals(token.TOKEN_PROGRAM_ID))return false;const t=token.unpackAccount(addrs[i],a);return t.mint.equals(token.NATIVE_MINT)&&t.owner.toBase58()===state.global.buyback_fee_recipients[i];});assert.ok(at>=0,'No initialized approved buyback ATA');return addrs[at];}
