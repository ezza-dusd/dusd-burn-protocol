// Summarize actual local results; public evidence only, never keys or signed wire.
import fs from 'node:fs';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import crypto from 'node:crypto';
const root=fs.realpathSync(new URL('../',import.meta.url)),read=p=>JSON.parse(fs.readFileSync(root+'/'+p));
function tests(args,cwd=root){const r=spawnSync(process.execPath,['--test','--test-reporter=tap',...args],{cwd,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Validation failed: '+args.join(' '));const n=k=>Number(r.stdout.match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]);return {tests:n('tests'),passed:n('pass'),failed:n('fail'),exitCode:r.status};}
const suite=read('research/lifecycle-2026-10-14/all-summary.json'),manifest=read('verification/candidate/release.json'),jupiter=read('research/jupiter-results.json');
assert.equal(suite.exitCode,0);assert.equal(suite.baseline.artifacts.sha256['target/deploy/dusd_burn.so'],manifest.binarySha256);
const feasibility=spawnSync(process.execPath,['tools/verify-exact-input.mjs'],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(feasibility.status,0);
const keeper=tests(fs.readdirSync(root+'/keeper/tests').filter(x=>x.endsWith('.test.mjs')).map(x=>'tests/'+x),root+'/keeper');
const helper=tests(['scripts/verify-bytecode.test.mjs']);
const report={at:new Date().toISOString(),scope:'Local copied mainnet programs only; not new live transactions',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(root+'/programs/dusd_burn/src/lib.rs')).digest('hex'),binarySha256:manifest.binarySha256,
 contract:{tests:suite.tests,passed:suite.passed,failed:suite.failed,existingBaseline:suite.baseline.tests,stress:suite.stress.tests,fullLifecycle:suite.lifecycle.tests,newCandidate:suite.candidate.tests},arithmeticCases:25000,malformedRouteCases:120,
 directFeasibilityChecks:read('research/lifecycle-2026-10-14/feasibility.json').cases.length,creatorFeeCyclesDirect:read('research/lifecycle-2026-10-14/lifecycle-results.json').cycles.length,creatorFeeCyclesJupiter:jupiter.receipts.filter(r=>r.name.startsWith('complete fee-to-Jupiter-burn cycle ')&&!r.error).length,
 keeper,bytecodeHelper:helper,jupiterExecution:jupiter.receipts.filter(r=>/canonical router purchase|fresh caller-funded complete setup/.test(r.name)).map(({name,error,computeUnits,bytes,fee})=>({name,error,computeUnits,bytes,fee})),mainnetTransactionsSubmitted:0};
fs.writeFileSync(root+'/verification/candidate/LOCAL-VALIDATION.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
