# Reproduce the production executable

For a clean Windows setup from public downloads and a direct compiled-bytecode comparison with mainnet, follow [VERIFY.md](VERIFY.md). The command is `node scripts/verify-windows.mjs`; no private developer toolchain or dependency cache is required. Its observed result must be checked before claiming a match.

The four files fingerprinted in `verification/release.json` are the **exact production build inputs**. Do not regenerate `Cargo.lock`, update dependencies, change the release profile, change the program ID, add Cargo workspace metadata, or remove `no-idl` when attempting to reproduce them.

## Pinned inputs

- `cargo-build-sbf` **4.3.0**, platform-tools **v1.57**.
- SBF Rust `1.95.0-dev`, commit `ae660768afd467d131776918a1627e18920b230c`.
- Architecture **v0**; release profile; fat LTO; overflow checks; one codegen unit.
- Anchor direct dependencies **0.32.1**; transitive versions are fixed by the supplied lock.
- Library name **`dusd_burn`**; workspace root and verifier mount path **`.`**.
- `no-idl` is both a default feature and an explicit release flag.

The deployed image was originally compiled on Windows x64. Three fresh historical Windows build directories produced the same exported image. Host-specific compiler/linker support is not an on-chain dependency. A matching Linux Docker build must be demonstrated separately; never assume cross-platform equivalence.

## Official Linux Docker build

Use the official `solana-verify` **0.5.2** release with Docker on Linux x86_64. Obtain it and its SHA-256 checksum from the [official release](https://github.com/solana-foundation/solana-verifiable-build/releases/tag/v0.5.2). The official Agave 4.3.0 image is pinned in that release's image map:

```sh
solana-verify build \
  --base-image solanafoundation/solana-verifiable-build@sha256:12fd4c0a0790f0fc41ef74b0cdb6bccc167ba6137eb1adb749bac649481c86bd \
  --library-name dusd_burn --arch v0 \
  --cargo-build-sbf-args="--tools-version v1.57 --features no-idl --jobs 2"

sha256sum target/deploy/dusd_burn.so
solana-verify get-executable-hash target/deploy/dusd_burn.so
solana-verify -u https://api.mainnet-beta.solana.com get-program-hash \
  6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm
```

The verifier adds Cargo's `--locked` itself; do not pass it a second time. The explicit image avoids editing the exact Cargo manifest to select a newer image. The first hash is of **all 196,664 bytes** and must be:

`0d91e31a4c5bdbeec0a664be7ce3c2cc8a6e50ac6c0d09eb3bd7409cafd92774`

The verifier hashes with **trailing zero bytes removed**. Its normalized executable/program hash is:

`a46632264d0fb2aa453db1b9573f0ec2f398a2112441ab34610252d82b9f4093`

Compare like with like. A retained release binary matching the on-chain binary is not itself proof that a newly compiled source tree matches. Check the actual Docker output before claiming reproducibility or requesting registration.

## Direct SBF build

With the pinned SBF compiler installed, the underlying command is:

```sh
cargo build-sbf --manifest-path programs/dusd_burn/Cargo.toml \
  --sbf-out-dir target/deploy --arch v0 --jobs 2 \
  --tools-version v1.57 --features no-idl -- --locked
```

Windows builds additionally require a compatible host MSVC linker and import libraries for procedural macros. The public Windows verifier obtains pinned public tools, prepares isolated host-target configuration and generates system import libraries without copying operational files. Compare the **stripped exported** `target/deploy/dusd_burn.so`, not the intermediate unstripped ELF. Do not deploy or upgrade any program as part of build reproduction.
