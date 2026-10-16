// Explicit local-only public security-test source and binary; no keys.
import fs from 'node:fs';
const root=new URL('../',import.meta.url),src='E:/dusd-burn-post-cpi-review-2026-10-16/mock-amm';
for(const file of ['Cargo.toml','Cargo.lock','src/lib.rs']){const out=new URL('harness/mock-amm/'+file,root);fs.mkdirSync(new URL('./',out),{recursive:true});fs.copyFileSync(src+'/'+file,out);}
fs.copyFileSync(src+'/deploy/review_mock_amm.so',new URL('fixtures/programs/review_mock_amm.so',root));
