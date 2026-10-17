> **Historical investigation of the superseded 15 October executable.** The approved 17 October upgrade uses a separately reviewed Linux-built candidate. See [current live evidence](live-20261017/README.md).

# Standard Linux build: compatibility and approval gates

This is a proposal only. No mainnet transaction, upgrade, creator-fee change or keeper change is authorised by build verification.

## Candidate

Compile the same four public compiler inputs from commit `72f34f97b8540066f1c84aa91d776e49a86b7479` using the digest-pinned image and exact `solana-verify` 0.5.2 command in [BUILD.md](../BUILD.md). Preserve architecture v0, `no-idl`, lockfile, crate types and release profile. The prior official build and a second clean native-registry Linux build produced the same 196,664-byte Linux executable, different from Windows mainnet. That is evidence of repeatability in the tested environments, not yet an unrelated public Linux CI result or successful remote verification job.

## What changes and what does not

| Area | Proposed effect |
| --- | --- |
| Monetary Rust source and dependencies | No changes. |
| Instruction data, accounts, errors and events | No intended changes; revalidate against IDL and builders. |
| Program ID, PDA seeds, account addresses | Unchanged in an in-place upgrade. |
| Treasury funds and fee-sharing configuration | No migration or transfer required. |
| Deployed ELF | Changes from Windows-built bytes to Linux-built bytes; layout, paths and relocations differ. |
| Execution and compute | Must be measured on the actual Linux artifact; not guaranteed by matching source. |
| Operational keeper | No interface change expected; integration regression required. |
| Upgrade authority | Existing authority must approve/sign separately; retain through testing. |
| Official verification | A reproducible matching deployed Linux artifact removes the observed hash blocker, but registration and actual remote success must still be demonstrated. |

## Required work before any approval request

1. Build on at least two independent clean Linux runners with pinned image, source, tools and dependencies. Compare full and normalized hashes and publish logs/provenance.
2. Run the complete adversarial/LiteSVM suite against that exact Linux ELF, including fee collection, repeated unrelated callers, threshold/rent accounting, WSOL recovery, substitutions, rollback and full-balance burns. Compare compute against the current ELF.
3. Deploy only to a disposable devnet instance under separate approval, accounting for the different test fixed accounts. Verify the intended mainnet ELF separately with local snapshots of real mainnet upstream programs/accounts. Do not represent devnet's mint/pool variant as byte-identical mainnet validation.
4. Ask an independent reviewer to assess compiler/codegen and upgrade risks. Unchanged source is not a byte-level equivalence proof.
5. Prepare an unsigned in-place upgrade, actual fees/rent/size checks, exact buffer hashes, authority checks, rollback ELF and a keeper-continuity plan. Obtain explicit approval before signing, funding buffers or broadcasting. A normal same-ID upgrade retains PDAs and does not require changing creator-fee routing.
6. After separately approved upgrade and finalized hash confirmation, prepare verification-PDA registration and remote submission for that fixed commit/image. Request transaction approval separately. Keep upgrade authority until final review and separately authorised revocation.

Risks include a compiler-specific runtime regression, compute increase, bad buffer/program selection, unauthorised source/build drift and an interrupted upgrade. Preserve the current verified executable and retained authority for rollback while testing; do not assume a successful upgrade is reversible after authority revocation. No reason has been established to change monetary logic solely for verification.
