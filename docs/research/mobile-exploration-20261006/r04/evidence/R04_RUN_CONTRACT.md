# R04 streaming league run contract

2026-10-06. Runner code only; no evaluation seeds executed during implementation. Full original schedules retained: duel11880; multi19800. They are schedule counts, not completed measurements.

## Invocation

Working directory `/Users/rexxa/fls-astra-mobile/mobile-study`; existing installed Node25.8.2 and `../node_modules/.bin/tsx`. No install, DGX, credentials or original source mutation.

```
../node_modules/.bin/tsc -p prototype/tsconfig.json --noEmit
../node_modules/.bin/tsx prototype/league/run.ts --kind duel --batch 0 --batch-size 100 --out records/league-run
../node_modules/.bin/tsx prototype/league/run.ts --kind multi --batch 0 --batch-size 100 --out records/league-run
```

Duel batches0..118 (last80); multi0..197. Run sequentially in bounded sessions; parent owns orchestration and completion audit. A process finishes at100games or30seconds of simulation/output walltime, checked between complete games. One synchronous game can exceed deadline; this is a cooperative watchdog, not OS preemption. Initial schedule/provenance setup and final filesystem flush are outside strict30seconds. Batch size1..1000 is accepted, default100. Do not run same batch concurrently; exclusive lock rejects that. Different batch-size layouts in the same output directory must not be combined into a denominator.

If status is `partial-resume-same-command`, rerun the exact command. It verifies prior chunk provenance/SHA/contiguous range/exact schedule IDs before beginning at next uncompleted index. `batch-complete` means only the requested batch; `already-complete` verifies that batch's prior compressed hashes/manifest coverage. Neither claims the full league is complete. Changed source/schedule refuses reuse. A stale process lock after crash requires checking PID liveness before removal; this runner does not guess a process is dead. Orphan data is refused rather than overwritten.

## Artifacts and raw records

Per kind: `*-provenance.json` includes per-file SHA256 for the explicit simulation closure: `model/*.ts` except UI-only `session.ts` and `build-identity.ts`, plus `league/{game,schedule,strategies,compact,run}.ts`, combined sourceHash, RULE_VERSION, scheduleHash and total count. `*-schedule.json` contains every full spec and ordered seat rotation. Every chunk is streaming gzipNDJSON. Its filename encodes kind/batch/batchsize/start/end(exclusive). Data is written temporary then atomically renamed; manifest is written temporary then atomically renamed. Manifest includes count, exact IDs, data SHA256, elapsedwalltime, Node/platform/architecture and batchComplete. Source hashes are checked again before commit. OS crash between the two renames can leave orphan data, explicitly refused on resume; no transactionality claim.

Each game line carries ID/block/rotation, full strategy vectors/seed/terrain/growth age/diplomacy flag, all three snapshots, wars, decisions, processing orders and full diplomacy accumulator. Snapshots preserve population, free stocks, finite external market, own escrow, V, actual policy, active counts, all facilitypositions/hp/workers, paidservices, householdpositions/population/joblinks, roads, mobilized/migrant/starvation state, and flows grouped by exact account+reason. Percontract dynamic reasons are preserved so financial provenance is not erased. Full per-tick ledger and choice candidate arrays are omitted; deterministic singlematch replay reconstructs them in the shared model if required. Road/household data allows spatial-diversity analysis beyond axiscolor. Wars retain every WarRecord field; nonraid is distinguished by decisions and never invented as a warloss.

Preparedgrowth cache lives only for one process and keys seed,terrain,age,entire strategy including adaptive flag and vector. The match clones prepared cities; existing exact-equality/immutability test verifies cached and uncached games. No global unbounded cache or approximate growth replacement.

## Reproduce one game

```
../node_modules/.bin/tsx prototype/league/run.ts --kind duel --replay-index 0 > /tmp/astra-duel-game0.json
```

This executes a selected evaluation game and therefore must wait for parent's evaluation launch authorization. Output wraps compact game with current source/schedule hashes. For training-only runner QA use `--kind smoke --replay-index 0`; smoke has one seed1/fourcity/river/48growth spec. Source files must remain unchanged for identical hashes. Node API `runGame(schedule[index])` exposes full result if deeper ledger/receipts are needed.

## Verified here

- StrictTypeScript passed; existing league tests5/5, including fullschedulecounts/seatbalance and cached result equality.
- Training-only smoke command `--kind smoke --batch 0 --out /tmp/astra-league-runner-smoke-20261006`:1completegame,135.534ms reported processwork. Second invocation `already-complete`.
- gzip decompression, exact one ID/count, SHA256, all12snapshot V values and independent singlematch replay equality passed.
- Smoke data SHA256 `3ef5fcfe9cbd716ed5ad393e76dd82bff206329148b8065249a67ee651f1b659`; sourceHash `cdf1111b784d232587bd2e3caab000d92082ee97fe8672a56b61d804df210775` at QA time.
- Deadline partial-resume was reviewed but not forced with evaluation games or artificial sleeps. Fullcoverage and final statistical analysis remain parent's task; zero heldout games were run here.

Architecture self-review: compact.ts owns audit serialization; run.ts owns bounded CLI execution/provenance. Both <=120lines. CLI options and prior manifest are checked at boundary; no type assertions, suppressed errors or new dependencies. Mutable maps/stream accumulators are local process state. Explicit sourcehash and completecounts prevent timing-only smoke from being mislabeled fullleague evidence.


## Compiled runner correction before heldout

Runner ascends from its executing module until both `tsconfig.json` and `model/economy.ts` exist, or fails. This supports `node prototype/dist/league/run.js` without requiring tsx at delivery. An empty `.ts` source list under dist is no longer accepted. The explicit sourceSelection is included in provenance. Reporting/analysis/smoke scripts and UI session/build identity are excluded because the simulation closure does not import them; `model/index.ts` exports only types/rules/economy. Later report edits do not invalidate gameplay provenance. If new imports change that closure, sourceSelection must change before further runs.

Always run `../node_modules/.bin/tsc -p prototype/tsconfig.json` immediately before compiled execution; the recorded TypeScript source hash is not itself proof that stale JS was rebuilt. Compiled smoke was built then executed on trainingseed1 only;16 source files were present, sourceclosure/exclusions/combinedhash and replay equality verified. Final sourcehash is reported separately after the final exclusion update. No evaluation seeds executed.

Delivery command from mobile-study: `node prototype/dist/league/run.js --kind duel --batch 0 --batch-size 100 --out records/league-run`. Source TypeScript and tsconfig must remain beside dist for provenance verification, even though installed TypeScript runtime dependencies are not required to execute compiled JS.
