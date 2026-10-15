# DUSD public keeper

**[Start here: complete agent and server runbook](../KEEPER.md)**

Public JavaScript source for an independent keeper of the existing mainnet program. No contract build or private infrastructure required. Only the operator's dedicated gas wallet signs; treasury custody stays with the program.

```sh
npm ci --omit=dev --ignore-scripts
npm test
node cli.mjs --check
```

Node.js 22+ required. These commands send no transactions and open no wallet. `--execute` is a separate explicit mainnet action requiring the wallet owner's approval. There is no keeper reward.

Builders, decoding, public-state checks and the durable coordinator were copied unchanged from the tested keeper. [The manifest](UPSTREAM-COPY-MANIFEST.json) records their original hashes. The portable CLI supplies gas-wallet loading and an exclusive lock. [Tests](tests/portable.test.mjs) exercise guards, receipt handling, ambiguous submissions and mocked complete cycles without live spending.

[Agent instructions](AGENTS.md) · [Linux service](service/dusd-keeper.service) · [Timer](service/dusd-keeper.timer) · [Contract verification](../VERIFY.md)

Pinned dependencies have known transitive npm advisories. Installation disables lifecycle scripts; this does not mean dependencies are vulnerability-free. Keep the gas allowance limited and do not force upgrades without testing. No wallet or production credential is included.
