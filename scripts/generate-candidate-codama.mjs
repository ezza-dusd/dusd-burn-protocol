// Public interface conversion only, requires @codama/nodes-from-anchor 1.5.6.
import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(process.env.DUSD_CODAMA_PACKAGE??new URL('../package.json',import.meta.url));
const {rootNodeFromAnchor}=require('@codama/nodes-from-anchor');
const root=new URL('../',import.meta.url),idl=JSON.parse(fs.readFileSync(new URL('idl/dusd_burn.json',root)));
const codama=rootNodeFromAnchor(idl);if(codama.program.instructions.length!==4)throw Error('Wrong candidate interface');
fs.writeFileSync(new URL('idl/dusd_burn.codama.json',root),JSON.stringify(codama,null,2)+'\n');
console.log('Four-instruction candidate Codama interface generated.');
