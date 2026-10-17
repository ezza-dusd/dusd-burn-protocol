# Security boundaries and accepted dependencies

This is source publication, not an independent audit certificate. Read every account constraint and the code before interacting.

The reviewed direct PumpSwap/Jupiter release is deployed and its upgrade authority is permanently revoked. [Finalization evidence](../verification/immutable-20261017/README.md) identifies the exact unchanged executable and transaction. The [candidate review record](CANDIDATE-20261016.md) remains historical engineering evidence, not an independent audit certificate.

## Enforced by the current program

- Fixed DUSD mint, canonical pool/vaults and external program identities; legacy SPL Token only.
- Treasury PDA seeds checked on every instruction; no arbitrary recipient. Direct instructions reject remaining accounts; the Jupiter alternative validates a restricted route account list.
- Token mint, account authority, delegate/close-authority safety and canonical designated ATAs checked as specified in each instruction.
- Caller-funded account initialization and native rent preservation; no caller reimbursement.
- Treasury signs canonical WSOL preparation, exact-input CPI and designated DUSD burns through PDA seeds only.
- Post-CPI balance and supply-reduction invariants; full-balance burn or atomic rollback.
- Standalone full-balance burning without a native-SOL eligibility gate.
- WSOL recovery sends only to treasury and requires at least 0.01 WSOL; it is not a general withdrawal.
- No economic setter, keeper reward, execution allowlist or withdrawal instruction.

## Not guaranteed

No Solana upgrade authority remains for the DUSD burn program; its code cannot be replaced or rolled back. Pump's programs and platform controls are separate external authorities. Pool availability, compatible instruction ABI/account requirements, fees, Solana transaction limits, RPC access and willing callers remain upstream/operational dependencies.

Minimum purchase output is one raw unit, intentionally without an external fair-price or slippage guarantee. Manipulation or unfavorable liquidity can produce poor execution. An amount too small to produce a valid purchase, exhausted liquidity, upstream rejection or transaction-limit failure may prevent a particular execution. They do not authorize bypassing validation or redirecting assets. Failed transactions may emit apparent burn logs before rollback: **index only successful finalized receipts** and verify actual SPL burns.

Direct DUSD donations to the designated account are irreversibly burned by either burn instruction. Unrelated assets, unsolicited WSOL dust, or tokens sent to the wrong account can be inaccessible because no general withdrawal exists. An unavailable upstream program has no local administrator escape hatch. Program verification does not guarantee the future behavior of upgradeable upstream dependencies.

No signing keys, fee-collection deployment configuration, private operational material, test wallet identities or RPC credentials belong in this repository.
