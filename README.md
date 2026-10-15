# DUSD monetary protocol

Source for the operating DUSD buy-and-burn program on Solana mainnet:

**`6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm`**

**The program upgrade authority is retained. This program is not yet immutable.** Publishing source or matching executable bytes does not replace independent security review. The fresh Windows source rebuild matches the mainnet executable; the successful official Linux Docker build does not. Official explorer verification is therefore **pending**, not achieved. See [actual build results](verification/BUILD-RESULTS.md) and [verification](docs/VERIFICATION.md).

## Monetary rules

- Anyone may call the program; the caller pays transaction fees and any required first-use account setup.
- The treasury PDA is `HDwArc1qjz8AQt6J2fDcqoBc3MCxWh5whGYusnBxr3di`, derived from the single seed `treasury` under this program. No private key controls this PDA directly.
- `execute_buy_and_burn` spends all native SOL above the System account's required rent floor, provided the spendable amount is at least **0.01 SOL**.
- Purchases use only the fixed canonical DUSD/SOL PumpSwap pool, native `buy_exact_quote_in_v2`, and minimum output **one raw DUSD unit**. PumpSwap calculates output and fees. There is no wrapper price oracle, quote formula, discretionary slippage setting or arbitrary purchase cap.
- The program burns the **entire** designated DUSD token-account balance atomically, including purchased tokens, existing tokens and direct donations.
- `burn_dusd` independently burns all DUSD in that same designated account, without requiring treasury SOL or invoking PumpSwap. A zero token balance is a successful no-op.
- `unwrap_quote` can close only the designated WSOL account back to the same treasury when it holds at least 0.01 WSOL. It cannot reimburse a caller. WSOL dust below this threshold cannot use this recovery instruction.
- There are no keeper rewards, privileged execution roles, administrative withdrawals, mutable monetary settings or on-chain cooldowns in this program.

## Creator fees and custody

DUSD's existing Pump V2 sharing configuration names the treasury as its sole 100% recipient, with ordinary fee-sharing administration revoked. Collection is performed through public upstream instructions, **not** an administrator function of this burn program:

1. Pump `sweep_creator_fee`.
2. Canonical PumpSwap `sweep_creator_fee`.
3. PumpSwap `transfer_creator_fees_to_pump_v2`.
4. Pump `distribute_creator_fees_v2`, supplying the configured treasury recipient.

Creator fees arrive as **native SOL**. An unrelated caller then invokes the burn program. The treasury signs its own native-SOL-to-WSOL transfer and PumpSwap CPI through PDA seeds; the caller never receives custody of the purchase principal or DUSD. Caller-funded execution is independent of treasury revenue. Automatic scheduling is optional infrastructure, not an on-chain authority or guarantee that a volunteer will execute.

The designated DUSD account is `EycdnyeQjfoSvbTEhsA8oGNfDhAmMDg3KUSAGVgrLr89`; the designated WSOL account is `EEqYCx4wcGtXEK2wJCtEPPFx7MS1D1SsgDWAUd5HoYVM`. Do not send unrelated tokens to these addresses: there is no general-purpose withdrawal mechanism.

## Fixed assets and dependencies

| Item | Mainnet address |
| --- | --- |
| DUSD mint, legacy SPL Token, 6 decimals | `B8RHrVBxSjBGKqAbn1tXo6CWjvt5jFkkqjbCZtuDpump` |
| Canonical DUSD/SOL PumpSwap pool | `2z2uBDXaAFishs6XRz2atV2Ro7jL8hfdUcKxTTfhjHDw` |
| PumpSwap program | `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` |
| Pump Fees program | `pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ` |
| DUSD fee-sharing configuration | `HSwzSiZGoLN8g2jKsxjGHMpkRbuUxVc2Mybjd1VRbqZ5` |

Pump/PumpSwap availability, supported fees/accounts, upgrade and platform powers remain external dependencies. Minimum output of one raw unit deliberately gives **no fair-price protection**: adverse liquidity, MEV or manipulation can reduce tokens bought for treasury SOL. A positive-price market does not guarantee nonzero purchasable output or available liquidity. Upstream rejection, insufficient output, arithmetic failure or transaction limits cause atomic rollback; callers still pay network fees for a failed transaction. The mechanism can be retried when conditions permit. See [security boundaries](docs/SECURITY.md).

## Source and interface

- `programs/dusd_burn/src/lib.rs` is preserved byte-for-byte from the mainnet release, including its historical development warning. That comment is not a statement about current deployment status.
- Both Cargo manifests and `Cargo.lock` are the exact release inputs. The lock matters: some Anchor transitive macro dependencies resolve to 0.32.2 even though Anchor's direct dependencies are pinned to 0.32.1.
- `idl/dusd_burn.json` describes the deployed three-instruction interface, errors and events. It is maintained separately and validated against source, instruction builders and finalized receipts. `idl/dusd_burn.codama.json` is the Codama representation, converted with `@codama/nodes-from-anchor` 1.5.6 for metadata consumers. The program's default **`no-idl` remains unchanged**; its legacy Anchor IDL-management handlers are disabled.
- `verification/release.json` records source, toolchain and executable fingerprints, plus the retained public upgrade authority. It contains no signing material.

## Reproduction and inspection

See [BUILD.md](BUILD.md) for pinned build inputs and [docs/VERIFICATION.md](docs/VERIFICATION.md) for the official verification workflow and publication status. With Node.js 22 or later:

```sh
node scripts/check-source.mjs
node scripts/check-mainnet.mjs
```

The first verifies committed release input hashes and interface discriminators. The second reads finalized public mainnet accounts and checks program bytes, upgrade authority, and public protocol identities. Neither command loads a private key or submits a transaction. Production configuration, wallets, keeper credentials, unrelated product code and historical Git history are intentionally excluded from this repository.
