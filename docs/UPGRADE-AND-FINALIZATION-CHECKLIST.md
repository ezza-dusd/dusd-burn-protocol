# Release checklist, not execution authority

Nothing in this file authorizes signing, funding, upgrading, fee migration or revocation. The current live program remains unchanged. Existing fee-sharing administration is already revoked with 100% allocated to the same treasury. No new fee-sharing migration is needed.

## Candidate identity

Use the exact reviewed commit of this PR, never a moving branch or an ELF chosen by filename alone. Verify all `verification/candidate/release.json` source hashes and the full ELF SHA256 `ca4c648b5bfe978f4ff65b22730fda501ded8c2231839a9803b327ee4432ac42`. It is 230,632 bytes. The normalized Solana Verify hash is `4a830d2199af7fb1b1d66fe2d8f2cda23d9f068c59e2ec9e383ce2dde1c28f9c`.

The program, treasury, canonical pool and token accounts remain the addresses in the live manifest. The new artifact is a proposed same-program upgrade, not a different PDA or treasury migration. Keep the old reviewed source/binary available until all new tests pass; rollback is possible only while upgrade authority is retained and requires separate approved execution.

## Before an approved upgrade

1. Independent Linux reproduction and complete VM tests pass on the exact candidate source. Review any dependency/route-parser concerns. Do not equate build matching with a security audit.
2. Read finalized loader authority, current live ELF, treasury ownership, token authorities and fee shares. Stop on an unexpected difference. Preserve the ordinary fee-sharing revocation.
3. Read-only preflight currently finds 196,664 bytes allocated for the live ELF, less than the 230,632-byte candidate. At the observed rent rate, allow about **0.17255744 SOL** additional permanent ProgramData rent, **1.17244876 SOL** temporary upload-buffer rent and transaction fees. A roughly 1.35 SOL payer float plus a fee/test margin is a conservative staging estimate, not a request to send funds. Recalculate immediately before approval. Buffer recovery does not make extra ProgramData rent refundable after immutability.
4. Obtain approval naming the exact candidate hash, program ID, payer budget, extension/upgrade effects and controlled test transactions. Use an approved external payer, never creator-fee principal for deployment costs. Do not expose signing keys or change existing fee arrangements.
5. Resolve any pending keeper signatures and coordinate independent operators. Old pinned keepers will intentionally reject the new executable; plan the reviewed keeper update and persistent-journal handover. The owner's intentionally disabled keeper must remain disabled unless reactivation is separately approved.

## After an approved upgrade, before any revocation

- Verify finalized deployed bytes against the selected Linux ELF and confirm the same PDA/ATAs/pool/shares and retained upgrade authority.
- Execute approved direct and canonical Jupiter purchases with unrelated gas wallets. Reconcile native principal, WSOL residual, full DUSD burn, mint supply and caller rent/fee from raw receipts. Test a direct donation burn with no spendable native SOL.
- Demonstrate expected rollback without redirecting assets. Count only successful finalized transactions; failed event logs are not burns. Check the dashboard/Telegram indexer recognizes nested Jupiter transfers, not only a particular outer instruction name.
- Publish the approved live source, deployment/build evidence and matching Anchor/Codama IDLs. Refresh the public onchain interface metadata through its own approved transaction. Update keeper executable pin and documentation to the actual deployed artifact. Publish the website's candidate section only with correct deployed status.
- Confirm at least one independently operated keeper can collect/distribute fees and execute. Keep Markets-only burns segregated from the creator-fee PDA.

## Official verification preparation

The official CLI supports the pinned custom image and build flags. Only after approved deployment and independent matching, prepare this command with the **final published commit** and an approved signer. It can prompt to write verification data onchain, so it is deliberately **not executed** here:

```sh
solana-verify verify-from-repo https://github.com/ezza-dusd/dusd-burn-protocol \
  --program-id 6gEeY5c75itbSwtBVszzqnvvAi2vNScMf6fN5YETvAWm \
  --commit-hash FINAL_REVIEWED_COMMIT --library-name dusd_burn --arch v0 \
  --base-image solanafoundation/solana-verifiable-build@sha256:12fd4c0a0790f0fc41ef74b0cdb6bccc167ba6137eb1adb749bac649481c86bd \
  --cargo-build-sbf-args="--tools-version v1.57 --features no-idl --jobs 2" \
  --url APPROVED_MAINNET_RPC --keypair APPROVED_LOCAL_SIGNER_FILE
```

Review the unsigned registration effects and costs before approving submission. Then prepare official remote verification against the registered uploader. Do not use `--skip-build` to disguise a mismatch, and do not call the program officially verified until the service reports a successful match for the actual deployed bytes.

## Final, separate irreversible decision

Review finalized smoke tests, source/build/interface evidence, independent recurring execution and accepted Pump/JUP6 dependencies. Obtain explicit approval to revoke this specific program's upgrade authority. The relevant action is setting the loader's upgrade authority to none; there is no treasury private key or separate PDA administrator to burn.

After approved revocation, independently read authority `None`, compare bytes again, verify execution still works and publish final receipts/status. From that point there is no DUSD upgrade rollback. Neither a target date nor this checklist substitutes for those gates.

Primary references: [Solana deployment](https://solana.com/docs/core/programs/program-deployment), [official verification CLI](https://github.com/solana-foundation/solana-verifiable-build), [Jupiter build interface](https://developers.jup.ag/docs/swap/build).
