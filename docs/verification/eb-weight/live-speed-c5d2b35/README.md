# Live-speed c5d2b35: failed acceptance test

This archive preserves a failed actual browser continuation using source `2485af40046793f1856829fa1161dc4431942aa7` and browser revision `c5d2b35341dfb9c1a496d3f7bda532bf7e2d4fb8`. Terminal exit was **1**: command 33.3 s, preparation 13.0 s, wait 4171.3 s. Manifest `valid` remains **false**.

The manifest records successful 10× selection and tick progress (`tenSelected` and `progressAtTen`). Across 616 sampled frames the continuation advanced from input tick 40015 to 41000, where a season-ledger panel paused it and the harness stopped at `intervention_required_unknown_or_substantive_blocker`. Browser errors and cleanup errors were both empty.

A new actual receipt `h-002663` at tick 40800 contains `because: {decisionId: h-002653, key: payment_flow, part: true}`. Automatic visibility did not pass: the harness only accepts existing `lord-moment:<historyId>` chip/card identities. `automaticVisible:false` therefore does **not** prove that the renderer displayed no related information through any surface. Manual discovery was not attempted and remains unverified. The target `trace:h-002653:40` chip already existed at tick 40015 and was absent by tick 40690; it is not proof of automatic display of the later receipt.

The parent viewed before-input, transition-2, and final screenshots and reported a visible season panel. It separately verified the remote unit inactive/dead, zero matching run-CWD processes, and no listener on port 4304. Those visual and terminal findings are attributed parent evidence; this archival task did not repeat browser or remote checks. Independent source review against pinned c5d2b35 is complete. `App.tsx:309–321` opens the first informational season ledger, and `AppModals.tsx:132` Continue only pops that modal. `eventStory.ts:237–244` uses `trace:<decisionId>:<season>` news; generic payment-flow consequences have no Wave40 art and therefore no lord-moment identity. The target trace chip disappeared before the new receipt and did not reappear in the observed interval. The tool must distinguish these limitations before any bounded follow-up; the failed result is preserved.

This is a new no-bot continuation, not parity with the original replay. Presentation evidence does not expose raw browser-store identity. Inputs were synthetic DOM clicks through normal handlers; neither native-pointer usability nor real-time performance is established. The failed acceptance test is not successful visibility verification or completion of the broader goal.

## Evidence and retention

The externally verified original manifest SHA-256 is `e75759db493d051747e44aa662fffb6f5711fbbf3f323b43afd21eb70b1a5572`. Its unchanged bytes are stored in `manifest.json.gz`. The manifest's own `manifestSha256` field instead identifies the input checkpoint manifest; it is not this output manifest's self-hash.

`provenance.json` records SHA-256 and sizes for every retained original file, including images, presentation JSON and logs. Those large files remain outside this compact archive:

- Local: `/tmp/engineB-live-speed-c5d2b35/.remote-runs/engineB-live-speed-c5d2b35`
- Remote: `/home/hyunlord/fls-runs/engineB-live-speed-c5d2b35/.remote`
- Output subdirectory: `eb-live-speed`

Run `shasum -a 256 -c SHA256SUMS` from this directory to verify archive files. The gzip's compressed and original hashes are recorded in provenance. No screenshots or full presentation/state files were copied into the archive, and no new engine/browser execution was performed.
