// Public binary/source fingerprints only. Select a candidate, never deploy it.
import fs from 'node:fs';import {fingerprint} from './verify-bytecode.mjs';import crypto from 'node:crypto';
const [linux,windows]=process.argv.slice(2);if(!linux||!windows)throw Error('Two locally compiled ELF paths required');
const root=new URL('../',import.meta.url),paths=['programs/dusd_burn/src/lib.rs','programs/dusd_burn/Cargo.toml','Cargo.toml','Cargo.lock'];
const l=fingerprint(fs.readFileSync(linux)),w=fingerprint(fs.readFileSync(windows));
const manifest={status:'UNDEPLOYED CANDIDATE; not the live mainnet release',programId:'6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm',sourceHashes:Object.fromEntries(paths.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex')])),
 selectedEnvironment:'Official solana-verify 0.5.2 Linux Docker build; independent reproduction required',binarySha256:l.fullSha256,binaryBytes:l.bytes,solanaVerifyExecutableHash:l.executableHash,windowsSha256:w.fullSha256,windowsBytes:w.bytes,windowsExecutableHash:w.executableHash,
 image:'solanafoundation/solana-verifiable-build@sha256:12fd4c0a0790f0fc41ef74b0cdb6bccc167ba6137eb1adb749bac649481c86bd',solanaVerifyCliSha256:'b9d5ccce9634dc14269cab3e7a58649bc141b3306e7735a94478c936341f211f',architecture:'v0',platformTools:'v1.57',features:['no-idl'],authorityChanges:0,mainnetTransactions:0};
fs.writeFileSync(new URL('verification/candidate/release.json',root),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({selectedLinux:l,secondaryWindows:w,sourceHash:manifest.sourceHashes[paths[0]]}));
