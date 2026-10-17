# Live mainnet release: 17 October 2026

This record describes the finalized upgrade and smoke-test phase, when upgrade authority was retained. **The authority was subsequently permanently revoked:** see [current finalization evidence](../immutable-20261017/README.md). Historical receipts and snapshots below are preserved. The treasury, token accounts, canonical pool and existing 100% creator-fee allocation are unchanged. The ordinary Pump fee-sharing administrator remains revoked. The owner's production keeper remains disabled.

Start with [machine-readable receipts and results](RESULTS.json). They contain only public addresses, signatures and verified outcomes, not wallets, credentials or signed pending transactions.

## Deployed bytes and independent reproduction

- Program: `6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm`.
- Treasury: `HDwArc1qjz8AQt6J2fDcqoBc3MCxWh5whGYusnBxr3di`.
- Exact source commit: `141268054fd78d1e908f39891cc385ae680ade15`.
- Executable: 230,632 bytes, SHA-256 `ca4c648b5bfe978f4ff65b22730fda501ded8c2231839a9803b327ee4432ac42`.
- Solana Verify normalized hash: `4a830d2199af7fb1b1d66fe2d8f2cda23d9f068c59e2ec9e383ce2dde1c28f9c`.
- [Independent Linux build and full VM regressions](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/39013571235) reproduce those exact bytes from public source. See [build provenance](../candidate/README.md) and [current reproduction instructions](../../VERIFY.md).
- [Finalized upgrade transaction](https://solscan.io/tx/5JPky366Nf58hRZWNGy58aZZkcVviLH6kbZHV95F5i3eHNLm4deKX9onaZddAnyPu2uZb8tdD1EYa6SveypWUwGd).

The separate Windows fingerprint is not the mainnet target. The original Windows-only release is preserved as [historical fingerprints](../live-20261015-release.json) and [historical build research](../BUILD-RESULTS.md).

## Mainnet functional evidence

| Test | Outcome | Fee / compute units |
| --- | --- | --- |
| [Jupiter canonical purchase, caller A](https://solscan.io/tx/2hNhMDu2T6UQ7VAhZpH9MiWGmbdKeyTxfjXcjrfY4t4kxASCKH5EV8ZKWmY2ttr9T8WfGdGt423nX6h1YeTyqh2f) | Spent 0.01 treasury SOL; purchased 5,346.641081 DUSD; burned 5,346.641082 including one donated raw unit. | 5,000 lamports / 109,462 CU |
| [Direct PumpSwap purchase, caller B](https://solscan.io/tx/2Cmy8zHfQMxnzXGgrkpZp1VWSXe7SM5fQyo845gokiSTLBQx3wF7K9GMVTeNiUAnd1d6wnBHuykDDmRjRR56HJV2) | Spent 0.01 treasury SOL; purchased 5,346.197927 DUSD; burned 5,346.197928 including one donated raw unit. | 5,000 lamports / 88,274 CU |
| [Standalone donation burn, caller A](https://solscan.io/tx/5ZxeJALRfjmSwa23iWLfreZY22S4jmwkuC7u6PuBeawVy5FtckBsGo4qXDhAYhAVLKeC2aQRhsfwABZMHuAcTgtY) | Burned all 534.686784 donated DUSD with no spendable native treasury SOL. | 5,000 lamports / 11,464 CU |
| [Empty standalone burn, caller B](https://solscan.io/tx/2uuTdLPqZ8wubJe4XfGtg12WYpQ9kotXhvjK3wYfCqvAZmfPCwn4nKNLpSoDNQjqV8RyYxT5yYkqRiH6S8X2Geo4) | Successful zero-balance no-op. | 5,000 lamports / 9,048 CU |

Both warm purchase callers paid only their network fee. The PDA was trader and burn authority; treasury principal did not enter caller custody. Treasury rent remained 650,240 lamports; designated DUSD and WSOL balances finished at zero. Actual inner SPL Token burns match wrapper receipts. The program verifies the mint supply reduction inside each atomic instruction; independent global supply snapshots can also include unrelated burns.

Nine successful live test transactions, including funding and donations, cost 45,000 lamports in network fees. The additional test-payer purchase principal was capped at 0.011 SOL: 0.01 for the second path and 0.001 for donation inventory. The first path used the owner's separate 0.01 SOL treasury deposit. No creator-fee migration or owner-keeper reactivation occurred.

A Jupiter buy followed by a deliberately ineligible second buy rejected in unsigned mainnet simulation. A prior burn event appeared in those rejected logs; it is **not a successful burn**. No deliberately failed transaction was broadcast. Indexers must require finalized success and `meta.err === null`.

These are live tests from unrelated wallet identities controlled for this test, not proof that a separate person has updated and operated their own keeper. That independent operational handover remains a finalization gate.

## Public interface

The canonical Program Metadata account is `AwcUwoCEP2fWBwtLZwfsU9FAQE15ZVA3zM3JG9G4bhUy`. Its updated four-instruction Codama IDL was verified after decompression against the public file: SHA-256 `44c12b262ac60e56308bec4afc5aefad38cfb8bd50439e3f067742de02f657a4`.

All four interface-update signatures are in [RESULTS.json](RESULTS.json). Metadata remains mutable; its stored optional authority remains `None`, and the program upgrade authority is retained. No metadata immutability or program revocation was performed. Additional metadata rent was 0.00127 SOL, network fees 0.000025 SOL; the temporary metadata buffer rent was returned to the payer.

## Official Verified Builds

[Registration finalized](https://solscan.io/tx/2foyoiggdrVLL27vbJL2SxFpQy6bSRy8QD8APZSbh134iTNkttrG5fZjXMXL6DzwacxMUKLoRDumiKjs7X5BgJkt) with the exact public source commit, official image, architecture and build arguments. Verification metadata PDA: `CL7jADGtS7K5pHWgnt8YZ4J3aVpZsxQREA14QEtMKqhQ`. Actual registration cost: 0.00302252 SOL, including its fee.

Remote job submitted: [b90bbd2c-f150-45c0-9fef-8bbf51d7ea84](https://verify.osec.io/job/b90bbd2c-f150-45c0-9fef-8bbf51d7ea84). **Official remote verification completed successfully at 08:25:40 UTC on 17 October 2026.** The independently fetched [service response](REMOTE-VERIFIED.json) reports `is_verified: true`, identical normalized onchain/build hashes, the exact source commit and a completed job. [Check current official status](https://verify.osec.io/status/6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm). Verification is not security certification or immutability.

## Deployment funding

The temporary 1.17244876 SOL upload buffer was returned to the deployment payer. The upgrade permanently added 0.17255744 SOL in program storage rent and cost 0.0013 SOL in network fees across 260 transactions. The full payer debit reconciled exactly; the first deployment's original storage funds were not charged again. Unused funds stay in the payer, not automatically refunded to the owner's personal wallet.

[Final independent reconciliation](FINAL-VERIFICATION.json), finalized slot 457970577, confirms all 274 submitted release/test/interface/registration transactions succeeded. The payer retains **1.186930000 SOL** after all these steps. The funding bridge includes the owner's 1.37 SOL transfer and a separate unsolicited 1,000-lamport dust transfer. Never choose a refund recipient by copying a sender from transaction history; the dust sender is not an authorized recipient.

## Subsequent permanent revocation

After review of the build/interface evidence and a genuine independent creator-fee-to-burn cycle, the user separately approved permanent revocation. The finalized transaction and independent read-back are in [finalization evidence](../immutable-20261017/README.md). The retained-authority tests above preceded that action and should not be described as post-revocation live purchases.
