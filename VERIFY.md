# Independently verify the live program

The current mainnet executable is the approved 17 October 2026 Linux build. The program's upgrade authority remains retained. No instruction below signs a transaction, upgrades a program or changes creator fees.

## Independent reproduction

Public source commit `141268054fd78d1e908f39891cc385ae680ade15` was compiled on an unrelated GitHub Linux runner using the digest-pinned official container. [The build and full regression run passed](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/39013571235). The resulting executable matches the finalized deployed bytes.

- Executable size: 230,632 bytes.
- Full SHA-256: `ca4c648b5bfe978f4ff65b22730fda501ded8c2231839a9803b327ee4432ac42`.
- Solana Verify normalized hash: `4a830d2199af7fb1b1d66fe2d8f2cda23d9f068c59e2ec9e383ce2dde1c28f9c`.

This is public build reproduction, not a third-party security audit. Official registration is finalized and remote verification passed; the independently fetched [service evidence](verification/live-20261017/REMOTE-VERIFIED.json) records `is_verified: true` and matching hashes. [Live verification evidence](verification/live-20261017/README.md) links the receipts.

## Reproduce and compare

On Linux x86_64 with Node.js 22+, Git and Docker, inspect a pinned checkout of this repository, then run:

```sh
node scripts/verify-linux.mjs
```

The script checks the four compiler inputs, downloads checksum-pinned Solana Verify 0.5.2, compiles using the exact official container and build flags, and compares freshly built bytes directly with finalized mainnet ProgramData. It verifies the mainnet genesis, loader ownership, executable flag and ProgramData binding. RPC or build errors are failures, not successful verification. Results are retained in `verification/LINUX-MAINNET-RESULT.json`.

The [public Linux verification workflow](https://github.com/ezza-dusd/dusd-burn-protocol/actions/workflows/verify-linux.yml) runs the same read-only process on a fresh host. It requires no wallet or DUSD credentials. `SOLANA_RPC_URL` optionally selects another HTTPS mainnet endpoint; never publish provider credentials.

[BUILD.md](BUILD.md) gives the manual build commands. To compare the current live release against its expected fingerprint without compiling, run `node scripts/check-mainnet.mjs`. That lighter check is not source reproduction.

## Historical Windows evidence

The former 196,664-byte release had matching public Windows builds but did not match standard Linux builds. Its evidence remains in [historical build results](verification/BUILD-RESULTS.md), Git history and the [original Windows workflow](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/38791076864). Do not use the historical Windows verifier to claim a match for today's Linux-built release. Separate Windows builds of the current source have their own fingerprint, not byte equality with mainnet.

## Authority boundary

Verification metadata and the public IDL are separate accounts; neither removes the burn program's upgrade authority. Permanent upgrade-authority revocation requires a separate explicit approval and finalized read-back. No command in this guide authorizes it.
