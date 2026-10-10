# Bounded audit repair verification (prepared archive)

Official run `engineB-tlink-audit-repair-23d1226`, source `23d12264289538de5f6ef3ef3f36aa9257b10aba`: exit 0, command 263.5 seconds. This directory is prepared evidence, not a new run.

Seed 3 answer h-002840 at62011 retains its merchants −8 contribution through the real audit at62320. The existing stewardship.season record h-002880 at63000 contains exact own-answer because.decisionId h-002840 and traceMerchantsContribution −8. This verifies this bounded case; it does not measure a whole-125-year score uplift or prove the 80% threshold.

The exact result JSON is gzip-preserved, including both 1449-file source pin sets, runtime/lock/tool pins and witnesses. The exact executed helper is retained. During packaging, all three original input SHA pins were checked and the 492-command prefix digest was independently recomputed from original contexts. The original parity archive contains 556 checkpoints through the chosen endpoint. Equality of the replayed checkpoint contents is a runtime assertion in the pinned helper and successful result; packaging does not independently re-execute those states. No every-tick state equality or full replay is claimed.

For reproduction use the pinned source/helper and external original seed3 contexts, collect-parity and preflight identified by SHA in result.json.gz, through the official DGX runner. Raw large inputs are intentionally not duplicated. SHA256SUMS covers all files except itself. No engine/scorer files were modified by packaging.
