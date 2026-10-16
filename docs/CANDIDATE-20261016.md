# Canonical-pool Jupiter candidate

Status: local review candidate, not deployed. No change to creator-fee allocation, PDA identity, production keeper or mainnet authority.

## Monetary rules

Both purchase instructions spend all native treasury SOL above the zero-data rent reserve, requiring at least 10,000,000 spendable lamports. Only the existing canonical DUSD/SOL PumpSwap pool is permitted. No Meteora, BTC2, GAS, intermediate token, split route or alternative pool is allowed. The output floor remains one raw DUSD unit. Every designated-account DUSD token, including donations, is burned atomically. Standalone burning and WSOL recovery are unchanged. There is no withdrawal, administrator, reward, cooldown, price oracle or adjustable monetary parameter.

`execute_jupiter_buy_and_burn(route_data)` accepts the current `route_v2` instruction payload. The program validates its header, exact current input, zero platform/surplus fees and one 100% WSOL-to-DUSD hop. It fixes the router, source, destination, token programs and canonical pool. It rewrites quoted output to one and slippage to zero so Jupiter enforces the same one-raw-unit floor as the direct path. This does **not** promise fair-market pricing or enforce Jupiter RTSE. AMM trading fees still apply and are calculated upstream.

Only the treasury PDA is forwarded as signer to Jupiter. The external caller is forbidden in its account list. Account initialization is caller funded. After CPI, custody, delegate and close-authority checks protect the treasury and token accounts; the native reserve, WSOL balance and full burn are checked before success.

## What the alternative does and does not solve

The copied current Jupiter program successfully calls PumpSwap `BuyExactQuoteInV2`, the **same instruction used by the direct path**. It is not presently a different-instruction escape hatch. If that Pump instruction is retired, Jupiter would need to support a replacement adapter compatible with our fixed router/header/account checks. This is possible resilience, not guaranteed longevity. Both paths still require the canonical pool and upstream programs to work. JUP6 itself is an additional fixed, upgradeable dependency. A new JUP7 address would not automatically be accepted.

Anyone may choose either entry point. There is no administrator failover switch and no claim that a caller can prove permanent deprecation. The supplied client tries direct execution first; only an unsigned simulation rejection with no pending wire can initiate an alternative attempt. Network errors or ambiguous submitted transactions never cause automatic replacement spending.

## Reproduction

Pinned Anchor 0.32.1, Agave cargo-build-sbf 4.3.0, platform-tools v1.57, SBF v0, no-idl and the committed Cargo.lock. Candidate exact bytes and source hashes are in the candidate manifest. The separate Windows workflow builds the exact pushed commit and compares it to that manifest, not to the old live program. Official Solana Verified Builds is still pending, not certified by this workflow.

For local VM regression, use Node 24+, the committed npm lockfile and Rust toolchain compatible with the harness lockfile. Run `npm ci --ignore-scripts`, build this Anchor source into `target/deploy/dusd_burn.so`, then `cargo build --manifest-path harness/Cargo.toml`. The harness executable must be named `harness/target/debug/dusd-svm-harness[.exe]` (or point `DUSD_SVM_HARNESS` at the compiled binary). Run `npm run prepare:local`, `npm test` and `npm run test:jupiter`. Local fixture preparation creates only unfunded simulation identities; it never loads production wallets. Reports use local VM signatures, not live transactions.

The Jupiter snapshot is public finalized mainnet data from slot 457775786. Its binary SHA256 is `099da3a26d336aa7174960f057546f192fc1ccda8e3e9d1b4aa5c69fa8a79a5f`. Pool/fee snapshot provenance and upstream ELF hashes remain in their manifests. A missing Pump accumulator must be initialized using a caller-funded public instruction; it must not be silently paid out of treasury principal.

## Release gates

1. All existing regressions, new Jupiter adversarial tests and custody mutation tests pass on the final candidate bytes.
2. Independent clean build matches; source, IDL, client and evidence describe the exact same candidate.
3. Review the added router parser and privilege forwarding independently. Existing security review of the old binary does not certify this new code.
4. Obtain explicit approval for an exact mainnet upgrade and funded smoke tests. Confirm available program allocation/rent; do not guess a zero-cost upgrade.
5. Verify finalized direct, Jupiter, standalone donation, caller-rent and rollback receipts against the deployed candidate. Refresh the published IDL and executable pins.
6. Verify independent recurring execution and indexing of successful finalized receipts only. Keep Markets custody separate.
7. Only after reviewing those results, separately approve irreversible upgrade-authority revocation. Read back the loader authority as `None`, verify bytes again and publish final evidence. A PDA has no private-key authority to burn; program immutability is the relevant action.

No deadline is a substitute for these checks.
