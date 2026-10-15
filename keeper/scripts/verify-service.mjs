// Validate public service syntax without installing or starting a service.
// CI's setup-node path differs from a system installation; substitute only
// that executable path in a temporary copy, as the runbook requires.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
assert.equal(process.platform, 'linux');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dusd-unit-check-'));
try {
  const original = fs.readFileSync(new URL('../service/dusd-keeper.service', import.meta.url), 'utf8');
  assert.equal(original.split('ExecStart=/usr/bin/node ').length, 2);
  fs.writeFileSync(path.join(dir, 'dusd-keeper.service'), original.replace('ExecStart=/usr/bin/node ', `ExecStart=${process.execPath} `));
  fs.copyFileSync(new URL('../service/dusd-keeper.timer', import.meta.url), path.join(dir, 'dusd-keeper.timer'));
  execFileSync('systemd-analyze', ['verify', path.join(dir, 'dusd-keeper.service'), path.join(dir, 'dusd-keeper.timer')], {stdio:'inherit'});
  console.log(JSON.stringify({serviceSyntaxVerified:true, nodePath:process.execPath, servicesInstalled:false, transactionsSubmitted:0}));
} finally {
  assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(dir).startsWith('dusd-unit-check-'));
  fs.rmSync(dir, {recursive:true, force:true});
}
