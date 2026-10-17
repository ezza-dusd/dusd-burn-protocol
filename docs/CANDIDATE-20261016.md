# Canonical-pool Jupiter candidate

Status: local review candidate, not deployed. No change to creator-fee allocation, PDA identity, production keeper or mainnet authority.

## Monetary rules

Both purchase instructions spend all native treasury SOL above the zero-data rent reserve, requiring at least 10,000,000 spendable lamports. Only the existing canonical DUSD/SOL PumpSwap pool is permitted. No Meteora, BTC2, GAS, intermediate token, split route or alternative pool is allowed. The output floor remains one raw DUSD unit. Every designated-account DUSD token, including donations, is burned atomically. Standalone burning and WSOL recovery are unchanged. There is no withdrawal, administrator, reward, cooldown, price oracle or adjustable monetary parameter.

`execute_jupiter_buy_and_burn(route_data)` accepts the verified 40-byte `route_v2` single-PumpSwap-adapter encoding (enum tag 193 and one Borsh boolean). It rejects unsupported encodings, ignored suffixes and invalid booleans, and checks the actual step fields at their decoded offsets: zero platform/surplus fees and one 100% WSOL-to-DUSD hop. It fixes the router, source, destination, token programs and canonical pool. It replaces the payload input with the actual spendable treasury balance at execution, quoted output with one and slippage with zero. A caller cannot set the spend amount, and new SOL donations cannot stale an otherwise valid route. Jupiter enforces the same one-raw-unit floor as the direct path. This **does not** promise fair-market pricing or enforce Jupiter RTSE. AMM trading fees still apply and are calculated upstream. Adapter implementation updates behind this encoding may remain compatible; a new enum or serialization is not automatically accepted. See the [review corrections](REVIEW-FIXES-20261017.md).

Only the treasury PDA is forwarded as signer to Jupiter. The external caller is forbidden in its account list. Account initialization is caller funded. After CPI, custody, delegate and close-authority checks protect the treasury and token accounts; the native reserve, WSOL balance and full burn are checked before success.

## What the alternative does and does not solve

The copied current Jupiter program successfully calls PumpSwap `BuyExactQuoteInV2`, the **same instruction used by the direct path**. It is not presently a different-instruction escape hatch. If that Pump instruction is retired, Jupiter would need to support a replacement adapter compatible with our fixed router/header/account checks. This is possible resilience, not guaranteed longevity. Both paths still require the canonical pool and upstream programs to work. JUP6 itself is an additional fixed, upgradeable dependency. A new JUP7 address would not automatically be accepted.

Anyone may choose either entry point. There is no administrator failover switch and no claim that a caller can prove permanent deprecation. The supplied client tries direct execution first; only an unsigned simulation rejection with no pending wire can initiate an alternative attempt. Network errors or ambiguous submitted transactions never cause automatic replacement spending.

Collection or purchase simulation rejection no longer suppresses independent donation burning. The client rereads finalized state, attempts a standalone positive-balance burn when safe, and reports any unresolved eligible work as unhealthy. An unsigned Jupiter build failure is isolated too. It never continues after uncertain signed wire or a submission transport error, and it never exceeds three signed sends per cycle.

## Reproduction

Pinned Anchor 0.32.1, platform-tools v1.57, SBF v0, no-idl and the committed Cargo.lock. The proposed deployment artifact is now built with official solana-verify 0.5.2 in the digest-pinned Linux container recorded in the candidate manifest. This is possible because an actual security/compatibility upgrade is already under review; it does not change the old live binary simply for verification. The Windows build remains a separate byte fingerprint of the same source, not an identical cross-platform binary. Both CI workflows build exact pushed source; the Linux workflow also executes the complete VM suite. Official onchain registration and remote Verified Builds are still pending and require separate approval after deployment of approved bytes.

For local VM regression, use Node 24+, the committed npm lockfile and Rust 1.99.0 (the host harness compiler, separate from the pinned SBF compiler). Run `npm ci --ignore-scripts` at the root and `npm ci --omit=optional --ignore-scripts --prefix keeper`. Build this Anchor source into `target/deploy/dusd_burn.so`, then `cargo +1.99.0 build --locked --manifest-path harness/Cargo.toml`. The harness executable must be named `harness/target/debug/dusd-svm-harness[.exe]` (or point `DUSD_SVM_HARNESS` at the compiled binary). Run `npm run prepare:local` and `npm test`. The latter includes existing, Jupiter and hostile upstream tests. Run `npm test --prefix keeper` for the separate coordinator suite. Local fixture preparation creates only unfunded simulation identities; it never loads production wallets. Reports use local VM signatures, not live transactions. Public hostile-mock Rust source and its lockfile are under `harness/mock-amm`; its prebuilt local-test binary is never a proposed upstream deployment.

The Jupiter snapshot is public finalized mainnet data from slot 457775786. Its binary SHA256 is `099da3a26d336aa7174960f057546f192fc1ccda8e3e9d1b4aa5c69fa8a79a5f`. Pool/fee snapshot provenance and upstream ELF hashes remain in their manifests. A missing Pump accumulator must be initialized using a caller-funded public instruction; it must not be silently paid out of treasury principal.

## Release gates

1. All existing regressions, new Jupiter adversarial tests and custody mutation tests pass on the final candidate bytes.
2. Independent clean Linux build matches; source, IDL, client and evidence describe the exact same candidate. A Windows match alone is not evidence for the selected Linux ELF.
3. Review the added router parser and privilege forwarding independently. Existing security review of the old binary does not certify this new code.
4. Obtain explicit approval for an exact mainnet upgrade and funded smoke tests. Confirm available program allocation/rent; do not guess a zero-cost upgrade.
5. Verify finalized direct, Jupiter, standalone donation, caller-rent and rollback receipts against the deployed candidate. Refresh the published IDL and executable pins.
6. Verify independent recurring execution and indexing of successful finalized receipts only. Keep Markets custody separate.
7. Only after reviewing those results, separately approve irreversible upgrade-authority revocation. Read back the loader authority as `None`, verify bytes again and publish final evidence. A PDA has no private-key authority to burn; program immutability is the relevant action.

No deadline is a substitute for these checks.
