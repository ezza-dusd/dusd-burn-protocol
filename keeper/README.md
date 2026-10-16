# DUSD public keeper

**[Start here: complete agent and server runbook](../KEEPER.md)**

Public JavaScript source for an independent keeper of the existing mainnet program. No contract build or private infrastructure required. Only the operator's dedicated gas wallet signs; treasury custody stays with the program.

```sh
npm ci --omit=dev --ignore-scripts
npm test
node cli.mjs --check
```

Node.js 22+ required. These commands send no transactions and open no wallet. `--execute` is a separate explicit mainnet action requiring the wallet owner's approval. There is no keeper reward.

Builders, decoding and public-state checks retain the tested baseline. The coordinator and CLI add unsigned simulation, durable signing order, dual-provider expiry recovery, explicit health status and crash-released kernel locks. [The manifest](UPSTREAM-COPY-MANIFEST.json) records baseline provenance and current hashes. Tests exercise guards, receipt handling, expiry disagreements, abrupt process death and mocked complete cycles without live spending.

[Agent instructions](AGENTS.md) · [Linux service](service/dusd-keeper.service) · [Timer](service/dusd-keeper.timer) · [Contract verification](../VERIFY.md)

Pinned dependencies have known transitive npm advisories. Installation disables lifecycle scripts; this does not mean dependencies are vulnerability-free. Keep the gas allowance limited and do not force upgrades without testing. No wallet or production credential is included.
