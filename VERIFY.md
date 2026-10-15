# Independently verify the deployed program

## Status

**Independent-host Windows reproduction succeeded.** On 15 October 2026, a fresh GitHub-hosted `windows-2022` runner compiled the fixed public Rust source using checksum-pinned public tools, a fresh Cargo registry and a fresh target directory. The [successful public run](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/38791076864) matched independently fetched finalized mainnet ProgramData at slot `457348665`: all 196,664 bytes, full-file SHA-256 and normalized Solana executable hash. No original developer files, precompiled final ELF, private toolchain, cache, wallet or signing secrets were supplied. See the [recorded result](verification/windows-ci-result.json) and the run's `windows-verification-evidence` artifact for the raw result and compiler log.

The workflow/verifier ran from public commit `57728df05d023266e9668c95363ecce09031d179`; it independently checked out compiler inputs from `72f34f97b8540066f1c84aa91d776e49a86b7479`. GitHub's Windows Server build `10.0.20348` differs from the original development machine. Two additional fresh public-tool builds on the original PC matched at slots `457340208` and `457340889`.

Official Solana Verified Builds registration is **pending**. Independently hosted Windows source reproduction is now demonstrated; the official Linux/Docker remote pipeline has not reproduced this existing executable. These are distinct claims. No deployment or signing was part of verification.

## One verification command

On Windows x64, install Node.js 22+, Python 3.12+ and Git from their official distributors. Clone this public repository and inspect the scripts. Then run:

```powershell
node scripts/verify-windows.mjs
```

The verifier independently clones fixed public source commit `72f34f97b8540066f1c84aa91d776e49a86b7479`. It copies only the four exact compiler inputs into a new source directory, downloads checksum-pinned public Agave 4.3.0, Windows platform-tools v1.57 and Microsoft VC 14.44.35226 CRT packages, and compiles every required dependency into a new target directory. Cargo uses the release lockfile and a new registry cache. No saved final ELF or original developer cache is used.

The Windows host import libraries are generated from public system DLL exports by the pinned LLVM linker. Generated stub DLLs are never placed on the compiler's executable search path. Their hashes and the host OS are recorded. Microsoft's package metadata labels the pinned CRT payload 14.44.35226, but the downloaded payload contains the original 14.44.35207 library directory; the script checks that layout. SBF compiler, Cargo and linker executable hashes must equal the original release tools before compilation starts.

After compilation, the verifier independently fetches finalized mainnet Program and ProgramData accounts, checks mainnet genesis, loader ownership, the executable flag and the Program-to-ProgramData address binding, then compares:

- Full exported ELF size and SHA-256.
- Solana executable SHA-256, calculated after stripping trailing zero bytes, matching `solana-verify`'s normalization.

It reports **MATCH**, **MISMATCH**, or **ERROR**, saves `RESULT.json` and `build.log` in the printed fresh directory, and exits nonzero on a compilation, RPC, source or comparison failure. A mismatch retains both actual fingerprints. Comparison is directly between newly compiled and freshly fetched bytes; agreement with our own manifest is not accepted as a substitute.

Default RPC: `https://api.mainnet-beta.solana.com`. A developer may set `SOLANA_RPC_URL` to their own HTTPS mainnet endpoint; do not publish credentials. RPC outages are reported as errors, not mismatches or successful verification. `DUSD_VERIFY_WORK` optionally selects an existing scratch parent directory. Fresh source, dependency, target and tool directories are retained for inspection. No wallet is loaded and no transaction is submitted. The build tool can generate an unused deployment keypair; do not publish whole scratch directories.

## Independent GitHub Windows runner

For local setup debugging only, `DUSD_VERIFY_DOWNLOAD_CACHE` may name a directory holding the four previously downloaded public tool archives. Every archive is checked against the same pinned digest before reuse. Source, Cargo registry and target directories remain fresh. CI does not enable this option and downloads everything independently.

Run **Independent Windows source-to-mainnet verification** from the repository's [Actions tab](https://github.com/ezza-dusd/dusd-burn-protocol/actions/workflows/verify-windows.yml), or from a fork. It uses a fresh `windows-2022` runner, read-only repository permissions, no signing secrets and no build cache. Actions dependencies are commit-pinned. Only the explicitly allowlisted result JSON and build log are uploaded, never the complete target/deploy folder.

```sh
gh workflow run verify-windows.yml --repo ezza-dusd/dusd-burn-protocol
```

The GitHub command requires repository Actions permission but no Solana wallet. The local verifier does not require GitHub authentication. Read the actual run result and artifact before claiming an independent matching build.

## Reference mainnet artifact

| Item | Value |
| --- | --- |
| Program | `6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm` |
| ProgramData | `DXvZfLSRRY5k71fWHWtqWLxJqXsPaBRefQrSoKuGRvqN` |
| ELF size | 196,664 bytes |
| Full SHA-256 | `0d91e31a4c5bdbeec0a664be7ce3c2cc8a6e50ac6c0d09eb3bd7409cafd92774` |
| Solana executable hash | `a46632264d0fb2aa453db1b9573f0ec2f398a2112441ab34610252d82b9f4093` |

The live program upgrade authority is retained. The verifier records its actual public address at the finalized read; matching an executable is not a promise that future code cannot change.

## Official verifier and the Linux alternative

See [BUILD.md](BUILD.md) for the pinned official Linux/Docker command and [verification/BUILD-RESULTS.md](verification/BUILD-RESULTS.md) for prior build evidence. The standard official image produced a different executable. A fresh native-unpacked Linux build independently reproduced that same Linux result:

- Full SHA-256: `1bc99d37bb6a21a5c6975ea74d9fe44e2edfb7ed9bc5011b9afc0c242d4270c4`.
- Normalized hash: `e7f4b3cb9b936c2631b03ecb3b897b1f91baba3bfb9f0e33e91b38eb16d39e9c`.

Eight investigated Linux configurations did not match mainnet. Windows/Linux precompiled SBF standard libraries differ; aligning their diagnostic paths and constant-data sections still left code layout and relocation differences. This is not solely a README, metadata or uploader problem.

The matching native Windows Actions run establishes independently hosted public reproduction, but does **not by itself** complete official remote verification. The official service uses Linux/Docker. Its public API accepts a custom base image; no tested Windows-compatible image has yet reproduced this binary through that service. Official verification without an upgrade remains a possible research path, not a demonstrated result.

An in-place upgrade to the reproducible standard Linux result is a separate possible path. It would preserve the exact Rust source, Cargo inputs, instruction ABI, program ID, PDA seeds, treasury, fixed mint/pool and economic rules. It would nevertheless replace deployed executable bytes and change code layout. Functional equivalence and safety must be retested rather than inferred from unchanged source. See the [upgrade assessment](verification/LINUX-ALTERNATIVE.md).

Do not upload verification metadata, submit signing transactions, upgrade the program or revoke authority as part of these commands. The registration procedure and separate IDL publication evidence are in [docs/VERIFICATION.md](docs/VERIFICATION.md).
