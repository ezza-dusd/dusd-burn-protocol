// Best-effort publication hygiene, not a claim of comprehensive secret discovery.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const root=fs.realpathSync(new URL('../',import.meta.url)),files=execFileSync('git',['ls-files','-z'],{cwd:root}).toString().split('\0').filter(Boolean),hits=[];
for(const file of files){const full=path.join(root,file);if(!fs.existsSync(full))continue;const b=fs.readFileSync(full);if(b.subarray(0,4).equals(Buffer.from([127,69,76,70]))||b.includes(0))continue;
 const text=b.toString('utf8');for(const [name,re]of [['private PEM',/-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----/],['credential-shaped literal',/\b(?:gh[opsu]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|[0-9]{8,12}:[A-Za-z0-9_-]{30,})\b/],['credential-bearing RPC URL',/https?:\/\/[^\s"'<>]+[?&](?:api[-_]key|token)=[A-Za-z0-9_-]{20,}/]])if(re.test(text))hits.push({file,category:name});
 if(file.endsWith('.json')){try{const j=JSON.parse(text);if(Array.isArray(j)&&[32,64].includes(j.length)&&j.every(n=>Number.isInteger(n)&&n>=0&&n<=255))hits.push({file,category:'key-shaped root byte array'});}catch{}}
 if(/(?:^|\/)(?:node_modules|target|\.local)\//.test(file)||/keypair\.json$/.test(file))hits.push({file,category:'private/generated publication path'});
}
const result={at:new Date().toISOString(),trackedFiles:files.length,hits,productionKeysRead:false,scope:'Pattern and path hygiene on tracked public files; not proof that no secret can exist'};
console.log(JSON.stringify(result));if(hits.length)process.exitCode=1;
