# Permanent upgrade-authority revocation

**The DUSD burn program is immutable.** Its upgrade authority was permanently removed on Solana mainnet on 17 October 2026, following explicit user approval. This removed the program's upgrade and rollback capability; it did not destroy or replace the treasury PDA.

## Finalized transaction

- Program: `6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm`.
- ProgramData: `DXvZfLSRRY5k71fWHWtqWLxJqXsPaBRefQrSoKuGRvqN`.
- [Revocation transaction](https://solscan.io/tx/2PMWZosJTakrZNrGRCcPdNTo39ijxegtv6FaaRgRUu69dNN1xzvWahgjQcNWpi1moj79xq95iSarM6ysJDgtFSKw).
- Finalized slot: **457985595**.
- Current upgrade authority: **None**.
- Network fee: 5,000 lamports (0.000005 SOL); compute: 2,370 CU.

The transaction contained exactly one loader-v3 `SetAuthority` instruction, with the ProgramData account and former authority as its only instruction accounts. Omitting a replacement authority makes the removal permanent. No upgrade, account closure, fee migration, treasury transfer or keeper instruction was included. The caller paid only the network fee.

## Code and custody unchanged

The 230,632-byte executable is unchanged:

```text
Full SHA-256: ca4c648b5bfe978f4ff65b22730fda501ded8c2231839a9803b327ee4432ac42
Normalized:  4a830d2199af7fb1b1d66fe2d8f2cda23d9f068c59e2ec9e383ce2dde1c28f9c
```

Fresh finalized reads from public Solana RPC and PublicNode independently confirmed authority None, correct loader ownership, an executable program and the same code hash. The treasury remains `HDwArc1qjz8AQt6J2fDcqoBc3MCxWh5whGYusnBxr3di`; designated DUSD/WSOL accounts and the canonical pool are unchanged. Pump V2 fee sharing remains active, its ordinary administrator revoked, and that treasury is still the sole 10,000-bps creator-fee recipient.

No keeper runtime changed. Existing operators already pinned to the verified 17 October executable do not need a new executable pin because of revocation. The owner's deliberately disabled keeper was not reactivated.

## Functional evidence and limits

Before revocation, the user-identified independent keeper collected 0.011086475 SOL of genuine creator fees and spent it through the canonical pool, burning 5,898.573873 DUSD. Its two finalized signatures are in [results](RESULTS.json). Earlier mainnet tests also exercised the Jupiter alternative and direct donation burns.

After revocation, unsigned mainnet simulation of `burn_dusd` succeeded against the unchanged live program. A direct purchase simulation correctly rejected with `BelowThreshold` because the treasury held only its required native rent reserve. These were simulations, not submitted burns or a claimed post-revocation live purchase. No artificial treasury funding or additional purchase was performed for this check.

Official build verification continues to report matching hashes and `is_verified: true`. The captured service response still showed `is_frozen: false`; that cached service field is not the authoritative loader state. The two fresh finalized account reads established authority None. The original official source registration remains unchanged because the executable did not change. Verification is not a security audit or a guarantee of upstream compatibility.

## Remaining dependencies

Pump/PumpSwap's upstream trading, fee routing and platform powers remain separate from DUSD's now-removed upgrade authority. The Jupiter alternative still uses the canonical PumpSwap pool. The accepted one-raw-unit output floor, external gas-paying callers, network execution limits and operational dependencies have not changed. There is no local emergency administrator or upgrade rollback.

## Reproduce public checks

```sh
node scripts/check-source.mjs
node scripts/check-mainnet.mjs
node scripts/verify-linux.mjs
```

The first checks source fingerprints, the second reads finalized executable/authority state, and the third independently rebuilds in the pinned official Linux container and compares all live bytes. None loads a wallet or sends a transaction. [RESULTS.json](RESULTS.json) contains public, sanitized revocation, independent-read and simulation evidence. Historical retained-authority records remain dated evidence and were not rewritten as immutable snapshots.
