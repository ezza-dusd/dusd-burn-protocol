// Official supported-environment build. No wallet, registration or live upgrade.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import path from 'node:path';import {spawnSync,execFileSync} from 'node:child_process';
assert.equal(process.platform,'linux');const root=fs.realpathSync(new URL('../',import.meta.url));
const manifest=JSON.parse(fs.readFileSync(root+'/verification/candidate/release.json'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const[p,expected]of Object.entries(manifest.sourceHashes))assert.equal(hash(fs.readFileSync(root+'/'+p)),expected,p);
const temp=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP??'/tmp','dusd-linux-verify-'));
const url='https://github.com/solana-foundation/solana-verifiable-build/releases/download/v0.5.2/solana-verify-0.5.2-linux';
const r=await fetch(url,{signal:AbortSignal.timeout(300000)});assert.ok(r.ok);const cli=Buffer.from(await r.arrayBuffer());assert.equal(hash(cli),manifest.solanaVerifyCliSha256);
const tool=temp+'/solana-verify';fs.writeFileSync(tool,cli,{mode:0o700});
const args=['build','--base-image',manifest.image,'--library-name','dusd_burn','--arch','v0','--cargo-build-sbf-args=--tools-version v1.57 --features no-idl --jobs 2'];
const env={};for(const k of ['PATH','HOME','USER','TMPDIR','DOCKER_HOST','DOCKER_CONFIG','XDG_RUNTIME_DIR'])if(process.env[k])env[k]=process.env[k];
const log=fs.openSync(root+'/verification/candidate/linux-build.log','w');
const built=spawnSync(tool,args,{cwd:root,env,stdio:['ignore',log,log]});fs.closeSync(log);
const report={at:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceHashes:manifest.sourceHashes,toolSha256:hash(cli),image:manifest.image,command:['solana-verify',...args],buildExitCode:built.status,transactionsSubmitted:0};
if(built.status===0){const elf=fs.readFileSync(root+'/target/deploy/dusd_burn.so');report.binarySha256=hash(elf);report.binaryBytes=elf.length;report.match=report.binarySha256===manifest.binarySha256&&elf.length===manifest.binaryBytes;}
fs.writeFileSync(root+'/verification/candidate/LINUX-CI-RESULT.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.equal(report.match,true,'Candidate Linux build mismatch; see linux-build.log');
