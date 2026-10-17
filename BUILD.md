# Reproduce the current executable

The 17 October 2026 live release uses the independently reproduced official Linux build. [Live evidence](verification/live-20261017/README.md) identifies the upgrade and tests. The former Windows build remains historical evidence, not today's target.

The current source also includes a comment-only annotation that reproduced the same Linux executable. The manifests fingerprint that annotated source; the source commit below remains the original officially registered source. See [annotation evidence](verification/source-annotation-20261017/README.md).

## Fixed compiler inputs

The four files fingerprinted in `verification/release.json` are exact build inputs. Do not regenerate Cargo.lock, change dependencies, edit the release profile or program ID, add workspace metadata or remove `no-idl`.

- Source commit: `141268054fd78d1e908f39891cc385ae680ade15`.
- Anchor direct dependencies: 0.32.1; transitive versions are fixed by Cargo.lock.
- Agave cargo-build-sbf: 4.3.0; platform-tools v1.57.
- SBF Rust: 1.95.0-dev, commit ae660768afd467d131776918a1627e18920b230c.
- Architecture v0; release profile; fat LTO; overflow checks; one codegen unit.
- Library `dusd_burn`, repository-root mount `.`, feature `no-idl`.

## Official Linux container

Use Linux x86_64, Docker and checksum-verified [Solana Verify 0.5.2](https://github.com/solana-foundation/solana-verifiable-build/releases/tag/v0.5.2). Its CLI SHA-256 is `b9d5ccce9634dc14269cab3e7a58649bc141b3306e7735a94478c936341f211f`.

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

Solana Verify supplies Cargo's `--locked` itself. The 230,632-byte executable's full SHA-256 must be `ca4c648b5bfe978f4ff65b22730fda501ded8c2231839a9803b327ee4432ac42`. The normalized hash, with trailing zero bytes removed, must be `4a830d2199af7fb1b1d66fe2d8f2cda23d9f068c59e2ec9e383ce2dde1c28f9c`.

The automated read-only build-and-mainnet comparison is `node scripts/verify-linux.mjs`. Inspect its actual result; manifest agreement alone does not prove source reproduction. No build command authorizes deployment, verification-metadata submission or authority revocation.
