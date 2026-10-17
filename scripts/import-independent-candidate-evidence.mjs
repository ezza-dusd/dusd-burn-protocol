// Import only explicitly named PUBLIC CI records and compare candidate ELF bytes.
import fs from 'node:fs';import assert from 'node:assert/strict';
const [linux,windows]=process.argv.slice(2);assert.ok(linux&&windows,'Public CI extraction directories required');
const root=fs.realpathSync(new URL('../',import.meta.url)),manifest=JSON.parse(fs.readFileSync(root+'/verification/candidate/release.json'));
const l=JSON.parse(fs.readFileSync(linux+'/verification/candidate/LINUX-CI-RESULT.json'));
const windowsEntries=fs.readdirSync(windows).filter(f=>/^dusd-verify-[A-Za-z0-9]+$/.test(f));assert.equal(windowsEntries.length,1);
const w=JSON.parse(fs.readFileSync(windows+'/'+windowsEntries[0]+'/RESULT.json'));
assert.equal(l.match,true);assert.equal(w.result,'MATCH');assert.equal(l.binarySha256,manifest.binarySha256);assert.equal(w.comparison.binarySha256,manifest.windowsSha256);
assert.deepEqual(l.sourceHashes,manifest.sourceHashes);assert.deepEqual(w.sourceHashes,manifest.sourceHashes);
assert.equal(l.commit,'8f0d0c8e3a347cc3317952beb1d9e49f1a3899a5');assert.equal(w.commit,l.commit);
assert.ok(fs.readFileSync(linux+'/target/deploy/dusd_burn.so').equals(fs.readFileSync(root+'/target/deploy/dusd_burn.so')),'Independent candidate bytes differ from locally tested artifact');
const tests=JSON.parse(fs.readFileSync(linux+'/research/lifecycle-2026-10-14/all-summary.json'));assert.equal(tests.exitCode,0);assert.equal(tests.tests,227);assert.equal(tests.failed,0);
fs.writeFileSync(root+'/verification/candidate/INDEPENDENT-LINUX-BUILD.json',JSON.stringify(l,null,2)+'\n');
fs.writeFileSync(root+'/verification/candidate/INDEPENDENT-WINDOWS-BUILD.json',JSON.stringify(w,null,2)+'\n');
fs.writeFileSync(root+'/verification/candidate/INDEPENDENT-TEST-SUMMARY.json',JSON.stringify({at:new Date().toISOString(),commit:l.commit,sourceHashes:l.sourceHashes,binarySha256:l.binarySha256,tests:tests.tests,passed:tests.passed,failed:tests.failed,baseline:tests.baseline.tests,stress:tests.stress.tests,lifecycle:tests.lifecycle.tests,candidate:tests.candidate.tests,run:'https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/39011174013',transactionsSubmittedToNetwork:0},null,2)+'\n');
console.log(JSON.stringify({independentLinuxMatch:true,independentWindowsMatch:true,independentTestsPassed:tests.passed,independentArtifactEqualsLocalTestedBytes:true}));
