import {spawn} from 'node:child_process';import fs from 'node:fs';
const root=fs.realpathSync(new URL('../',import.meta.url));let failed=false;
for(const file of ['tools/run-tests.mjs','tools/run-audit.mjs','tools/run-lifecycle.mjs']){
 const p=spawn(process.execPath,[root+'/'+file],{stdio:'inherit',windowsHide:true});
 const code=await new Promise(resolve=>{p.once('error',()=>resolve(1));p.once('close',resolve)});if(code!==0)failed=true;
}
const baseline=JSON.parse(fs.readFileSync(root+'/research/test-run-summary.json'));
const stress=JSON.parse(fs.readFileSync(root+'/research/lifecycle-2026-10-14/stress-summary.json'));
const lifecycle=JSON.parse(fs.readFileSync(root+'/research/lifecycle-2026-10-14/lifecycle-summary.json'));
fs.writeFileSync(root+'/research/lifecycle-2026-10-14/all-summary.json',JSON.stringify({finishedAt:new Date().toISOString(),exitCode:failed?1:0,
 tests:baseline.tests+stress.tests+lifecycle.tests,passed:baseline.passed+stress.passed+lifecycle.passed,failed:baseline.failed+stress.failed+lifecycle.failed,skipped:baseline.skipped+stress.skipped+lifecycle.skipped,baseline,stress,lifecycle},null,2));
process.exitCode=failed?1:0;
