import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const release=read('verification/release.json'),evidence=read('verification/immutable-20261017/RESULTS.json');
test('live manifest and finalized immutable evidence identify the same program and executable',()=>{
 assert.equal(release.upgradeAuthority,null);assert.equal(evidence.revocation.currentUpgradeAuthority,null);assert.equal(evidence.revocation.immutable,true);
 assert.equal(evidence.revocation.finalized,true);assert.equal(release.programId,evidence.revocation.program);assert.equal(release.programData,evidence.revocation.programData);
 assert.equal(release.fullElfSha256,evidence.revocation.fullElfSha256);assert.equal(release.authorityRevocation.signature,evidence.revocation.signature);assert.equal(release.authorityRevocation.slot,evidence.revocation.transactionSlot);
});
test('post-revocation evidence preserves custody and distinguishes simulations from real burns',()=>{
 assert.equal(evidence.postChecks.authorityOnBothProviders,null);assert.equal(evidence.postChecks.soleRecipient,release.treasury);assert.equal(evidence.postChecks.allocationBps,10000);assert.equal(evidence.postChecks.feeSharingAdminRevoked,true);
 assert.equal(evidence.postChecks.postRevocationUnsignedStandaloneBurn.err,null);assert.equal(evidence.postChecks.transactionsSubmitted,0);assert.equal(evidence.postChecks.transactionsSigned,0);assert.equal(evidence.postChecks.walletLoaded,false);
 assert.equal(evidence.postChecks.livePurchaseAfterRevocationProven,false);assert.equal(evidence.revocation.treasuryUsed,false);assert.equal(evidence.revocation.keeperChanged,false);
});
test('published finalization evidence contains no signing material or pending wire',()=>{
 const json=JSON.stringify(evidence);assert.doesNotMatch(json,/wireBase64|secretKey|privateKey|encryptedCredential|BEGIN .*PRIVATE KEY/);
 assert.equal(evidence.postChecks.officialVerification.is_verified,true);assert.equal(evidence.postChecks.officialVerification.on_chain_hash,release.solanaVerifyExecutableHash);
});
