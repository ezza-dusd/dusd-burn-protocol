# Source rebuild results — 15 October 2026

**Public source is available. Official Solana Verified Builds registration is NOT complete. The program upgrade authority remains active.**

## Actual comparisons

| Artifact | Bytes | Full-file SHA-256 | `solana-verify` normalized hash |
| --- | ---: | --- | --- |
| Existing mainnet executable / retained release | 196,664 | `0d91e31a4c5bdbeec0a664be7ce3c2cc8a6e50ac6c0d09eb3bd7409cafd92774` | `a46632264d0fb2aa453db1b9573f0ec2f398a2112441ab34610252d82b9f4093` |
| Fresh Windows rebuild from public Git commit | 196,664 | `0d91e31a4c5bdbeec0a664be7ce3c2cc8a6e50ac6c0d09eb3bd7409cafd92774` | `a46632264d0fb2aa453db1b9573f0ec2f398a2112441ab34610252d82b9f4093` |
| Official Linux Docker source build | 196,664 | `1bc99d37bb6a21a5c6975ea74d9fe44e2edfb7ed9bc5011b9afc0c242d4270c4` | `e7f4b3cb9b936c2631b03ecb3b897b1f91baba3bfb9f0e33e91b38eb16d39e9c` |

The fresh Windows build used the four production inputs extracted directly from public commit `a3f0750d53eebfd9e213317aab992e8d15c9b395`, in a new directory with the pinned offline compiler/dependencies. Later documentation-only commits retain the same four source hashes. This is real fresh compilation, not copying an earlier ELF into a build output directory.

The Linux build used official `solana-verify` 0.5.2, the pinned Agave 4.3.0 Docker image and platform-tools v1.57, architecture v0, two jobs and `no-idl`. It compiled successfully. A local HTTP-only Cargo configuration disabled HTTP multiplexing after a crates.io fetch timeout; no economic source or dependency lock was changed. The verifier supplies `--locked` itself. The exact working command is in `BUILD.md`.

## Concrete cross-platform difference

Both executables have identical overall and section sizes, but **25,297 byte positions differ**, across `.text`, `.rodata`, `.data.rel.ro` and `.rel.dyn`.

There is a directly observable host-dependent difference in embedded diagnostic paths, including paths compiled into the Rust libraries:

- Windows: `programs\dusd_burn\src\lib.rs`, `library\core\src\fmt\mod.rs`.
- Linux: `programs/dusd_burn/src/lib.rs`, `library/core/src/fmt/mod.rs`.

The string-pool layout also differs. This is a concrete Windows-versus-Linux compiler-input/output difference, not just trailing ELF zero padding. **It has not been proved that every machine-code difference is caused solely by those path strings, or that the binaries are functionally equivalent.** Hash mismatches must not be dismissed as metadata-only.

No ELF byte patching, production program upgrade, changed Rust source, changed dependency lock, fee migration, verification-metadata transaction or upgrade-authority revocation was performed to make verification pass. A separately approved IDL publication was subsequently finalized; see [its transaction evidence](../docs/VERIFICATION.md#finalized-idl-publication). It does not resolve the executable mismatch.

## Remaining work

Investigate a fully reproducible, reviewable build environment capable of producing the existing Windows-built executable under the accepted verification workflow, including Windows target-library path conventions and compiler-host effects. A custom environment is not automatically supported by the remote verifier. Preserve the existing program; any proposal to change it requires a separate review and authorization.

The official status API reported `is_verified=false` during this release. Do not upload a claim that the Linux build matches, submit a misleading remote verification job, or describe explorer verification as achieved. The separately approved checked IDL is now published through Program Metadata; this does not change executable code or constitute Verified Builds registration.
