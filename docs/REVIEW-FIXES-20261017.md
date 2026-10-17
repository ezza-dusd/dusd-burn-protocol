# Adversarial review corrections

17 October 2026. Undeployed candidate only. No live program, authority, fee sharing, wallet or keeper was changed.

## R1: Complete Jupiter route framing

The earlier wrapper checked the last four supplied bytes rather than proving they were the route's actual allocation/index fields. Jupiter accepts ignored trailing data. A 50% route with a forged 100% suffix passed initial validation, then rolled back at the existing exact-WSOL-spend check. No fund theft was demonstrated. The keeper's parser shared this framing weakness.

Both parsers now accept exactly the verified 40-byte `route_v2` encoding: fixed discriminator, zero platform/surplus fees, one route-plan entry, PumpSwap enum 193, one valid Borsh boolean, and the actual 10,000-bps / input-0 / output-1 fields at offsets 36–39. Suffixes, truncation, unsupported variants and invalid booleans reject before Jupiter executes. The client mirrors these checks. Exact-spend, pool, signer, custody, reserve and full-burn postconditions remain intact. No price formula, fee-tier model or discretionary control was introduced.

Compatibility is explicit: Jupiter can change its underlying Pump CPI while retaining this supported adapter encoding. A new enum or serialization is not silently accepted. The current adapter still uses the same native Pump exact-input instruction as the direct path. This is useful alternative integration, not a guarantee of support for every future upstream change.

## R2: Independent donation burning in the keeper

Previously, eligible native SOL selected the purchase branch; rejection of both swap paths suppressed standalone donation burning. The contract itself was not affected.

The coordinator now isolates unsigned simulation rejection by phase. It rereads finalized state and checks fee allocation after every such rejection. Collection, unwrap or purchase rejection cannot suppress a positive-balance standalone burn. An unsigned Jupiter build/API failure is isolated too. A successful alternative resolves the direct failure; eligible unresolved work is reported as `blocked` or `partial-completion` with `healthy: false`, not hidden behind success. Status retains rejection details without signed wire.

Transport errors inside submission, pending signed wire, finalized failed submissions, invalid refreshed state and shutdown still stop the cycle. There is no alternate send after ambiguity. The three-signed-sends limit remains. Newly arriving donations after the third successful transaction wait for the next cycle.

## Reproduction

```sh
npm run prepare:local
npm test
npm test --prefix keeper
node --test scripts/verify-bytecode.test.mjs
node scripts/check-source.mjs
```

The complete contract suite includes new route tests and the separate review's custody/liveness tests. See [current evidence](../verification/candidate/README.md) for actual counts, hashes and independent build status. Passing tests are not third-party security certification.

Regressions include the original forged suffix, partial allocations and reversed indexes, unsupported adapter tags, invalid booleans, hostile AMM custody mutations through real Jupiter, prefunded ATAs/accumulator, unsynchronized WSOL donations, collection/unwrap failures, both swap rejections, unavailable build API, pending wire, submission uncertainty, finalized failures, shutdown, raced-away donations and successful alternative health reporting.

## Release boundary

The Rust interface, fixed addresses, output floor, treasury threshold and economic policy are unchanged; executable bytes changed. The candidate manifest and keeper pin reference the new ELF. Historical evidence is retained under `verification/candidate/history/pre-review-fixes/` and cannot certify the new source. Current independent CI records are replaced only after exact-source/hash matching.

Before any mainnet upgrade, approve the exact artifact and costs, retain upgrade authority and test both paths, donation burns and rollback live. Official verification registration and eventual irreversible revocation remain separate approvals. The owner's deliberately disabled production keeper stays disabled.
