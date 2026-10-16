// Read-only verification: public downloads, compilation, finalized RPC. No Solana signer.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { compareMainnet } from './verify-bytecode.mjs';

const candidate = process.env.DUSD_VERIFY_CANDIDATE === '1';
const commit = candidate ? process.env.DUSD_CANDIDATE_COMMIT : '72f34f97b8540066f1c84aa91d776e49a86b7479';
assert.match(commit ?? '', /^[a-f0-9]{40}$/, 'Exact public commit required');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const run = (exe, args, opts = {}) => execFileSync(exe, args, { windowsHide: true, stdio: 'inherit', ...opts });
assert.equal(process.platform, 'win32', 'Requires Windows x64 and Node.js 22+');
assert.equal(process.arch, 'x64');
const work = fs.mkdtempSync(path.join(process.env.DUSD_VERIFY_WORK ?? os.tmpdir(), 'dusd-verify-'));
const report = { commit, startedAt: new Date().toISOString(), work, broadcasts: false };
console.log('Fresh verification directory: ' + work);
const save = () => fs.writeFileSync(path.join(work, 'RESULT.json'), JSON.stringify(report, null, 2));

async function download(url, expected, file) {
  const cache = process.env.DUSD_VERIFY_DOWNLOAD_CACHE && path.join(process.env.DUSD_VERIFY_DOWNLOAD_CACHE, path.basename(file));
  if (cache && fs.existsSync(cache)) {
    const bytes = fs.readFileSync(cache); assert.equal(sha(bytes), expected, 'Cached public archive checksum mismatch');
    fs.writeFileSync(file, bytes); console.log('Verified cached public download: ' + path.basename(file)); return file;
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(600000) });
  assert.ok(response.ok, 'Public tool download failed: ' + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(sha(bytes), expected, 'Public tool archive checksum mismatch');
  fs.writeFileSync(file, bytes);
  console.log('Verified public download: ' + path.basename(file));
  return file;
}
function extract(file, dest, zip = false) {
  fs.mkdirSync(dest, { recursive: true });
  // Standard-library extractor; Windows tar installations may omit bzip2.
  run('python', ['-c', 'import sys,tarfile,zipfile; p,d=sys.argv[1:]; z=zipfile.is_zipfile(p); a=zipfile.ZipFile(p) if z else tarfile.open(p); a.extractall(d) if z else a.extractall(d,filter="data"); a.close()', file, dest]);
}
function exportsOf(file) {
  const b = fs.readFileSync(file), pe = b.readUInt32LE(0x3c), count = b.readUInt16LE(pe + 6), optional = pe + 24, sections = optional + b.readUInt16LE(pe + 20);
  const rva = r => {
    for (let i = 0; i < count; i++) {
      const o = sections + i * 40, v = b.readUInt32LE(o + 12), size = Math.max(b.readUInt32LE(o + 8), b.readUInt32LE(o + 16));
      if (r >= v && r < v + size) return r - v + b.readUInt32LE(o + 20);
    }
    throw Error('Invalid public Windows DLL export directory');
  };
  const directory = optional + (b.readUInt16LE(optional) === 0x20b ? 112 : 96), exp = rva(b.readUInt32LE(directory)), names = rva(b.readUInt32LE(exp + 32));
  return Array.from({ length: b.readUInt32LE(exp + 24) }, (_, i) => { const at = rva(b.readUInt32LE(names + i * 4)); return b.subarray(at, b.indexOf(0, at)).toString(); });
}
try {
  const checkout = path.join(work, 'checkout'), source = path.join(work, 'source');
  run('git', ['-c', 'credential.helper=', 'clone', '--no-checkout', 'https://github.com/ezza-dusd/dusd-burn-protocol.git', checkout]);
  run('git', ['-C', checkout, '-c', 'core.autocrlf=false', 'checkout', '--detach', commit]);
  const actual = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(actual, commit);
  const release = JSON.parse(fs.readFileSync(path.join(checkout, candidate ? 'verification/candidate/release.json' : 'verification/release.json')));
  for (const [p, expected] of Object.entries(release.sourceHashes)) {
    const bytes = fs.readFileSync(path.join(checkout, p));
    assert.equal(sha(bytes), expected, 'Source bytes changed: ' + p);
    const dest = path.join(source, p); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes);
  }
  report.sourceHashes = release.sourceHashes;
  const agave = path.join(work, 'agave');
  extract(await download('https://github.com/anza-xyz/agave/releases/download/v4.3.0/solana-release-x86_64-pc-windows-msvc.tar.bz2', '27d598632589970a0516a631aae6f91dcba2a072bdc2a32f9a7f547eae7d726e', path.join(work, 'agave.tar.bz2')), agave);
  // Isolated child-process profile prevents using an existing platform-tools cache.
  const profile = path.join(work, 'profile'), platform = path.join(profile, '.cache/solana/v1.57/platform-tools');
  const platformArchive = await download('https://github.com/anza-xyz/platform-tools/releases/download/v1.57/platform-tools-windows-x86_64.tar.bz2', '792bc821f006e2b56aee31640110b449d5dc89f1305f16f24037465ab8cd7d5a', path.join(work, 'platform.archive'));
  // The upstream Windows asset is ZIP despite its .tar.bz2 filename.
  extract(platformArchive, platform, fs.readFileSync(platformArchive).readUInt16LE() === 0x4b50);
  const tool = path.join(agave, 'solana-release/bin/cargo-build-sbf.exe');
  const linker = path.join(platform, 'llvm/bin/lld-link.exe');
  for (const [file, expected] of [
    [tool, 'cbac285bb4e047ca7180dd9f6ef948d540d5283e27222a3fa6fc74f2592e4575'],
    [path.join(platform, 'rust/bin/rustc.exe'), '8901dc680c791aff34e0744539f5d135b6147b84a105f3487ff6a1d8c1d25e9c'],
    [path.join(platform, 'rust/bin/cargo.exe'), '7f90f84ff2d811caaab060faf69d5221cad01093eb3eeb654d540271048cad03'],
    [linker, 'dae2a9c3b35e263e8df4b7c432e2eab60343b65eda7de3dfd092a0c68c3e02ba']
  ]) assert.equal(sha(fs.readFileSync(file)), expected, 'Compiler executable checksum mismatch');
  const libs = [];
  for (const [kind, digest, id] of [
    ['Desktop', 'f01f701a7bcd9587a340898c851424f6a52bb913a70c185ff0d5bf0288c5831a', '67cf767c-5e71-47c2-a54a-cd5631e28942'],
    ['Store', '9135b03c0df53c7a0aa9bef7230a1c2ff4263a0ee7baa7e419d034f484f6bb56', '67cf767c-5e71-47c2-a54a-cd5631e28942']
  ]) {
    const name = `Microsoft.VC.14.44.17.14.CRT.x64.${kind}.base.vsix`, dest = path.join(work, kind);
    extract(await download(`https://download.visualstudio.microsoft.com/download/pr/${id}/${digest}/${name}`, digest, path.join(work, name)), dest, true);
    // Public package metadata labels the payload 35226, but its directories are 35207.
    const lib = path.join(dest, 'Contents/VC/Tools/MSVC/14.44.35207/lib/x64');
    assert.ok(fs.existsSync(lib), 'Unexpected pinned CRT payload layout'); libs.unshift(lib);
  }
  // Construct import libraries from this machine's public Windows system DLLs.
  // Stub output is isolated and NEVER added to the executable/DLL search path.
  const imports = path.join(work, 'imports'); fs.mkdirSync(imports); const systemDlls = [];
  for (const [name, dll] of [['kernel32','kernel32'],['advapi32','advapi32'],['ole32','ole32'],['oleaut32','oleaut32'],['gdi32','gdi32'],['msimg32','msimg32'],['opengl32','opengl32'],['winspool','winspool'],['userenv','userenv'],['ws2_32','ws2_32'],['bcrypt','bcrypt'],['ntdll','ntdll'],['dbghelp','dbghelp'],['ucrt','ucrtbase'],['vcruntime','vcruntime140'],['vcruntime140_1','vcruntime140_1']]) {
    const prefix = path.join(process.env.SystemRoot, 'System32', dll), ext = fs.existsSync(prefix + '.dll') ? 'dll' : 'drv', file = prefix + '.' + ext;
    systemDlls.push({ name: dll + '.' + ext, sha256: sha(fs.readFileSync(file)) });
    const def = path.join(imports, name + '.def');
    fs.writeFileSync(def, `LIBRARY ${dll}.${ext}\nEXPORTS\n` + exportsOf(file).map(n => `${n}=${dll}.${n}`).join('\n'));
    run(linker, ['/dll','/noentry','/machine:x64','/def:' + def,'/out:' + path.join(imports, dll + '.' + ext),'/implib:' + path.join(imports, name + '.lib')], { stdio: 'pipe' });
  }
  const mriPath = name => JSON.stringify(path.join(imports, name).replaceAll('\\','/'));
  run(path.join(platform, 'llvm/bin/llvm-ar.exe'), ['-M'], { input: `CREATE ${mriPath('msvcrt.lib')}\nADDLIB ${mriPath('ucrt.lib')}\nADDLIB ${mriPath('vcruntime.lib')}\nADDLIB ${mriPath('vcruntime140_1.lib')}\nSAVE\nEND\n`, stdio: ['pipe','inherit','inherit'] });
  libs.push(imports);
  fs.mkdirSync(path.join(source, '.cargo'));
  fs.writeFileSync(path.join(source, '.cargo/config.toml'), '[target.x86_64-pc-windows-msvc]\nlinker = ' + JSON.stringify(linker.replaceAll('\\','/')) + '\nrustflags = ' + JSON.stringify(libs.flatMap(p => ['-L', 'native=' + p.replaceAll('\\','/')])) + '\n');
  // Cargo/build scripts receive only OS essentials, not wallet, SSH, cloud or
  // GitHub credential environment variables from the invoking shell.
  const env = {};
  for (const k of ['SystemRoot','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE','OS']) if (process.env[k]) env[k] = process.env[k];
  Object.assign(env, { USERPROFILE: profile, CARGO_HOME: path.join(work, 'cargo'), CARGO_HTTP_MULTIPLEXING: 'false', RUSTC: path.join(platform, 'rust/bin/rustc.exe'), RUSTDOC: path.join(platform, 'rust/bin/rustdoc.exe'), LIB: libs.join(';'), PATH: path.join(platform,'rust/bin') + ';' + path.join(platform,'llvm/bin') + ';' + process.env.PATH });
  const deploy = path.join(work, 'deploy');
  report.host = { os: os.release(), node: process.version, systemDlls };
  report.buildArgs = ['--manifest-path','programs/dusd_burn/Cargo.toml','--sbf-out-dir',deploy,'--arch','v0','--jobs','2','--tools-version','v1.57','--skip-tools-install','--no-rustup-override','--features','no-idl','--','--locked','--target-dir',path.join(work,'target')];
  const log = fs.openSync(path.join(work, 'build.log'), 'w');
  console.log('Compiling fixed source with a fresh Cargo cache and target; see build.log.');
  const result = spawnSync(tool, report.buildArgs, { cwd: source, env, windowsHide: true, stdio: ['ignore', log, log] }); fs.closeSync(log);
  report.buildExitCode = result.status;
  assert.equal(result.status, 0, 'Compilation failed; see build.log');
  const built = fs.readFileSync(path.join(deploy, 'dusd_burn.so'));
  report.comparison = candidate
    ? { match: sha(built) === release.binarySha256 && built.length === release.binaryBytes,
        binarySha256: sha(built), binaryBytes: built.length, expected: release.binarySha256,
        scope: 'Independent source-to-CANDIDATE comparison; NOT mainnet verification' }
    : await compareMainnet(built, release);
  report.result = report.comparison.match ? 'MATCH' : 'MISMATCH'; save();
  console.log(JSON.stringify(report.comparison, null, 2)); console.log(report.result);
  if (!report.comparison.match) process.exitCode = 1;
} catch (error) {
  report.result = 'ERROR'; report.error = error.message; save(); console.error('ERROR: ' + error.message); process.exitCode = 1;
}
// Build tooling may create an unused random deployment keypair. It is never read,
// signed with, or uploaded; public CI artifacts explicitly allowlist RESULT and logs.
