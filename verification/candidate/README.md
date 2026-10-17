# Candidate evidence, 17 October 2026

This folder preserves **build-time candidate evidence**. The selected Linux artifact was subsequently deployed in the approved 17 October upgrade; see [current live evidence](../live-20261017/README.md). The original build manifests retain their historical status labels. These records themselves authorize no transaction, fee migration or authority revocation.

Start with [protocol changes](../../docs/CANDIDATE-20261016.md), [adversarial corrections](../../docs/REVIEW-FIXES-20261017.md) and [release checklist](../../docs/UPGRADE-AND-FINALIZATION-CHECKLIST.md).

| Evidence | Meaning |
| --- | --- |
| [release.json](release.json) | Current four compiler inputs, selected Linux ELF and separate Windows ELF. |
| [LOCAL-VALIDATION.json](LOCAL-VALIDATION.json) | Actual local regressions, coordinator, arithmetic and lifecycle results. |
| [WINDOWS-TEST-SUMMARY.json](WINDOWS-TEST-SUMMARY.json) | Local Windows-artifact tests or explicit pending status. |
| [INDEPENDENT-LINUX-BUILD.json](INDEPENDENT-LINUX-BUILD.json) | Independent current-source build result or explicit pending status. |
| [INDEPENDENT-WINDOWS-BUILD.json](INDEPENDENT-WINDOWS-BUILD.json) | Independent separate Windows fingerprint result or explicit pending status. |
| [INDEPENDENT-TEST-SUMMARY.json](INDEPENDENT-TEST-SUMMARY.json) | Independent current-source regressions or explicit pending status. |
| [READONLY-PREFLIGHT.json](READONLY-PREFLIGHT.json) | Finalized live identities, PDA fee allocation and rent estimate. |
| [Historical pre-correction evidence](history/pre-review-fixes/release.json) | Old review/build fingerprints; these do not verify the new source. |
| [Older partial-input proof](OLDER-PARTIAL-INPUT-PROOF.json) | Historical mocked underspend, not a current Pump exploit. |

## Current build

Rust SHA256: `daa995ce3d84b5b5b8218c62a65ee60b46a52acc4031190acdb6b692656370b1`.

Selected Linux ELF: `ca4c648b5bfe978f4ff65b22730fda501ded8c2231839a9803b327ee4432ac42`, 230,632 bytes. Normalized Solana Verify hash: `4a830d2199af7fb1b1d66fe2d8f2cda23d9f068c59e2ec9e383ce2dde1c28f9c`.

Separate Windows ELF: `1f978a1bfcc0afba78d20fdd751c2cdc52b12723040de7e7fa4b26772c468473`, 230,632 bytes. This is a separate host fingerprint of the same source, not cross-platform byte equality.

Local tests after correction: **255 contract tests**, **104 keeper tests**, **11 bytecode-helper tests**, all passing; 25,000 arithmetic cases, 391 deterministic malformed-route probes and 17 direct exact-input feasibility probes. Independent build/test status must be read from the current records above; historical successful workflows do not verify changed source.

## Independent reproduction completed

Exact source commit: `141268054fd78d1e908f39891cc385ae680ade15`. Subsequent evidence-only commits preserve the four compiler inputs and tested runtime source.

- [Official Linux build and full regressions: passed](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/39013571235). The downloaded ELF matches the locally tested selected bytes exactly; 255 contract tests passed with zero failures. Hosted keeper and verification-helper tests also passed.
- [Independent Windows build: passed](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/39013571215). Its separate expected fingerprint matches exactly. Local execution of this Windows-built artifact passed all 255 contract tests.
- [Linux/Windows keeper tests: passed](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/39013571219).

The import helper checked both commits, all source fingerprints, both binary hashes, exact Linux bytes and agreement with the local test count before replacing pending records. No historical success was reused as evidence for the corrected source.

## Status boundary

Build matching is not an independent security audit or completed official onchain verification. The approved upgrade and controlled direct/Jupiter/donation mainnet smoke tests are now finalized with upgrade authority retained. Official registration and remote-job status are recorded in [live evidence](../live-20261017/README.md). Both purchase paths are deployed, through the same fixed canonical pool. Permanent revocation remains a separate decision.
