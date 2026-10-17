# Verification and explorer metadata

Start with [VERIFY.md](../VERIFY.md) for the current official Linux build and direct finalized-mainnet comparison. [17 October live evidence](../verification/live-20261017/README.md) records the upgraded executable, four-instruction IDL update, finalized official registration and successful remote verification. Source-manifest checks alone are not source-to-bytecode verification. The 15 October publication details below are historical, not current executable status.

## Distinct claims

1. The four release input hashes identify the intended mainnet source, not a devnet variant.
2. A read-only finalized-account check matches the retained release ELF to the deployed program.
3. A fresh source rebuild must independently match that executable. Docker results are recorded separately.
4. Official Verified Builds registration requires verification metadata and a successful remote build, not just a public repository or a local checksum.
5. Explorer IDL metadata is a separate publication, not a program upgrade.

The updated IDL publication and official verification registration are finalized. Official remote verification passed on 17 October 2026 with matching onchain/build hashes; consult [live service evidence](../verification/live-20261017/REMOTE-VERIFIED.json). The program's upgrade authority was subsequently permanently revoked without changing its executable; see [finalized authority evidence](../verification/immutable-20261017/README.md). Do not infer explorer-specific decoding support from metadata publication alone. The earlier Windows/Linux mismatch in [historical build results](../verification/BUILD-RESULTS.md) concerns the superseded executable, not today's independently reproduced Linux build. Publication procedures below are historical reference, not instructions to repeat live writes.

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
npx --yes @solana-program/program-metadata@0.10.1 write idl \
  6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm \
  ./idl/dusd_burn.codama.json \
  --rpc https://api.mainnet-beta.solana.com \
  --export FzPw22y8fMnsFYBnXh2p6sfsFzTHYLtLMWybS9d2RS2q \
  --export-encoding instruction-list --priority-fees 0
```

This is an export/review command, **not authorization to broadcast**. Neither metadata authority removal/immutability nor program upgrade-authority revocation is part of this publication request. Verification/IDL registration and their exact costs must be approved separately before signing or spending mainnet SOL.

### Finalized IDL publication

On 15 October 2026, following explicit spending approval, four metadata-only transactions published the checked Codama IDL from commit `036282de4e7524349d1918bb18d271a1a440b2dc`: allocation/first write, second write, final write, and canonical initialization. The transactions are discoverable in the [metadata account's public history](https://explorer.solana.com/address/AwcUwoCEP2fWBwtLZwfsU9FAQE15ZVA3zM3JG9G4bhUy).

Independent finalized RPC verification at slot `457316498` confirmed all four succeeded. The Program Metadata account is `AwcUwoCEP2fWBwtLZwfsU9FAQE15ZVA3zM3JG9G4bhUy`: 2,030 bytes, canonical `idl`, mutable, direct JSON/UTF-8 with zlib compression. Decompression exactly matches the public Codama JSON (SHA-256 `ab5af062a0850c79ac08536a6c147385e5b88461f4f0c064c0ec479832ac4d6e`). Its optional stored metadata authority is `None`; the program upgrade authority remains present and unchanged. No metadata-authority removal instruction was submitted.

Actual cost: **0.010982640 SOL**, comprising 0.010962640 SOL deposited as metadata rent and 0.000020000 SOL in network fees. Program account bytes, ProgramData bytes (including executable and upgrade authority), and Pump sharing-configuration bytes were unchanged across publication. No burn-program call, program upgrade or creator-fee migration was submitted. Metadata availability is verified; a particular explorer's decoding UI is not guaranteed.
