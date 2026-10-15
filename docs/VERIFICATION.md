# Verification and explorer metadata

## Distinct claims

1. The four release input hashes identify the intended mainnet source, not a devnet variant.
2. A read-only finalized-account check matches the retained release ELF to the deployed program.
3. A fresh source rebuild must independently match that executable. Docker results are recorded separately.
4. Official Verified Builds registration requires verification metadata and a successful remote build, not just a public repository or a local checksum.
5. Explorer IDL metadata is a separate publication, not a program upgrade.

Until the final two publications are confirmed, do not describe explorer visibility as complete. The public upgrade authority remains active; no revocation is part of this release.

## Official Verified Builds

Follow the [Solana verification guide](https://solana.com/docs/programs/verified-builds). Use the pinned build parameters in `BUILD.md`, the exact published Git commit, library `dusd_burn`, repository root mount path `.`, mainnet program ID, and matching architecture/features. Never use a prototype/development program ID.

```sh
solana-verify verify-from-repo \
  -u https://api.mainnet-beta.solana.com \
  --program-id 6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm \
  --commit-hash PUBLIC_COMMIT_SHA --library-name dusd_burn --mount-path . \
  --base-image solanafoundation/solana-verifiable-build@sha256:12fd4c0a0790f0fc41ef74b0cdb6bccc167ba6137eb1adb749bac649481c86bd \
  --arch v0 --cargo-build-sbf-args="--tools-version v1.57 --features no-idl --jobs 2" \
  https://github.com/ezza-dusd/dusd-burn-protocol
```

**Answer NO to any request to upload on-chain verification metadata until separately authorized.** Do not use `--skip-prompt`, default signing files or an upgrade-authority key during a read-only build comparison. After a matching build, use the supported unsigned `export-pda-tx` workflow to review account creation, uploader, repository/commit/build arguments and exact fees/rent before approval. Only following finalized metadata publication should the corresponding remote verification job be submitted. A failed Docker comparison is not justification to upgrade the running program.

## Separate Program Metadata IDL

The [official Program Metadata infrastructure](https://github.com/solana-program/program-metadata) supports canonical metadata PDAs created by the program's upgrade authority. It works without enabling legacy Anchor IDL handlers in the economic program. Keep `no-idl` unchanged.

Publish only the checked interface. Explorer support varies with IDL format; an Anchor IDL may require a Codama representation for some explorers. Inspect the installed tool version, compression/storage mode, existing metadata, authority, transaction count and simulated rent/fees before asking for approval. Do not claim a specific explorer will decode the IDL until observed.

The CLI supports unsigned export:

```sh
program-metadata write idl \
  6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm \
  ./idl/dusd_burn.json \
  --rpc https://api.mainnet-beta.solana.com \
  --export FzPw22y8fMnsFYBnXh2p6sfsFzTHYLtLMWybS9d2RS2q \
  --export-encoding instruction-list --priority-fees 0
```

This is an export/review command, **not authorization to broadcast**. Neither metadata authority removal/immutability nor program upgrade-authority revocation is part of this publication request. Verification/IDL registration and their exact costs must be approved separately before signing or spending mainnet SOL.
