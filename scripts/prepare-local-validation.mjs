// Optional local convenience: copy only the known candidate ELF/harness outputs.
// No identity, credentials, production state or network access.
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const src='E:/dusd-burn-jupiter-candidate-2026-10-16';
for(const file of ['target/deploy/dusd_burn.so','harness/target/debug/dusd-svm-harness.exe']){
 const out=new URL(file,root);fs.mkdirSync(new URL('./',out),{recursive:true});fs.copyFileSync(src+'/'+file,out);
}
console.log('Known local build outputs copied for validation only.');
