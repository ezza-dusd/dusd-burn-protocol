// Kernel-managed IPC lock: automatically released on exit, SIGKILL or reboot.
// run.lock is diagnostic metadata only. It is never the exclusion mechanism.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

export async function acquireLock(directory) {
  fs.mkdirSync(directory, {recursive:true, mode:0o700});
  const real = fs.realpathSync(directory);
  const identity = process.platform === 'win32' ? real.toLowerCase() : real;
  const hash = crypto.createHash('sha256').update(identity).digest('hex');
  assert.ok(['linux','win32'].includes(process.platform), 'Kernel lock supports Linux and Windows; do not bypass it on another OS');
  const address = process.platform === 'linux' ? '\0dusd-keeper-'+hash : '\\\\.\\pipe\\dusd-keeper-'+hash;
  const server = net.createServer(socket => socket.destroy());
  await new Promise((resolve,reject) => {
    server.once('error', reject);
    server.listen(address, resolve);
  }).catch(error => {
    if (error.code === 'EADDRINUSE') throw Object.assign(new Error('Keeper already running for this state directory'), {code:'EEXIST'});
    throw error;
  });
  const file = path.join(real, 'run.lock'), nonce = crypto.randomUUID();
  const close = () => new Promise((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
  try {
    if (fs.existsSync(file)) {
      const stat = fs.lstatSync(file);
      assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'Invalid lock metadata file');
      const old = JSON.parse(fs.readFileSync(file,'utf8'));
      if (old.kind !== 'kernel-ipc-v1') {
        assert.ok(Number.isSafeInteger(old.pid) && old.pid > 0, 'Malformed legacy lock; inspect before upgrade');
        let alive = true;
        try { process.kill(old.pid,0); } catch (e) { if (e.code === 'ESRCH') alive = false; else throw e; }
        assert.ok(!alive, 'Legacy keeper PID may still be running; stop and verify it before upgrading');
      }
    }
    const temp = file+'.'+nonce;
    const fd=fs.openSync(temp,'wx',0o600);
    try {fs.writeFileSync(fd,JSON.stringify({kind:'kernel-ipc-v1',pid:process.pid,nonce,startedAt:new Date().toISOString()})+'\n');fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
    fs.renameSync(temp,file);
  } catch (e) { await close(); throw e; }
  let released=false;
  return async () => {
    if (released) return;
    released=true;
    // Remove only our metadata while still holding the kernel lock.
    try { if (JSON.parse(fs.readFileSync(file,'utf8')).nonce === nonce) fs.unlinkSync(file); }
    finally { await close(); }
  };
}
