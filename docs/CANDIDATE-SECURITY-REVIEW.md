# Candidate security and execution review

17 October 2026. Engineering review, not an independent audit certificate.

Reviewed Rust SHA256: `c6e65691559918cc29819c73206824006bc804256ca3a2d5c750fce6f6295ab9`.
Proposed Linux ELF: `473d1abe34c5cfc300accb9570bd6a2d41a4d2d6615f161e98f96fa099d16ab2`.

## Corrections implemented

| Finding | Scope and evidence | Candidate correction |
| --- | --- | --- |
| Forwarded PDA signer could be abused by a hostile upstream to change account authorities | Requires malicious/buggy upstream, not an ordinary caller exploit against the inspected Pump binary. Local mock modes 4, 5 and 6 demonstrate WSOL delegate, treasury owner and WSOL token-owner changes. | Both purchase paths verify treasury System ownership/empty data and designated token authority/delegate/close-authority after CPI. Any mismatch rolls the whole transaction back. |
| Positive output alone did not prove the full input was consumed | The older hardening ELF accepted a mocked purchase spending 9,999,999 of 10,000,000 input lamports and leaving one extra WSOL unit. See `verification/candidate/OLDER-PARTIAL-INPUT-PROOF.json`. This is not evidence that current Pump performs partial exact-input buys. | After wrapping and SyncNative, record the expected residual WSOL as the prepared balance minus input. Both paths require that exact residual after CPI. This preserves old WSOL and rent surplus without accepting an underspend. Mock mode 7 now rolls back. |

Neither correction changes the threshold, pool, output floor or full-balance burn policy. No current Pump custody compromise was discovered.

## Instruction and authority review

- [`execute_jupiter_buy_and_burn`](../programs/dusd_burn/src/lib.rs#L25): threshold and native rent are computed onchain. Input in the route must match the actual current spendable balance. Zero Jupiter platform/surplus fees, one full-input hop, WSOL source and DUSD destination are enforced. The quoted output is replaced with one raw unit and slippage with zero. No independent fee or price model is introduced.
- [Route account checks](../programs/dusd_burn/src/lib.rs#L54): fixed first ten router accounts, fixed JUP6 executable, executable-program allowlist, fixed canonical PumpSwap pool discriminator/owner/key, and restrictions on protocol-owned token accounts. The caller cannot be forwarded. The CPI sets signer only for the treasury PDA. A well-formed unauthorized pool is rejected even if a genuine canonical pool is appended as a decoy.
- [Postconditions](../programs/dusd_burn/src/lib.rs#L108): positive new DUSD, exact WSOL consumption, unchanged treasury custody and exact native reserve. Full designated DUSD is burned, and mint supply reduction is checked. A later transaction failure rolls back all of these effects, including apparently emitted events.
- [`execute_buy_and_burn`](../programs/dusd_burn/src/lib.rs#L122): the existing fixed native PumpSwap exact-input path remains available without Jupiter/API dependence. Pool extension and accumulator initialization use the external caller's rent. Dynamic AMM fees remain Pump's responsibility.
- [`burn_dusd`](../programs/dusd_burn/src/lib.rs#L199): only the designated ATA and fixed mint can be burned; the treasury need not hold SOL or even exist as a funded native account. Zero balance is a harmless no-op.
- [`unwrap_quote`](../programs/dusd_burn/src/lib.rs#L211): only the canonical WSOL ATA can close, only into the same treasury, and only at 0.01 WSOL or above. No caller withdrawal destination or general rescue exists.
- [Account declarations](../programs/dusd_burn/src/lib.rs#L230): canonical PDA seeds, System/token ownership, mint, ATA and program identities are checked by Anchor. There are no economic state accounts, setters, administrative instructions, reward paths or upgrade hooks in the monetary logic. Loader upgrade authority is separate and still active on mainnet.

## Threat model

An untrusted caller controls transaction ordering, offered account metas, router payload, gas wallet, quotes and timing. RPCs and the HTTP quote service may lie, become stale or fail. Caller-supplied quotes are not treated as price attestations. The program must not redirect custody, purchase from an unapproved pool, pay caller rent from treasury, spend below threshold, leave bought tokens unburned or partially commit a failed transaction.

The current canonical PumpSwap and Jupiter program semantics remain external dependencies. Program-ID and pool checks constrain integrations, not the behavior of a future malicious upgrade at an allowed ID. Postconditions block the demonstrated account-takeover/underspend behaviors but are not a proof against every imaginable hostile upstream action or poor execution price. No fair-price guarantee is claimed; the one-unit floor is an explicit product choice.

## Liveness boundaries

1. **Current Jupiter is not an independent swap implementation.** Its observed route calls `BuyExactQuoteInV2`, just like the direct path. A future compatible Jupiter adapter could support another Pump instruction, but that must also fit the fixed JUP6 `route_v2`, one-hop and account-validation interface. A new router ID or incompatible serialization is not automatically supported after immutability.
2. A fresh alternative caller may have to initialize Pump's accumulator. The client creates only fixed caller-funded preparation instructions; it ignores all setup/cleanup/tip instructions returned by the API. Full first-use execution fits a 942-byte transaction locally and remains below 1.4M CU.
3. Newly arriving SOL can invalidate the offchain route input before execution. That fails atomically; the next cycle reads a fresh balance and rebuilds. No contract state is stuck. The direct path needs no caller amount or quote and is preferred.
4. Empty/disabled pools, no achievable raw output, incompatible upstream changes, compute limits, RPC/API outage or no willing gas-paying caller can prevent an execution. There is no administrator escape hatch, alternate pool or oracle.
5. Existing WSOL and rent surplus are preserved rather than silently spent. Qualifying WSOL can be recovered only to treasury. Subthreshold WSOL dust and unrelated assets sent to undesignated accounts still have no general recovery route; this is not fixed by Jupiter.

## Coordinator review

The new alternative is attempted at most once per cycle, only after an unsigned simulation rejection. It rereads finalized state and the fee-sharing allocation before constructing that alternative. Network errors, signed pending wire, finalized failed submissions and unresolved signatures do not trigger replacement spending. Existing journaling, kernel exclusion, debit budget, gas-only identity, bounded retries and dual-provider expiry reconciliation remain. No additional API or RPC polling is added while idle.

## Validation and release verdict

The final Windows and Linux artifacts each passed 226 local contract tests, including the existing 176, new router cases and hostile upstream mocks. The suite contains 25,000 arithmetic cases plus 120 malformed-route probes. Separate coordinator tests pass 77/77; bytecode-verification helper tests pass 11/11. Local success is not a new live-cluster test or independent security audit. Current independent CI status is indexed in `verification/candidate/README.md`.

The candidate is ready for independent review and preparation of an explicitly approved, reversible mainnet upgrade with upgrade authority retained. **It is not yet cleared for permanent authority revocation.** First reproduce the selected Linux artifact independently, review this new router surface, approve upgrade funding, execute live direct/Jupiter/donation/rollback smoke tests, refresh public interface/executable pins and verify independent keeper operation. Only then consider a separately approved immutable release.
