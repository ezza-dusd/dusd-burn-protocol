import fs from 'node:fs';import {spawn} from 'node:child_process';
const root=fs.realpathSync(new URL('../',import.meta.url)),dir=root+'/research/lifecycle-2026-10-14';let output='';
const child=spawn(process.execPath,['--test','--test-reporter=tap',root+'/tests/lifecycle.test.mjs'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
child.stdout.on('data',b=>{output+=b.toString();process.stdout.write(b)});child.stderr.on('data',b=>process.stderr.write(b));
const code=await new Promise(resolve=>{child.once('error',()=>resolve(1));child.once('close',resolve)});
fs.writeFileSync(dir+'/lifecycle.tap',output);
const n=name=>Number(output.match(new RegExp('^# '+name+' (\\d+)\\s*$','m'))?.[1]??NaN);
fs.writeFileSync(dir+'/lifecycle-summary.json',JSON.stringify({finishedAt:new Date().toISOString(),exitCode:code,tests:n('tests'),passed:n('pass'),failed:n('fail'),skipped:n('skipped')},null,2));
process.exitCode=code??1;
