import fs from 'node:fs';
import {web3} from './deps.mjs';
export function decodeAccount(idl,name,bytes){
 const spec=idl.accounts.find(a=>a.name===name);
 if(!spec||!Buffer.from(spec.discriminator).equals(bytes.subarray(0,8)))throw new Error('Account discriminator mismatch: '+name);
 // Only documented appended fields get zero-padding. Stored source length is
 // included in inventory, so a missing field never looks like proven live state.
 let at=8;const padded=Buffer.concat([bytes,Buffer.alloc(4096)]);
 const read=t=>{
  if(typeof t==='string'){
   if(t==='pubkey'){const v=new web3.PublicKey(padded.subarray(at,at+32)).toBase58();at+=32;return v;}
   if(t==='string'){const n=padded.readUInt32LE(at);at+=4;if(n>4096||at+n>bytes.length)throw new Error('Invalid bounded IDL string');const v=padded.subarray(at,at+n).toString('utf8');at+=n;return v;}
   if(t==='bool'){const v=padded[at++];if(v>1)throw new Error('Invalid bool');return !!v;}
   const m=/^([ui])(8|16|32|64|128)$/.exec(t);if(!m)throw new Error('Unknown scalar '+t);
   const len=Number(m[2])/8;let v=0n;for(let i=0;i<len;i++)v|=BigInt(padded[at+i])<<BigInt(8*i);at+=len;
   if(m[1]==='i'&&(v&(1n<<BigInt(len*8-1))))v-=1n<<BigInt(len*8);
   return len<=4?Number(v):v.toString();
  }
  if(t.array)return Array.from({length:t.array[1]},()=>read(t.array[0]));
  if(t.vec){const n=read('u32');if(n>512)throw new Error('Unbounded vector');return Array.from({length:n},()=>read(t.vec));}
  if(t.option)return read('u8')?read(t.option):null;
  const def=idl.types.find(x=>x.name===(t.defined?.name??t.defined));if(!def)throw new Error('Unknown defined type');
  if(def.type.kind==='enum'){const n=read('u8'),variant=def.type.variants[n];if(!variant||variant.fields)throw new Error('Unsupported variant');return variant.name;}
  const result={};for(const field of def.type.fields)result[field.name]=read(field.type);return result;
 };
 const value=read({defined:{name}});
 if(name==='SharingConfig'&&at>bytes.length)throw new Error('Truncated sharing config');
 return {value,storedBytes:bytes.length,decodedBytes:at,hasMissingTrailingFields:at>bytes.length};
}
export function loadIdl(name){return JSON.parse(fs.readFileSync(new URL(`./idl/${name}.json`,import.meta.url),'utf8'));}
