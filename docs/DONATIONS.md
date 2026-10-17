# SOL contributions and direct DUSD burns

The treasury has one public authority address but separate accounts for native SOL and DUSD. There is no treasury private key. Sending funds does not itself execute a purchase or a burn: someone must submit the relevant public instruction.

## Native SOL: fund a DUSD purchase and burn

Send **native SOL on Solana mainnet** to the treasury PDA:

```text
HDwArc1qjz8AQt6J2fDcqoBc3MCxWh5whGYusnBxr3di
```

Claimed creator fees arrive at this same address as native SOL. SOL donations join that balance; neither passes through a keeper's personal wallet. Once the treasury has at least **0.01 SOL above its required rent reserve**, anyone can trigger a purchase using all spendable native SOL, followed by burning all designated DUSD. Smaller contributions accumulate toward the threshold. A keeper pays its own transaction fees.

## DUSD: contribute tokens for a direct burn

The recipient authority is the same treasury PDA. Its designated **DUSD token account** is:

```text
EycdnyeQjfoSvbTEhsA8oGNfDhAmMDg3KUSAGVgrLr89
```

Only the genuine DUSD mint is supported:

```text
B8RHrVBxSjBGKqAbn1tXo6CWjvt5jFkkqjbCZtuDpump
```

In a wallet that supports PDA recipients, entering the treasury address as the DUSD recipient can resolve to this designated associated token account. Check the transaction's actual destination. Some wallets reject PDA recipients or do not support direct token-account recipients. Do not bypass a wallet warning or assume entering the token-account address in an owner-address field will work correctly. Use a compatible wallet or reviewed SPL Token tooling that explicitly targets the designated account.

A raw SPL Token transfer directly to the treasury's **native SOL account** is invalid: that account is not a DUSD token account. This is different from entering the treasury as a wallet recipient and letting the wallet derive its token account. A rejected submitted transaction can still charge a network fee, but its token transfer does not take effect.

Anyone can call **`burn_dusd()`** to destroy the designated account's entire DUSD balance. It needs no spendable treasury SOL, has no 0.01 SOL purchase threshold and invokes no swap. The caller pays the network fee. An empty balance is a successful no-op. The next normal purchase/burn also destroys any DUSD already in that account.

## What counts as a burn?

Arrival in the token account is **not yet a burn**. Only a successful SPL Token burn destroys the tokens and reduces the mint's total supply. A burn sends nothing to a dead wallet or another recipient. Require a successful finalized receipt; simulated or rolled-back burn logs are not evidence of a completed burn.

Do not send unrelated tokens, native SOL to the DUSD token account, or funds to the executable burn-program address. DUSD in another token account is not covered by `burn_dusd()`, even if the account has the same PDA authority. Unsupported deposits may be inaccessible under the current program. **Locked tokens are not the same as burned supply.** Contributions are not refundable through an administrator withdrawal function.

## Check the addresses without a wallet

Using the repository's pinned Node dependencies, this derives the expected DUSD account without signing or submitting anything:

```js
import { web3, token } from './keeper/deps.mjs';

const mint = new web3.PublicKey('B8RHrVBxSjBGKqAbn1tXo6CWjvt5jFkkqjbCZtuDpump');
const treasury = new web3.PublicKey('HDwArc1qjz8AQt6J2fDcqoBc3MCxWh5whGYusnBxr3di');
console.log(token.getAssociatedTokenAddressSync(mint, treasury, true).toBase58());
// EycdnyeQjfoSvbTEhsA8oGNfDhAmMDg3KUSAGVgrLr89
```

The `true` allows a PDA as the token-account authority. This is account derivation, not a transfer command. The deployed source fixes the DUSD mint and associated account; no caller can choose another burn source or payout.

See [Solana's token-account explanation](https://solana.com/docs/tokens/basics/create-token-account), [SPL Token burns](https://solana.com/docs/tokens/basics/burn-tokens), the [live source](../programs/dusd_burn/src/lib.rs) and [keeper guide](../KEEPER.md). This guide does not change the contract or authorise anyone to spend funds.
