# DUSD Burn Protocol

> **Undeployed review candidate, corrected 17 October 2026.** Both direct PumpSwap and canonical pool Jupiter execution are offered here, with custody checks, strict route validation and independent donation scheduling in the keeper. This is not the current mainnet binary. See [review corrections](docs/REVIEW-FIXES-20261017.md), [matching builds and tests](verification/candidate/README.md) and [remaining release gates](docs/UPGRADE-AND-FINALIZATION-CHECKLIST.md). No upgrade or revocation has been performed.

A monetary protocol with trustless burn execution and decentralized creator fee custody. Creator fees become DUSD purchases and permanent burns, not private payouts. Anyone can trigger the rules without being trusted to hold the funds.

| Mainnet identity | Address |
| --- | --- |
| [Burn program](https://explorer.solana.com/address/6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm) | `6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm` |
| [Treasury PDA](https://explorer.solana.com/address/HDwArc1qjz8AQt6J2fDcqoBc3MCxWh5whGYusnBxr3di) | `HDwArc1qjz8AQt6J2fDcqoBc3MCxWh5whGYusnBxr3di` |

**[Review the candidate contract](programs/dusd_burn/src/lib.rs)** · **[Candidate verification evidence](verification/candidate/README.md)** · [Existing live verification](VERIFY.md) · [Instruction interface](idl/dusd_burn.json)

## Choose your starting point

- **[Run a keeper for today's live program](https://github.com/ezza-dusd/dusd-burn-protocol/blob/cc3dc662c5952ec2731b2c2eefb416892712a9d1/KEEPER.md):** a pinned public guide for an agent and its own gas wallet.
- [Review the next keeper](KEEPER.md): direct execution, safe Jupiter fallback and independent donation burns. Its new executable pin must not be installed before the matching upgrade.
- [Understand the protocol](https://dusd.fun/docs/burn-protocol): trustless execution and decentralized custody.
- [Browse current candidate evidence](verification/candidate/README.md), separate from [existing live evidence](verification/README.md).

The public keeper source lives in [`keeper/`](keeper/), separate from contract and verification material. No website archive or Rust compilation is needed to run it.

## How it works

1. Public Pump and PumpSwap instructions collect DUSD creator fees and distribute native SOL to the treasury. DUSD's V2 fee-sharing configuration allocates 100% to that PDA; its ordinary fee-sharing administrator is revoked.
2. Anyone calls `execute_buy_and_burn`, or the candidate's Jupiter alternative. At **0.01 SOL above required rent**, the program spends the available native SOL through DUSD's fixed canonical PumpSwap pool.
3. PumpSwap's native `buy_exact_quote_in_v2` instruction calculates the purchase and trading fees. The protocol specifies a minimum output of one raw DUSD unit, without an independent pricing formula or oracle.
4. The program burns **the entire balance** of its designated DUSD account in the same atomic transaction, including purchased tokens, earlier balances and direct donations.

The significance: the program enforces the movement from revenue to burn. A keeper cannot take the money, choose a payout or retain purchased DUSD. Treasury signatures use program-derived seeds, not a private key; callers pay gas and setup. Independent keepers can replace one another without team permission.

There are no keeper rewards, privileged execution roles, administrative withdrawals, mutable monetary settings or on-chain cooldowns in the contract.

## Execute the public mechanism

Any gas-funded Solana wallet can submit these instructions using the [published Anchor IDL](idl/dusd_burn.json) or [Codama interface](idl/dusd_burn.codama.json). No operational wallet, fee-sharing administrator or program upgrade key is required.

| Instruction | Effect |
| --- | --- |
| `execute_buy_and_burn` | Spend eligible treasury SOL through the fixed pool, then burn all designated DUSD. |
| `execute_jupiter_buy_and_burn` | Candidate only: the same policy through Jupiter's verified single canonical pool route encoding. |
| `burn_dusd` | Burn all designated DUSD without a SOL threshold or a PumpSwap purchase. Zero balance is a successful no-op. |
| `unwrap_quote` | Recover at least 0.01 WSOL from the designated account into the same treasury. It cannot pay the caller. |

Before a purchase, anyone may invoke Pump `sweep_creator_fee`, canonical PumpSwap `sweep_creator_fee`, PumpSwap `transfer_creator_fees_to_pump_v2`, then Pump `distribute_creator_fees_v2` with the configured treasury recipient. These are upstream public instructions, not administrative methods of this contract. Scheduling is optional off-chain infrastructure; execution still requires someone to submit a transaction.

## Fixed accounts

| Account | Mainnet address |
| --- | --- |
| DUSD mint, legacy SPL Token, 6 decimals | `B8RHrVBxSjBGKqAbn1tXo6CWjvt5jFkkqjbCZtuDpump` |
| Canonical DUSD/SOL pool | `2z2uBDXaAFishs6XRz2atV2Ro7jL8hfdUcKxTTfhjHDw` |
| Designated DUSD account | `EycdnyeQjfoSvbTEhsA8oGNfDhAmMDg3KUSAGVgrLr89` |
| Designated WSOL account | `EEqYCx4wcGtXEK2wJCtEPPFx7MS1D1SsgDWAUd5HoYVM` |
| Pump fee-sharing configuration | `HSwzSiZGoLN8g2jKsxjGHMpkRbuUxVc2Mybjd1VRbqZ5` |

Do not send unrelated tokens to protocol accounts: there is no general-purpose withdrawal function.

## Source and verification

The candidate source is different from the deployed release. Its selected Linux executable and separate Windows fingerprint were independently reproduced on GitHub; 255 contract tests, 104 keeper tests and 11 verification helpers passed. The [current evidence index](verification/candidate/README.md) identifies exact source, binaries and successful runs. It includes 25,000 arithmetic cases and eight complete creator fee cycles. Build reproduction is not an independent security audit or completed official verification.

The existing mainnet executable still has its separate [matching Windows build](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/38791076864) and [live fingerprints](verification/release.json). Those records do not certify this changed candidate. After an approved upgrade, compare the actual deployed bytes with the selected Linux build and complete official registration and remote verification. [VERIFY.md](VERIFY.md) describes the historical live release; the [candidate release checklist](docs/UPGRADE-AND-FINALIZATION-CHECKLIST.md) covers the next one.

The [canonical on-chain IDL](https://explorer.solana.com/address/AwcUwoCEP2fWBwtLZwfsU9FAQE15ZVA3zM3JG9G4bhUy) still describes the live three-instruction interface. This branch's four-instruction candidate IDL has not been published onchain. IDL publication is distinct from executable verification.

## Authority and execution boundaries

**The burn program's upgrade authority remains active; the program is not yet immutable.** This authority can replace its code. It is separate from the revoked ordinary Pump fee-sharing administrator.

Trustless execution under today's deployed rules is distinct from permanently fixed rules. The next step is an explicitly approved upgrade and live direct/Jupiter/donation/rollback tests with authority retained, then matching public source, interface, verification and independent keeper operation. Revocation is a separate final decision, not part of documentation or build checks.

Pump/PumpSwap availability, upgrades and platform-level fee-routing powers remain external dependencies. The one-unit minimum deliberately does not promise a fair execution price or protection from MEV. An upstream failure or transaction-limit violation rolls back the transaction; the caller still pays its network fee. Indexers must count only successful, finalized burns, not events emitted by a transaction that later fails. Detailed assumptions and recovery limits are in [SECURITY.md](docs/SECURITY.md).
