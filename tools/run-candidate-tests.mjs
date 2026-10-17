import fs from 'node:fs';import {spawn} from 'node:child_process';
const root=fs.realpathSync(new URL('../',import.meta.url));let output='';
const p=spawn(process.execPath,['--test','--test-reporter=tap',root+'/tests/jupiter.test.mjs',root+'/tests/post-cpi.test.mjs'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
p.stdout.on('data',b=>{output+=b;process.stdout.write(b)});p.stderr.on('data',b=>process.stderr.write(b));
const code=await new Promise(r=>{p.once('error',()=>r(1));p.once('close',r)}),n=name=>Number(output.match(new RegExp('^# '+name+' (\\d+)\\s*$','m'))?.[1]??NaN);
fs.writeFileSync(root+'/research/candidate-test-summary.json',JSON.stringify({at:new Date().toISOString(),exitCode:code,tests:n('tests'),passed:n('pass'),failed:n('fail'),skipped:n('skipped')},null,2));process.exitCode=code??1;
