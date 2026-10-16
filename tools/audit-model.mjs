// Independent integer model, informed by official SDK 2.1.0, then checked against
// the copied PumpSwap binary. Never imported into the contract or production client.
const U64=(1n<<64n)-1n,U128=(1n<<128n)-1n;
export {U64,U128};
export function contractModel(input,base,quote,supply,fees){
 for(const v of [input,base,supply])if(v<0n||v>U64)throw new Error('u64 domain');
 if(input<10_000_000n||base<=0n||quote<=0n)throw new Error('domain');
 if(supply*quote>U128)throw new Error('market cap overflow');
 const cap=supply*quote/base;let selected=null;
 if(!fees.length||fees.length>64)throw new Error('tier count');
 for(let i=0;i<fees.length;i++){if(i&&fees[i].threshold<=fees[i-1].threshold)throw new Error('tier order');if(fees[i].threshold<=cap)selected=fees[i];}
 if(!selected)throw new Error('no matching tier');
 const bps=selected.lp+selected.protocol+selected.creator;if(bps>500n)throw new Error('fee ceiling');
 const net=input*10_000n/(10_000n+bps);
 if(base*net>U128||quote+net>U128)throw new Error('quote overflow');
 const expected=base*net/(quote+net),minimum=expected*99n/100n;
 if(minimum===0n)throw new Error('zero floor');
 return {minimum,expected,bps};
}
export function upstreamModel(input,base,quote,supply,tiers){
 const cap=supply*quote/base;
 let selected=tiers[0];for(const t of tiers)if(t.threshold<=cap)selected=t;
 const ceil=(n,d)=>(n+d-1n)/d;
 let net=input*10_000n/(10_000n+selected.lp+selected.protocol+selected.creator);
 const fee=ceil(net*selected.lp,10_000n)+ceil(net*selected.protocol,10_000n)+ceil(net*selected.creator,10_000n);
 const excess=net+fee-input;if(excess>0n)net-=excess;
 // Official buyQuoteInput uses net-1. The binary comparison reports any mismatch.
 const priced=net-1n;if(priced<=0n)return 0n;
 return base*priced/(quote+priced);
}
export function seeded(seed=0x44555344n){let state=BigInt(seed);return max=>{state=(state*6364136223846793005n+1442695040888963407n)&U64;return state%max;};}
