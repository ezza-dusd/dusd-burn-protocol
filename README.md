# DUSD Burn Protocol

> **Immutable mainnet program, 17 October 2026.** The burn program's upgrade authority is permanently revoked. Both direct PumpSwap and canonical-pool Jupiter execution remain available, with exactly the same verified executable. See [finalized revocation evidence](verification/immutable-20261017/README.md), [live tests](verification/live-20261017/README.md) and [matching builds](verification/candidate/README.md).

A monetary protocol with trustless burn execution and decentralized creator fee custody. Creator fees become DUSD purchases and permanent burns, not private payouts. Anyone can trigger the rules without being trusted to hold the funds.

| Mainnet identity | Address |
| --- | --- |
| [Burn program](https://explorer.solana.com/address/6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm) | `6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm` |
| [Treasury PDA](https://explorer.solana.com/address/HDwArc1qjz8AQt6J2fDcqoBc3MCxWh5whGYusnBxr3di) | `HDwArc1qjz8AQt6J2fDcqoBc3MCxWh5whGYusnBxr3di` |

**[Read the live contract](programs/dusd_burn/src/lib.rs)** · **[Live verification evidence](verification/live-20261017/README.md)** · [Reproduce the build](VERIFY.md) · [Instruction interface](idl/dusd_burn.json)

## Choose your starting point

- **[Run a keeper](KEEPER.md):** an inspectable public guide for an agent, its own server and gas wallet. Preserve existing wallets and pending journals when updating.
- [Understand the protocol](https://dusd.fun/docs/burn-protocol): trustless execution and decentralized custody.
- [Browse live mainnet evidence](verification/live-20261017/README.md) and [independent build/test records](verification/candidate/README.md).

The public keeper source lives in [`keeper/`](keeper/), separate from contract and verification material. No website archive or Rust compilation is needed to run it.

## How it works

1. Public Pump and PumpSwap instructions collect DUSD creator fees and distribute native SOL to the treasury. DUSD's V2 fee-sharing configuration allocates 100% to that PDA; its ordinary fee-sharing administrator is revoked.
2. Anyone calls `execute_buy_and_burn`, or `execute_jupiter_buy_and_burn`. At **0.01 SOL above required rent**, the program spends the available native SOL through DUSD's fixed canonical PumpSwap pool.
3. PumpSwap's native `buy_exact_quote_in_v2` instruction calculates the purchase and trading fees. The protocol specifies a minimum output of one raw DUSD unit, without an independent pricing formula or oracle.
4. The program burns **the entire balance** of its designated DUSD account in the same atomic transaction, including purchased tokens, earlier balances and direct donations.

The significance: the program enforces the movement from revenue to burn. A keeper cannot take the money, choose a payout or retain purchased DUSD. Treasury signatures use program-derived seeds, not a private key; callers pay gas and setup. Independent keepers can replace one another without team permission.

There are no keeper rewards, privileged execution roles, administrative withdrawals, mutable monetary settings or on-chain cooldowns in the contract.

## Execute the public mechanism

Any gas-funded Solana wallet can submit these instructions using the [published Anchor IDL](idl/dusd_burn.json) or [Codama interface](idl/dusd_burn.codama.json). No operational wallet, fee-sharing administrator or program upgrade key is required.

| Instruction | Effect |
| --- | --- |
| `execute_buy_and_burn` | Spend eligible treasury SOL through the fixed pool, then burn all designated DUSD. |
| `execute_jupiter_buy_and_burn` | The same policy through Jupiter's verified single canonical pool route encoding. |
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

This source matches the upgraded release. Its selected Linux executable and separate Windows fingerprint were independently reproduced on GitHub; 255 contract tests, 104 keeper tests and 11 verification helpers passed. The [build evidence index](verification/candidate/README.md) identifies exact source, binaries and successful runs. It includes 25,000 arithmetic cases and eight local creator fee cycles. The separate mainnet smoke tests are recorded in [live evidence](verification/live-20261017/README.md). Build reproduction is not an independent security audit or completed official verification.

The current 230,632-byte Linux executable was independently reproduced from public source commit `141268054fd78d1e908f39891cc385ae680ade15` in the [GitHub-hosted Linux build and regression run](https://github.com/ezza-dusd/dusd-burn-protocol/actions/runs/39013571235). Its full SHA-256 is `ca4c648b5bfe978f4ff65b22730fda501ded8c2231839a9803b327ee4432ac42`. Finalized mainnet bytes match. Official Verified Builds registration is finalized and the remote verification job passed with identical onchain/build hashes, as recorded in [live evidence](verification/live-20261017/README.md). Neither verification nor build matching is a security audit or authority revocation.

The [canonical on-chain IDL](https://explorer.solana.com/address/AwcUwoCEP2fWBwtLZwfsU9FAQE15ZVA3zM3JG9G4bhUy) publication status and payload fingerprint are recorded in [live interface evidence](verification/live-20261017/README.md). Both checked public IDLs describe the four-instruction release. Interface publication is distinct from executable verification.

## Authority and execution boundaries

**The burn program's upgrade authority is permanently revoked.** Its executable cannot be upgraded or rolled back. The ordinary Pump fee-sharing administrator was already revoked, with the treasury PDA as the sole 100% recipient.

The finalized loader transaction removed the upgrade authority without changing executable bytes, treasury addresses, fee allocation or keeper runtime. A separately operated keeper completed a genuine creator-fee collection and purchase/burn cycle before revocation. [Finalization evidence](verification/immutable-20261017/README.md) distinguishes that live cycle from the unsigned post-revocation execution checks.

Pump/PumpSwap availability, upgrades and platform-level fee-routing powers remain external dependencies. The one-unit minimum deliberately does not promise a fair execution price or protection from MEV. An upstream failure or transaction-limit violation rolls back the transaction; the caller still pays its network fee. Indexers must count only successful, finalized burns, not events emitted by a transaction that later fails. Detailed assumptions and recovery limits are in [SECURITY.md](docs/SECURITY.md).

## Optional contributions

Creator fees are the normal funding source. As an optional extra, native SOL sent to the treasury can fund an eligible purchase, and DUSD in its designated account can be burned separately. See the [contribution reference](docs/DONATIONS.md) for addresses and wallet handling. A transfer is not itself a burn.
