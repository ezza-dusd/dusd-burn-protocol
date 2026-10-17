// Root-only installer of an explicit PUBLIC runtime allowlist. No credentials,
// dependencies or state are copied, and no service or transaction is started.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
export const runtimeFiles=['package.json','package-lock.json','cli.mjs','lock.mjs','builders.mjs','codec.mjs','deps.mjs','state.mjs','runner.mjs','jupiter.mjs','UPSTREAM-COPY-MANIFEST.json','idl/pump.json','idl/pump_amm.json','idl/pump_fees.json','service/dusd-keeper.service','service/dusd-keeper.timer'];
export function installRuntime(source,destination,{requireRoot=true}={}){
  if(requireRoot)assert.equal(process.getuid?.(),0,'Run the installer with administrative approval on Linux');
  assert.ok(path.isAbsolute(destination),'Destination must be absolute');
  assert.ok(!fs.existsSync(destination),'Destination already exists; inspect it instead of overwriting');
  source=fs.realpathSync.native(source);
  const root=fs.realpathSync.native(execFileSync('git',['rev-parse','--show-toplevel'],{cwd:source,encoding:'utf8'}).trim());
  const relative=path.relative(root,source).replaceAll('\\','/');
  assert.equal(relative,'keeper','Use the reviewed public repository keeper directory');
  const tracked=new Set(execFileSync('git',['ls-files','--','keeper'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).map(f=>f.slice(7)));
  function inspect(dir,rel=''){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const name=rel?rel+'/'+entry.name:entry.name;
      if(!rel&&entry.name==='node_modules'){assert.ok(entry.isDirectory()&&!entry.isSymbolicLink(),'Invalid dependency directory');continue;}
      assert.ok(!entry.isSymbolicLink(),'Symlink in public source; installation refused');
      if(entry.isDirectory()){
        assert.ok([...tracked].some(f=>f.startsWith(name+'/')),'Unexpected private/state directory; installation refused');inspect(path.join(dir,entry.name),name);
      }else assert.ok(tracked.has(name),'Unexpected untracked/private file; installation refused');
    }
  }
  inspect(source);
  // Reject ignored wallets and state before copying anything. Runtime files
  // are copied one by one, never with recursive chmod or checkout copying.
  for(const f of runtimeFiles){assert.ok(tracked.has(f),'Runtime file not in reviewed Git index');assert.ok(fs.lstatSync(path.join(source,f)).isFile(),'Invalid runtime source');}
  fs.mkdirSync(path.join(destination,'keeper'),{recursive:true,mode:0o755});
  fs.chmodSync(destination,0o755);fs.chmodSync(path.join(destination,'keeper'),0o755);
  for(const file of runtimeFiles){
    const to=path.join(destination,'keeper',file);fs.mkdirSync(path.dirname(to),{recursive:true,mode:0o755});
    // Explicit permissions only on these newly created PUBLIC paths, so an
    // administrative umask of 077 cannot make the service code unreadable.
    let dir=path.dirname(to);while(dir!==destination){fs.chmodSync(dir,0o755);dir=path.dirname(dir);}
    const fd=fs.openSync(to,'wx',0o644);try{fs.writeFileSync(fd,fs.readFileSync(path.join(source,file)));fs.fchmodSync(fd,0o644);}finally{fs.closeSync(fd);}
  }
  return {runtimeInstalled:true,files:runtimeFiles.length,dependenciesCopied:false,keysCopied:false,servicesStarted:false,transactionsSubmitted:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    assert.equal(process.platform,'linux','Linux server installer only');assert.equal(process.argv.length,3,'Usage: sudo node scripts/install-runtime.mjs /opt/dusd-keeper');
    console.log(JSON.stringify(installRuntime(fileURLToPath(new URL('../',import.meta.url)),process.argv[2])));
  }catch(e){console.error(e.message);process.exitCode=1;}
}
