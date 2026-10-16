import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {web3} from '../tools/deps.mjs';import {PROGRAM,treasury} from '../tools/client.mjs';import {AuditVM,ROOT,cleanSandbox} from '../tools/audit-vm.mjs';
const tag=Buffer.alloc(8);tag.writeBigUInt64LE(0x0a69e9a778bcf440n);const receipts=[];
test('no-idl release rejects all mutable metadata instructions',async t=>{
 t.after(()=>{fs.writeFileSync(ROOT+'/no-idl-results.json',JSON.stringify({program:PROGRAM.toBase58(),receipts},null,2));cleanSandbox();});
 const vm=await AuditVM.start();try{
  await vm.fund(10_000_000n);const [base]=web3.PublicKey.findProgramAddressSync([],PROGRAM),idl=await web3.PublicKey.createWithSeed(base,'anchor:idl',PROGRAM);
  for(const [index,name]of ['Create','CreateBuffer','Write','SetBuffer','SetAuthority','Close','Resize'].entries())await t.test('disabled IDL '+name,async()=>{
   const before=await vm.snapshot(),r=await vm.send([new web3.TransactionInstruction({programId:PROGRAM,data:Buffer.concat([tag,Buffer.from([index]),Buffer.alloc(64)]),keys:[{pubkey:vm.caller.publicKey,isSigner:true,isWritable:true},{pubkey:idl,isSigner:false,isWritable:true},{pubkey:base,isSigner:false,isWritable:false},{pubkey:web3.SystemProgram.programId,isSigner:false,isWritable:false},{pubkey:PROGRAM,isSigner:false,isWritable:false}]})]);
   receipts.push({name,...r});assert.notEqual(r.error,null);assert.match(r.logs.join('\n'),/IdlInstructionStub/);assert.deepEqual(await vm.snapshot(),before);assert.equal((await vm.accounts([idl]))[0],null);
  });
 }finally{vm.close();}
});
