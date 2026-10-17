# Verification evidence

Start with **[permanent upgrade-authority revocation](immutable-20261017/README.md)**, [the 17 October live tests](live-20261017/README.md) and [VERIFY.md](../VERIFY.md). The [independent build and regression records](candidate/README.md) establish the unchanged executable's provenance. The historical table below concerns the superseded 15 October Windows-built release.

You do not need build records to set up a keeper. Use the [keeper runbook](../KEEPER.md) for that.

Start with **[VERIFY.md](../VERIFY.md)** for the plain explanation and reproduction commands.

| File | Purpose |
| --- | --- |
| [windows-ci-result.json](windows-ci-result.json) | Result of the independent GitHub-hosted Windows build. |
| [release.json](release.json) | Fixed identities, source fingerprints and expected executable hashes. |
| [BUILD-RESULTS.md](BUILD-RESULTS.md) | Build comparisons and configurations tested. |
| [LINUX-ALTERNATIVE.md](LINUX-ALTERNATIVE.md) | Why standard Linux verification does not match the existing Windows-built executable. |

The historical Windows reproduction matched the former deployed executable, not today's Linux-built release. Official Solana Verified Builds passed for the current executable. These reproducibility records are not a security audit or independent certification. Compiler setup is in [BUILD.md](../BUILD.md); further context is in [docs/VERIFICATION.md](../docs/VERIFICATION.md).
