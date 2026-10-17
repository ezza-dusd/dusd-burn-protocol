# Candidate evidence, 17 October 2026

This folder describes an **undeployed candidate**. These records authorize no transaction, upgrade, fee migration or authority revocation.

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

## Status boundary

Build matching is not an independent security audit or official onchain verification. Official registration and remote verification remain pending. Mainnet still has the old `0d91e31…` binary and retained upgrade authority. An exact approved upgrade and controlled live smoke tests come before any separate irreversible revocation decision. Both purchase paths remain available in the candidate, through the same fixed canonical pool.
