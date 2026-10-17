# Source annotation, unchanged mainnet executable

On 17 October 2026, the requested comment `// Eirik was here` was added beside the 0.01 SOL threshold constant in `programs/dusd_burn/src/lib.rs`, line 15. No executable statement or existing source line number changed.

A fresh build using the same digest-pinned official Linux container completed successfully. A direct finalized-mainnet comparison at slot 457976635 proved exact equality of all 230,632 executable bytes, not just the normalized hash. See [machine-readable results](RESULTS.json).

- Annotated Rust SHA-256: `0c542aa0fb15e4996067667cc766ed9653ab8ce70971912da16a0250c11dd5f3`.
- Unchanged executable SHA-256: `ca4c648b5bfe978f4ff65b22730fda501ded8c2231839a9803b327ee4432ac42`.
- Unchanged normalized hash: `4a830d2199af7fb1b1d66fe2d8f2cda23d9f068c59e2ec9e383ce2dde1c28f9c`.

The source-hash manifests now identify the annotated source. Historical build and test reports retain their original source hashes and commits; they were not rewritten as new test runs. The 104 keeper tests and 11 verification-helper tests were rerun successfully; keeper runtime files are unchanged. The full contract regression suite was not rerun locally for this comment-only edit because its newly compiled executable is byte-identical to the tested mainnet artifact.

Official verification remains registered against source commit `141268054fd78d1e908f39891cc385ae680ade15`, the original source of these exact bytes. This note does not claim that the official service was re-registered against the annotated commit. No program deployment, verification-registration transaction, fee-sharing change or upgrade-authority revocation was performed for this annotation. This build comparison loaded no wallet and sent no transaction.

Reproduce from the repository using [the pinned Linux build and live-comparison instructions](../../VERIFY.md). Build verification is not an independent security audit.
