# Historical replay 27599bd: projection verified, exact40 gate report reviewed

This compact archive preserves the actual seed 1 / 125-year replay of source `56ee1d9d8259f89e6122153cedd82e783a74f5c7`, instrumented with tools `27599bd5ace470476a8ee0be727535b34a0373a5` under Node `v24.21.0`.

The run exited 0: command 1970.2 s, preparation 3.5 s, wait 2.0 s. Its 63,748 observation rows match 63,748 callback invocations, with zero observer failures and zero write failures. The parent independently checked the unit was inactive/dead and no process retained this run's working directory.

The complete saved `registryDecisionRun` return is byte-identical to the original archived run: SHA-256 `95d34c0a79b51856386c4cfc443ddb1a224a3d9408d928ca33b105b67ffb3d52`. The saved distribution summary equals the original report's summary. These are projection and saved-summary checks, not full engine-state or per-tick equality.

The externally supplied replay-manifest SHA-256 is `91bdcf3dd03e9e9d36b2bb06d138c90d29e386877ac9830ea47f0604363b2cfc`. Archival verification checked that pin, all 12 manifest artifact hashes, raw/gzip observation equivalence, row count, original run bytes, and saved report summary. `parent-check.json.gz` preserves the parent's additional copied-tool/commit, generated instrumentation, stripped historical source, observer, prerequisite receipt, and terminal checks; it is attributed parent evidence. The independent `scope_review` reviewer also reported PASS for all 12 artifact hashes, four tool/commit matches, actual instrumentation regeneration and stripping, whole-run hash, saved summary, 63,748 rows, and zero errors. It verified the command embedded in `run.log` against the current ignored wrapper (apart from a final newline). That wrapper itself is not tracked in the tool commit; the retained `run.log` preserves the complete actual command. The independent reviewer did not repeat remote terminal/process checks over SSH; those remain separately attributed parent checks. This source/projection review is separate from the classification review below.

`applicabilityAllowed` remains **false** in the successful run manifest. Full-state equality, per-tick identity, and original runtime provenance are unproven. The observation counts are instrumented replay evidence; the gate report below does not prove complete original hidden causes or complete the broader Engine B task.

## Retained evidence

Eleven gzip files preserve small metadata without changing original JSON bytes. `provenance.json` records compressed and original hashes, every one of the 30 retained run files, and separate copied-tool and instrumentation hashes. `SHA256SUMS` covers the archive files other than itself. The large observation stream, full replay JSON, and full distribution summary are intentionally retained outside this tracked archive.

- Local retained run: `/tmp/engineB-historical-null-27599bd/.remote-runs/engineB-historical-null-27599bd`
- Remote retained run: `/home/hyunlord/fls-runs/_kept/engineB-historical-null-27599bd/.remote`
- Output subdirectory in each run: `eb-historical-56ee1d9`
- All 30 retained files: 27,449,175 bytes, including 23,056,334-byte raw NDJSON and its 993,283-byte gzip.

From this archive directory, run `shasum -a 256 -c SHA256SUMS` to verify stored files. Decompressed metadata hashes are recorded in `provenance.json`; source artifact hashes refer to the retained run, not reconstructed files. No new engine execution or browser capture was performed to create this archive.

## Historical exact40 report

[한국어 사건별 분류](classification.md): observed prerequisite/choice bottlenecks 33, weighted-selection competition 4, era exclusion 2, one unresolved requested-category assignment (147). Its scheduling rejections are measured; downstream eligibility is unobserved. `classification.json.gz` preserves all 40 rows, historical specifications and 255 embedded raw-line witnesses. `classification-parent-check.json.gz` records the independent parent recomputation of all gate counts, raw witnesses and five weighted losses. Independent `scope_review` found no blocker in exact IDs, counts, historical specifications, source hashes or all five selection intervals. It flagged the `cooldown-conflict` category name: consumers must retain subtype `single_slot_weighted_competition_not_literal_cooldown`; these four cases are weighted selection losses, not literal cooldown/dedup rejections. Event 147 remains outside a resolved assignment to the requested five categories. No full-cause or overall completion claim is added.

The four derived gzip files and classification report are separate from the eleven original metadata gzip files above. `provenance.json` includes their original/compressed hashes. The original successful run manifest is unchanged.
