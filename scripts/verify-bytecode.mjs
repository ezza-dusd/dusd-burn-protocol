import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export function fingerprint(bytes) {
  let end = bytes.length; while (end && bytes[end - 1] === 0) end--;
  return { bytes: bytes.length, fullSha256: sha(bytes), executableHash: sha(bytes.subarray(0, end)) };
}
function base58(bytes) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let n = 0n, s = '';
  for (const b of bytes) n = n * 256n + BigInt(b);
  while (n) { s = alphabet[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b) break; s = '1' + s; } return s;
}
export async function compareMainnet(compiled, release, transport = fetch) {
  const url = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  assert.equal(new URL(url).protocol, 'https:');
  async function rpc(method, params = []) {
    const r = await transport(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(60000) });
    assert.ok(r.ok, 'RPC HTTP ' + r.status); const j = await r.json(); assert.ok(!j.error, 'RPC rejected request'); return j.result;
  }
  assert.equal(await rpc('getGenesisHash'), '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d', 'Not mainnet');
  const r = await rpc('getMultipleAccounts', [[release.programId, release.programData], { commitment: 'finalized', encoding: 'base64' }]);
  const [program, data] = r.value; assert.ok(program && data, 'Missing deployed program');
  const loader = 'BPFLoaderUpgradeab1e11111111111111111111111';
  assert.equal(program.owner, loader); assert.equal(data.owner, loader); assert.equal(program.executable, true);
  const p = Buffer.from(program.data[0], 'base64'), pd = Buffer.from(data.data[0], 'base64');
  assert.equal(p.length, 36); assert.equal(p.readUInt32LE(), 2); assert.equal(base58(p.subarray(4)), release.programData);
  assert.ok(pd.length > 45); assert.equal(pd.readUInt32LE(), 3); assert.ok(pd[12] === 0 || pd[12] === 1);
  const built = fingerprint(compiled), deployed = fingerprint(pd.subarray(45));
  return { slot: r.context.slot, programId: release.programId, programData: release.programData, commitment: 'finalized', built, deployed, match: built.bytes === deployed.bytes && built.fullSha256 === deployed.fullSha256 && built.executableHash === deployed.executableHash, releaseReferenceUnchanged: deployed.fullSha256 === release.fullElfSha256, currentUpgradeAuthority: pd[12] ? base58(pd.subarray(13,45)) : null };
}
