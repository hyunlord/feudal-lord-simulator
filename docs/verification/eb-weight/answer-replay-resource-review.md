# Replay resource feasibility: read-only preflight

Verdict: **No blocking resource finding for the pinned three-seed replay. Runtime/RSS remain unmeasured.** No simulation, benchmark or remote job was started. This review read the two recorder/runner sources and decoded existing archived checkpoint files; it does not certify DGX capacity or duration.

## Observed scale (existing archives, not new runs)

| Seed | Command attempts | Changed commands | Raw audit JSON bytes | Final retained history rows | Final next history ordinal | Largest inspected checkpoint bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2117 | 500 | 2680827 | 6646 | 32735 | 5146976 |
| 2 | 2114 | 501 | 2840000 | 7500 | 38605 | 8435407 |
| 3 | 1849 | 562 | 2825528 | 6260 | 25035 | 4567647 |

Sources: `docs/verification/eb-weight/kept-2485af4/seed-{1,2,3}.json.gz` and `.omo/evidence/weight125-kept-partial/{checkpoints,checkpoints-seed2,checkpoints-seed3}`. Attempts = original observation count minus500001 (initial plus500000 ticks), preserving no-op attempts. The raw archive contains1569/1682/1759 selected history rows; final state retained histories are as above. There is no evidence of a million-row retained history in these inputs. Inspected29/31/30 gzip checkpoints; cumulative decoded bytes81.28/90.86/64.12MB respectively. These checkpoint samples are not a proven maximum for every unarchived intermediate state.

## Allocation and I/O assessment

- `engineBAnswerEvidence.ts:45–62` clones one compact command/history/context record per eligible command attempt; it does **not** clone/store a whole state every tick. Only a direct `petition_response` whose actual petition def is a registry chapter def gets a complete before-state. The registry chapter lookup currently recognizes ck_evt_057/058 (`registryChapterPetitions.ts:7–28`). All19 successful chapter response history records per archived seed name ordinary chapter defs, not those two. This indicates the expensive context branch is uncommon/absent among successful original chapter answers; archives alone do not prove no failed attempt could take it. The implementation retains every such clone until finish, so general reuse with many dynamic chapter responses could be expensive.
- `engineBAnswerReplay.ts:68–70,235` serializes before and after twice (four full serializations) per command attempt for the mutation guard, **not** per tick. This is the clearest added CPU/allocation cost. At sampled state scales it can cumulatively process tens of GB of JSON per seed, but that is allocation throughput, not live retained memory. Only a few temporary strings coexist at each call. No runtime estimate is justified without measurement.
- Checkpoint preflight (`Replay:113–128,185–192`) synchronously reads/decompresses/parses/decodes each save. It returns only metadata/hash/checksum, not its full state. There is temporary duplication of decoded objects and strings per file, but no array holding all checkpoint states. Garbage collection timing may keep several temporary allocations live briefly.
- Original raw JSON remains parsed, plus the original collector's maps. Their storage is bounded by this archived run's decisions/history/occurrences, not one full state per500000 ticks. The candidate collector keeps grouped first/last diagnostics. Command-stream hashing is incremental and does not retain its full text (`Replay:234`).
- `gzipSync(JSON.stringify(answers.snapshot()))` (`Replay:196–198`) is **not streaming**: snapshot deep-clones all retained contexts, serialization makes a complete string, gzip makes a complete output buffer, then `writeFileSync` writes it. `saveContexts(); const contexts=answers.snapshot()` (`:254`) adds another clone for classification. Full-context branches therefore multiply peak memory. At the observed small number of commands and likely rare full-state contexts, no concrete heap-limit blocker is established; do not advertise constant memory or streaming/backpressure handling.
- Original collector snapshot and mismatch saves also use synchronous stringify/gzip/write (`:246,249`). Synchronous calls naturally stop production until each write returns; there is no unbounded asynchronous write queue and no writable-stream backpressure bug. They may create pauses and allocation spikes.
- Wrapper invokes three separate seed processes serially. Heap/evidence arrays cannot accumulate across all three seeds within one Node process. Four seed1 preclose saves use the same blocking pipeline and do not retain full saved states in capture metadata.

## Operational limits

The process can still fail from real host contention, disk exhaustion, unexpected context count, or peak allocations. No RSS, GC, elapsed-time or free-disk observation was taken here, and the wrapper does not specify a special Node heap cap. Hard OOM/SIGKILL bypasses JavaScript cleanup, so a final verified validity file must remain the acceptance gate; pending/preflight evidence is not a result. The catch path tries to save contexts again, which cannot guarantee recovery if allocation or disk failure caused the original error. This is a failure-evidence limitation, not a demonstrated launch blocker at the observed scale.

Keep the scheduled run serial and preserve actual progress/exit/validity artifacts. No speculative optimization or change to command/collector cadence is warranted before evidence shows a problem.

Only this ignored review artifact was written. No source code was changed.
