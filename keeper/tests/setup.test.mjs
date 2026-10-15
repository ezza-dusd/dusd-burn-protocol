import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');

test('service uses an isolated gas signer and persistent external journal', () => {
  const service = read('../service/dusd-keeper.service');
  for (const line of ['Type=oneshot','User=dusd-keeper','Group=dusd-keeper','Environment=KEEPER_KEYPAIR=/var/lib/dusd-keeper/gas.json','Environment=DUSD_KEEPER_STATE=/var/lib/dusd-keeper/state','ExecStart=/usr/bin/node /opt/dusd-keeper/keeper/cli.mjs --execute','LimitCORE=0','UMask=0077','NoNewPrivileges=true','ProtectSystem=strict','ReadWritePaths=/var/lib/dusd-keeper']) assert.ok(service.split('\n').includes(line), line);
  assert.doesNotMatch(service, /^Restart=/m);
});
test('timer schedules after completion rather than overlapping cycles', () => {
  const timer = read('../service/dusd-keeper.timer');
  for (const line of ['OnBootSec=60s','OnUnitInactiveSec=60s','Unit=dusd-keeper.service','WantedBy=timers.target']) assert.ok(timer.split('\n').includes(line), line);
  assert.doesNotMatch(timer, /OnCalendar=|OnUnitActiveSec=/);
});
test('runbook has executable setup, approval and recovery steps', () => {
  const guide = read('../../KEEPER.md');
  for (const text of ['git checkout --detach PINNED_COMMIT','npm ci --omit=dev --ignore-scripts','npm test','node cli.mjs --check','Approval checkpoint','--new-wallet /var/lib/dusd-keeper/gas.json','systemd-analyze verify','enable --now dusd-keeper.timer','state/journal.json','run.lock','unknown expired signatures','Handover checklist']) assert.ok(guide.includes(text), text);
  assert.ok(guide.indexOf('Approval checkpoint') < guide.indexOf('## 3. After approval'));
  assert.doesNotMatch(guide, /curl[^\n]*\|\s*(?:sh|bash)/);
});
test('relative Markdown links in the agent entry points resolve locally', () => {
  for (const file of ['../../KEEPER.md','../README.md','../AGENTS.md','../../verification/README.md']) {
    const url = new URL(file, import.meta.url);
    for (const match of fs.readFileSync(url, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
      if (/^https?:/.test(match[1])) continue;
      assert.ok(fs.existsSync(new URL(match[1].split('#')[0], url)), `${file}: ${match[1]}`);
    }
  }
});
