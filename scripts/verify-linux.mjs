// Current Linux source -> finalized mainnet comparison. No signer or RPC writes.
import fs from 'node:fs';import assert from 'node:assert/strict';
import './verify-linux-candidate.mjs';
import {compareMainnet} from './verify-bytecode.mjs';
const root=new URL('../',import.meta.url),release=JSON.parse(fs.readFileSync(new URL('verification/release.json',root)));
const compiled=fs.readFileSync(new URL('target/deploy/dusd_burn.so',root));
const result={at:new Date().toISOString(),...await compareMainnet(compiled,release),walletLoaded:false,transactionsSubmitted:0};
fs.writeFileSync(new URL('verification/LINUX-MAINNET-RESULT.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));assert.equal(result.match,true,'Fresh Linux build does not match finalized mainnet');assert.equal(result.releaseReferenceUnchanged,true,'Live release fingerprint mismatch');
