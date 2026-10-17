# Candidate evidence, 17 October 2026

This folder concerns an **undeployed review candidate**, not the current mainnet program. No transaction, upgrade, fee migration or authority revocation was performed during this work.

Start with the [plain protocol changes](../../docs/CANDIDATE-20261016.md), [engineering security review](../../docs/CANDIDATE-SECURITY-REVIEW.md) and [release checklist](../../docs/UPGRADE-AND-FINALIZATION-CHECKLIST.md).

| Evidence | What it establishes |
| --- | --- |
| [release.json](release.json) | Four source fingerprints, selected official Linux ELF and separate Windows ELF. |
| [LOCAL-VALIDATION.json](LOCAL-VALIDATION.json) | Actual local contract, coordinator, arithmetic and lifecycle results for the selected artifact. |
| [WINDOWS-TEST-SUMMARY.json](WINDOWS-TEST-SUMMARY.json) | Local full regression result for the secondary Windows artifact. |
| [INDEPENDENT-LINUX-BUILD.json](INDEPENDENT-LINUX-BUILD.json) | GitHub-hosted official-container build matches the selected ELF exactly. |
| [INDEPENDENT-WINDOWS-BUILD.json](INDEPENDENT-WINDOWS-BUILD.json) | Fresh GitHub Windows build matches its separate expected fingerprint. |
| [INDEPENDENT-TEST-SUMMARY.json](INDEPENDENT-TEST-SUMMARY.json) | Independent Linux execution: 227 tests passed, zero failed. |
| [READONLY-PREFLIGHT.json](READONLY-PREFLIGHT.json) | Finalized unchanged live bytes/authority, upstream binaries, revoked ordinary fee admin, 100% PDA allocation and upgrade-rent estimate. |
| [OLDER-PARTIAL-INPUT-PROOF.json](OLDER-PARTIAL-INPUT-PROOF.json) | Local mocked underspend accepted by an older artifact; not an alleged current Pump exploit. |

## Independent build runs

The frozen monetary source is commit `8f0d0c8e3a347cc3317952beb1d9e49f1a3899a5`, Rust SHA256 `793f053cf1b0bf58168f5f906f67c3374340872709dc9ee92cfc262feaf8da48`. Later documentation/evidence commits must not change the four compiler inputs; their hashes are recorded in the manifest.

- [Official Linux reproduction and complete VM regressions](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/39011174013).
- [Separate Windows source reproduction](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/39011173824).
- [Linux/Windows public keeper tests](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/39011174047).

All three frozen-source runs completed successfully. The independent Linux artifact is byte-for-byte identical to the locally tested selected ELF. Selected full hash: `b452de1ee17aa07c60d394b65f78b33554affd74dca32bc9efd39f62bd6e3d51`, 230,528 bytes. The Windows ELF is deliberately a separate hash, not a cross-platform match. Check the linked run conclusions and retained evidence directly.

The earlier clean Linux run reproduced the previous candidate but failed its report-writing hook because an output directory was absent. That test-runner issue was corrected before this frozen source run. Intermediate successful builds do not certify later source changes.

## Status boundary

Build reproduction is not official onchain Verified Builds registration, and tests are not an independent audit certificate. Official registration and remote verification remain pending. The live program is still the old `0d91e31…` binary with upgrade authority retained. New mainnet upgrade and controlled smoke tests require approval; permanent revocation is a later, separate irreversible approval.

The current Jupiter adapter still calls PumpSwap's native exact-input instruction. The alternative supplies a compatible-adapter opportunity, not a guarantee that any future Pump/Jupiter change will work. Both paths remain restricted to the same canonical pool.
