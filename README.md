# DUSD Burn Protocol

> **Undeployed review candidate (16 October 2026).** This branch adds canonical-pool-only Jupiter execution and post-CPI custody checks. It is not the current mainnet binary and must not be used as evidence of a deployed upgrade. See [candidate specification and readiness](docs/CANDIDATE-20261016.md). The historical live-release manifest remains in `verification/release.json`; the new candidate has a separate manifest in `verification/candidate/release.json`. No upgrade or authority revocation has been performed.

A permissionless, on-chain monetary mechanism that converts DUSD creator revenue into purchases and permanent token burns.

| Mainnet identity | Address |
| --- | --- |
| [Burn program](https://explorer.solana.com/address/6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm) | `6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm` |
| [Treasury PDA](https://explorer.solana.com/address/HDwArc1qjz8AQt6J2fDcqoBc3MCxWh5whGYusnBxr3di) | `HDwArc1qjz8AQt6J2fDcqoBc3MCxWh5whGYusnBxr3di` |

**[Read the Rust contract](programs/dusd_burn/src/lib.rs)** · **[Verify the deployed code](VERIFY.md)** · [Instruction interface](idl/dusd_burn.json) · [Security model](docs/SECURITY.md)

## Choose your starting point

- **[Run a keeper](KEEPER.md):** give your agent one public guide to inspect the client, prepare a server and use only its own gas wallet.
- [Understand the protocol](https://dusd.fun/docs/burn-protocol): monetary policy and decentralized custody.
- [Browse verification evidence](verification/README.md): a short index of build records and current limitations.

The public keeper source lives in [`keeper/`](keeper/), separate from contract and verification material. No website archive or Rust compilation is needed to run it.

## How it works

1. Public Pump and PumpSwap instructions collect DUSD creator fees and distribute native SOL to the treasury. DUSD's V2 fee-sharing configuration allocates 100% to that PDA; its ordinary fee-sharing administrator is revoked.
2. Anyone calls `execute_buy_and_burn`. When the treasury has at least **0.01 SOL above required rent**, it spends the available native SOL through DUSD's fixed canonical PumpSwap pool.
3. PumpSwap's native `buy_exact_quote_in_v2` instruction calculates the purchase and trading fees. The protocol specifies a minimum output of one raw DUSD unit, without an independent pricing formula or oracle.
4. The program burns **the entire balance** of its designated DUSD account in the same atomic transaction—including purchased tokens, pre-existing balances and direct donations.

The treasury signs through program-derived seeds, not a private key. The external caller pays network fees and any required first-use account setup; purchase principal and purchased DUSD never pass into the caller's custody.

There are no keeper rewards, privileged execution roles, administrative withdrawals, mutable monetary settings or on-chain cooldowns in the contract.

## Execute the public mechanism

Any gas-funded Solana wallet can submit these instructions using the [published Anchor IDL](idl/dusd_burn.json) or [Codama interface](idl/dusd_burn.codama.json). No operational wallet, fee-sharing administrator or program upgrade key is required.

| Instruction | Effect |
| --- | --- |
| `execute_buy_and_burn` | Spend eligible treasury SOL through the fixed pool, then burn all designated DUSD. |
| `burn_dusd` | Burn all designated DUSD without a SOL threshold or a PumpSwap purchase. Zero balance is a successful no-op. |
| `unwrap_quote` | Recover at least 0.01 WSOL from the designated account into the same treasury. It cannot pay the caller. |

Before a purchase, anyone may invoke Pump `sweep_creator_fee`, canonical PumpSwap `sweep_creator_fee`, PumpSwap `transfer_creator_fees_to_pump_v2`, then Pump `distribute_creator_fees_v2` with the configured treasury recipient. These are upstream public instructions, not administrative methods of this contract. Scheduling is optional off-chain infrastructure; execution still requires someone to submit a transaction.

## Fixed accounts

| Account | Mainnet address |
| --- | --- |
| DUSD mint — legacy SPL Token, 6 decimals | `B8RHrVBxSjBGKqAbn1tXo6CWjvt5jFkkqjbCZtuDpump` |
| Canonical DUSD/SOL pool | `2z2uBDXaAFishs6XRz2atV2Ro7jL8hfdUcKxTTfhjHDw` |
| Designated DUSD account | `EycdnyeQjfoSvbTEhsA8oGNfDhAmMDg3KUSAGVgrLr89` |
| Designated WSOL account | `EEqYCx4wcGtXEK2wJCtEPPFx7MS1D1SsgDWAUd5HoYVM` |
| Pump fee-sharing configuration | `HSwzSiZGoLN8g2jKsxjGHMpkRbuUxVc2Mybjd1VRbqZ5` |

Do not send unrelated tokens to protocol accounts: there is no general-purpose withdrawal function.

## Source and verification

The Rust source, manifests and lockfile are preserved byte-for-byte from the mainnet release. A [fresh GitHub-hosted Windows build](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/38791076864) compiled the public source and matched the deployed mainnet executable exactly. [VERIFY.md](VERIFY.md) explains how to reproduce that comparison and distinguishes it from the separate official verification process. [BUILD.md](BUILD.md) pins compiler inputs; [release fingerprints](verification/release.json) identify the intended artifact.

The [canonical on-chain IDL](https://explorer.solana.com/address/AwcUwoCEP2fWBwtLZwfsU9FAQE15ZVA3zM3JG9G4bhUy) still describes the live three-instruction interface. This branch's four-instruction candidate IDL has not been published onchain. IDL publication is distinct from executable verification.

## Authority and execution boundaries

**The burn program's upgrade authority remains active; the program is not yet immutable.** This authority can replace its code. It is separate from the revoked ordinary Pump fee-sharing administrator.

Pump/PumpSwap availability, upgrades and platform-level fee-routing powers remain external dependencies. The one-unit minimum deliberately does not promise a fair execution price or protection from MEV. An upstream failure or transaction-limit violation rolls back the transaction; the caller still pays its network fee. Indexers must count only successful, finalized burns, not events emitted by a transaction that later fails. Detailed assumptions and recovery limits are in [SECURITY.md](docs/SECURITY.md).
