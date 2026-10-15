# EB-TLINK sampled rule-state parity

`createTlinkParityObserver({seasonLength: 1000})` in `scripts/engineBTlinkParity.ts` is passive. Call `observe(state, {phase, commandOrdinal})` at initial state, after every attempted command, after every tick, and once at final state. Command ordinals start at zero and advance for every attempt, including no-op commands. Tick observations must advance exactly one; commands/final must retain the current tick. `snapshot()` returns JSON-serializable evidence; acceptance requires `finalized:true` on both sides.

The observer checks cadence on every call but hashes only initial state, every command result, each season boundary, and explicit final state. Its rolling SHA256 includes these observations in order (phase, tick, ordinal, projected state hash). Checkpoints retain each selected hash so the first sampled mismatch can be located. Compare the complete snapshots plus the producer's exact command-stream SHA, seed, interval, Node/lock and identical helper-file SHA. Keep each run's source revision separately: baseline and prototype intentionally differ. No long run or performance acceptance has been executed for this helper.

## Exact projection

The only exclusions are `history`, `trace.decisions`, and `trace.answers`. All other own JSON fields, including unknown future fields, remain. `trace.acts` is retained because faction action frequency depends on it. Object keys are sorted; array order remains significant. Canonicalization follows JSON number semantics (`-0` becomes `0`), omits undefined object properties and treats undefined array slots as null. Nonfinite numbers and non-plain objects are rejected. No mutation, reducer, tick or random function is called. There is no object identity cache and no assumed immutability.

This is a scoped projection, not full raw-state identity. Excluded history can affect faction relations; those resulting relations remain compared. Causal record/decision IDs in faction memories, ledger source references or other domain fields remain significant. They are NOT normalized or stripped. If receipt insertion renumbers these IDs, comparison must fail pending an explicit source-reviewed identity mapping, rather than silently accept the mismatch.

## Boundaries

Every-tick state equivalence is **not** claimed. A change after a tick that is reverted before the next command or season boundary can escape the sampled hashes; a regression test explicitly demonstrates this limit. Existing official guardrail verdicts and full final-state hashes remain untouched and must be archived alongside this additional projection. Native full-state hashes can differ due to history changes; this helper does not relabel those hashes equal. `finalHash` is the latest sampled hash until `finalized:true`; it is not final proof before that flag.

Existing outcome scoring remains independent: mature exact own-answer later nondecision receipts within12000 ticks, unchanged denominator and80% threshold. Rule parity does not establish causal honesty, conditional eligibility or actual UI visibility.

## Integration sketch

```ts
const parity = createTlinkParityObserver({ seasonLength: 1000 });
parity.observe(state, { phase: 'initial', commandOrdinal: 0 });
// Existing unchanged loop, after every gameReducer attempt:
parity.observe(state, { phase: 'command', commandOrdinal });
// Existing unchanged loop, after every advanceTick:
parity.observe(state, { phase: 'tick', commandOrdinal });
// After the original loop:
parity.observe(state, { phase: 'final', commandOrdinal });
const evidence = parity.snapshot();
```

Do not add an extra reduction/tick for measurement. The same helper bytes must be wired into both revisions. Official guardrail seasonal callbacks may use a separately declared sampled cadence; they cannot claim this helper's every-command cadence unless the command observation points are actually supplied.

## Producer opt-in

Set `FLS_TLINK_PARITY=1` when invoking the existing outcome producer. Unset or0 leaves parity observation disabled; other values reject. The producer records the helper SHA only when enabled, observes both original and replay phases at the exact existing command/tick points, and requires their sampled evidence and final projection bytes to agree. It does not change outcome classification or scoring.

Each seed directory gains `collect-parity.json`, `replay-parity.json`, `collect-rule-state.json.gz`, and `replay-rule-state.json.gz`; manifest `tlinkParity.artifacts` pins all four actual file SHA256s. Decompressed rule-state bytes are canonical JSON without a trailing newline and their SHA equals the evidence finalHash. These diagnostics retain remaining IDs for concrete difference investigation. Partial failures retain already-written files and do not yield valid replay acceptance.

For a paired run, prepare clean committed baseline and prototype worktrees with **identical producer and parity helper bytes**, plus identical other measurement-tool bytes and lock/runtime. The baseline product source remains the original engine; copying only measurement files must be recorded as a baseline instrumentation commit. Use the same seed/years/options and `FLS_TLINK_PARITY=1` on both. Compare each revision's own original/replay equality before cross-revision sampled equality. Never claim existing older archives contain this newly added measurement. No producer simulation has been run during integration.
