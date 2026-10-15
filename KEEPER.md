# Run an independent DUSD keeper

For a person or an autonomous agent with access to a computer or server. The inspectable JavaScript client lives in [`keeper/`](keeper/). No contract compilation, private DUSD infrastructure, registration or privileged key is required.

Your wallet pays gas. The treasury keeps custody of creator revenue and purchased tokens. There are no keeper rewards or reimbursements.

## Give this task to your agent

> Set up an independent DUSD keeper using this guide and keeper/AGENTS.md. Inspect the public source and tests first. Use a dedicated unprivileged user, persistent state and a new gas-only wallet outside the checkout. Use my existing server if suitable; ask before buying hosting. Complete the read-only checks and report the public gas address, tests and planned costs. Stop before funding or sending mainnet transactions until I approve the gas allowance and recurring operation. After approval, test one cycle, install the provided timer, verify its next run and give me a short handover. Never request DUSD operational keys or change the protocol.

## 1. Check the machine and source

Linux with systemd is the documented server path. Node.js 22+, npm, Git, outbound HTTPS and persistent disk are sufficient. No inbound port, domain, web server, Solana CLI, Rust compiler or paid RPC subscription is required. A small existing VPS is normally sufficient; uptime and free RPC availability are not guaranteed. Install Node using its [official instructions](https://nodejs.org/en/download) for the host, not an unknown privileged installer.

Use the full commit linked by the [DUSD keeper page](https://dusd.fun/docs/run-a-keeper), not an unreviewed moving branch. Replace `PINNED_COMMIT` below with that value.

```sh
git clone https://github.com/ezza-dusd/dusd-burn-protocol.git
cd dusd-burn-protocol
git checkout --detach PINNED_COMMIT
git rev-parse HEAD
cd keeper
npm ci --omit=dev --ignore-scripts
npm test
node cli.mjs --check
```

Inspect `cli.mjs`, `runner.mjs`, `builders.mjs`, `state.mjs`, `codec.mjs`, the lockfile and tests. The [copy manifest](keeper/UPSTREAM-COPY-MANIFEST.json) records the original tested module hashes. No wallets or state are shipped. Dependency lifecycle scripts are disabled, but pinned dependencies have known transitive npm advisories. Review `npm audit --omit=dev` independently; do not force major upgrades without regression testing.

The check reads public mainnet state without opening a wallet. Expect `keyAccessed: false`, matching executable bytes, fixed mint and canonical pool, and revoked ordinary fee-sharing administration with 100% allocated to the treasury. A failed check is a stop condition. See [addresses](README.md#fixed-accounts) and [verification](VERIFY.md). Official Verified Builds remains pending; executable pinning is separate from that service.

Default RPC: `https://api.mainnet-beta.solana.com`. `SOLANA_RPC_URL` selects another HTTPS mainnet endpoint. Free endpoints can throttle or fail. Provider credentials belong in a private environment file, never Git or shared logs.

## 2. Prepare an isolated Linux service

These steps require permission to administer this host. Check that the proposed user and paths are unused. If any exist, inspect them and reuse safely or choose different names and update the unit. Never overwrite another installation.

```sh
getent passwd dusd-keeper
test ! -e /opt/dusd-keeper
test ! -e /var/lib/dusd-keeper
```

For a new installation, create a system user without a login shell. Run the following from the checkout's `keeper/` directory after the clean installation above, before creating any wallet or journal there:

```sh
sudo useradd --system --user-group --home-dir /var/lib/dusd-keeper \
  --shell /usr/sbin/nologin dusd-keeper
sudo install -d -o dusd-keeper -g dusd-keeper -m 700 /var/lib/dusd-keeper
sudo cp -a ./.. /opt/dusd-keeper
sudo chown -R root:root /opt/dusd-keeper
sudo chmod -R a+rX,go-w /opt/dusd-keeper
sudo -u dusd-keeper /usr/bin/node /opt/dusd-keeper/keeper/cli.mjs --check
sudo -u dusd-keeper /usr/bin/node /opt/dusd-keeper/keeper/cli.mjs \
  --new-wallet /var/lib/dusd-keeper/gas.json
```

Verify `command -v node` resolves to `/usr/bin/node` before those commands; otherwise use its actual absolute path in the commands and service. Node must be installed system-wide, outside a personal home directory: the hardened service cannot access home directories. Inspect `/opt/dusd-keeper/keeper/cli.mjs` before continuing. Code is root-owned; the service user can write only its own data directory.

Wallet creation is local and unfunded. It prints only the public address, writes mode 600 and refuses overwrite. Protect and back up the gas key according to your own policy. Never use creator, upgrade, production or savings keys. Keep the data directory away from public hosting and shared sync folders.

**Approval checkpoint:** report the public gas address, exact commit, successful tests/checks and schedule. Ask the owner to approve a limited gas allowance and recurring mainnet operation. Do not fund accounts, buy hosting or submit transactions without that authority. A starting allowance of 0.005 SOL may suit already initialized protocol accounts; it is not a guaranteed setup budget. Rent and network costs can change. Never fund the treasury to manufacture keeper activity.

## 3. After approval, run one cycle

The owner funds the new gas address, not a DUSD operator. Run:

```sh
sudo -u dusd-keeper env \
  KEEPER_KEYPAIR=/var/lib/dusd-keeper/gas.json \
  DUSD_KEEPER_STATE=/var/lib/dusd-keeper/state \
  /usr/bin/node /opt/dusd-keeper/keeper/cli.mjs --execute
```

This submits real mainnet transactions only when eligible work exists. `no-eligible-work` is healthy and sends nothing. Do not force a purchase to demonstrate activity. Each invocation submits at most three transactions, re-reading finalized state between operations. Unrelated keepers can act without coordination.

The client can unwrap qualifying WSOL, collect and distribute fees, execute the purchase/full burn, or burn DUSD donations without treasury SOL. To avoid dust claims, it collects when pending fees plus native spendable treasury SOL reach 0.01 SOL. Purchase eligibility excludes required treasury rent. These scheduling choices are offchain; the contract has no cooldown.

Only successful finalized receipts count. Failed simulations send nothing; failed onchain transactions roll back account changes but still cost gas. The client refuses submissions below 0.0005 SOL of caller gas, which is not a guaranteed rent allowance or a spending limit. The funded gas balance is the practical expenditure ceiling. No automatic top-ups occur.

## 4. Enable a conservative timer

After approval and a successful manual cycle or healthy no-work result, inspect and install the [service](keeper/service/dusd-keeper.service) and [timer](keeper/service/dusd-keeper.timer). First check for existing units; do not overwrite another setup.

```sh
sudo install -m 644 /opt/dusd-keeper/keeper/service/dusd-keeper.service /etc/systemd/system/
sudo install -m 644 /opt/dusd-keeper/keeper/service/dusd-keeper.timer /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/dusd-keeper.service /etc/systemd/system/dusd-keeper.timer
sudo systemctl daemon-reload
sudo systemctl enable --now dusd-keeper.timer
systemctl list-timers dusd-keeper.timer
systemctl status dusd-keeper.timer dusd-keeper.service --no-pager
journalctl -u dusd-keeper.service -n 40 --no-pager
```

The timer runs about a minute after each cycle finishes, with no overlapping service runs or aggressive automatic retries, and returns after reboot. An inactive oneshot service between runs is normal: check the timer and latest exit result. Observe one scheduled run and verify its next scheduled time. No DUSD production service is changed.

Optional provider configuration goes in `/var/lib/dusd-keeper/rpc.env`, owned by the service user, mode 600, containing `SOLANA_RPC_URL=...`. The service reads it if present. Public default RPC needs no file. Do not include credential-bearing contents in reports.

Windows/macOS can use the same CLI with a persistent scheduler and no overlapping instances; supplied service units are Linux-specific. In PowerShell set `$env:KEEPER_KEYPAIR` and `$env:DUSD_KEEPER_STATE` before `node cli.mjs --execute`. Protect Windows keys with ACLs, not Unix chmod.

## 5. Monitor, stop and recover

```sh
sudo systemctl stop dusd-keeper.timer
# Allow any active cycle to finish before maintenance.
systemctl is-active dusd-keeper.service
```

Monitor gas balance, finalized signatures, RPC failures and `/var/lib/dusd-keeper/state/journal.json`. Use one persistent state directory per gas wallet. Never run the same key with separate journals or keep pending state on ephemeral disk.

| Result | Action |
| --- | --- |
| `no-eligible-work` | Healthy. Wait for the next run; another keeper may have acted first. |
| Low gas | Ask for an external top-up within the agreed budget. Never use treasury funds. |
| Simulation failure | No submission occurred. Inspect state and errors; do not tighten the retry loop. |
| `awaiting-signature-review` | Preserve the journal. Inspect the exact signature at finalized commitment. Later runs reconcile it; unknown expired signatures are not automatically replaced. |
| `EEXIST` / `run.lock` | Inspect its PID and service state. Only after confirming no keeper is running may you remove the stale lock. Never erase a pending journal. |
| Hash, pool, ownership or shares mismatch | Stop scheduling and investigate. Do not disable guards or accept an unexplained new hash. |

A network error after submission does not prove failure. Preserve the signed pending transaction and finalized ledger across reboots and updates. Rotate logs without discarding unresolved state; do not publish journals containing pending signed transactions. Forced shutdown can leave a stale lock that intentionally requires review.

For updates, stop scheduling, wait for the active cycle, preserve data, inspect a new pinned commit and repeat tests/checks. Do not run unattended `git pull` or automatically replace dependencies.

## Handover checklist

Report public or nonsensitive information only: commit, service name, public gas address/balance, test/check results, next timer run, latest finalized signature or `no-eligible-work`, and data directory location. Confirm pending state is preserved, core dumps disabled and no privileged DUSD key was requested. Never include private keys, wallet JSON or RPC credentials.

The ordinary Pump fee-sharing administrator is revoked. The program upgrade authority remains active; this client does not make the contract immutable. See [security](docs/SECURITY.md) and the [verification index](verification/README.md) separately from setup.
