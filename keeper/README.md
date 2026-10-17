# DUSD public keeper

> Targets the upgraded mainnet release of 17 October 2026. Its executable pin matches the deployed program. Preserve your gas wallet and pending journal during updates. See [live evidence](../verification/live-20261017/README.md).

**[Start here: complete agent and server runbook](../KEEPER.md)**

Public JavaScript source for an independent gas paying caller. Execution is trustless with respect to the keeper: it can trigger the fixed rules, but cannot take treasury custody or choose a payout. This client targets the finalized upgraded program. No contract build or private infrastructure is required.

```sh
npm ci --omit=dev --ignore-scripts
npm test
node cli.mjs --check
```

Node.js 22+ required. These commands send no transactions and open no wallet. `--execute` is a separate explicit mainnet action requiring the wallet owner's approval. There is no keeper reward.

Builders, decoding and public-state checks retain the tested baseline. The coordinator and CLI add unsigned simulation, durable signing order, dual-provider expiry recovery, explicit health status and crash-released kernel locks. [The manifest](UPSTREAM-COPY-MANIFEST.json) records baseline provenance and current hashes. Tests exercise guards, receipt handling, expiry disagreements, abrupt process death and mocked complete cycles without live spending.

The reviewed update adds strict Jupiter route framing and permits independent donation burning after safe unsigned phase failures. It never continues after uncertain signed wire. Successful fallback is healthy; unresolved eligible work is explicitly reported. Defaults remain a check about 60 seconds after the previous cycle finishes and the contract's 0.01 SOL threshold. Preserve the existing gas wallet and pending journal during any approved update; no privileged keys or fee migration are needed.

[Agent instructions](AGENTS.md) · [Linux service](service/dusd-keeper.service) · [Timer](service/dusd-keeper.timer) · [Contract verification](../VERIFY.md)

Pinned dependencies have known transitive npm advisories. Installation disables lifecycle scripts; this does not mean dependencies are vulnerability-free. Keep the gas allowance limited and do not force upgrades without testing. No wallet or production credential is included.
