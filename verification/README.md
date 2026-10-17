# Verification evidence

For this undeployed review branch, start with the **[candidate evidence index](candidate/README.md)**. The table below concerns the unchanged historical live release.

You do not need build records to set up a keeper. Use the [keeper runbook](../KEEPER.md) for that.

Start with **[VERIFY.md](../VERIFY.md)** for the plain explanation and reproduction commands.

| File | Purpose |
| --- | --- |
| [windows-ci-result.json](windows-ci-result.json) | Result of the independent GitHub-hosted Windows build. |
| [release.json](release.json) | Fixed identities, source fingerprints and expected executable hashes. |
| [BUILD-RESULTS.md](BUILD-RESULTS.md) | Build comparisons and configurations tested. |
| [LINUX-ALTERNATIVE.md](LINUX-ALTERNATIVE.md) | Why standard Linux verification does not match the existing Windows-built executable. |

The Windows reproduction matches the deployed executable. Official Solana Verified Builds remains pending. These are reproducibility records, not a security audit or independent certification. Compiler setup is in [BUILD.md](../BUILD.md); further context is in [docs/VERIFICATION.md](../docs/VERIFICATION.md).
