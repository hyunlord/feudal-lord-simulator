# Completed acquisition evidence — seven runs at 9f769ee

File-integrity checks: **verified for all seven archives**. UI/effect/LS1-4 acceptance: **not tested by these acquisitions**.

Product revision: `0eddc146c7d57b4cae091bff62295a1fc16e1f97`. Tool revision: `9f769ee5b51f356ef0a1f9f61db1adb3e7a2cd84`.

Each run remains one archive below 3 MiB. All fetched runner receipts, reports and save files remain in the repository. The original fetched directories were not changed.
SHA256SUMS and byte-for-byte restoration were checked for 94 original files; all 31 referenced save records matched compressed, encoded and state SHA values. All storage modes are loose_lossless_files; no tar or decoded-container fallback was needed.
All original report errors arrays are empty. Exit 2 for the 080/174 run is the producer’s bounded-search-without-target result and remains recorded; it is not converted into acquisition success.

| Archive / case | Official run | Exit | Observation ticks | Requested IDs acquired | Requested IDs absent | Bytes |
|---|---|---:|---|---|---|---:|
| [010-seed3](../eb-weight-input-010-seed3/README.md) | engineB-weight-input-010-seed3-9f769ee | 0 | 174000 → 184000 | ck_evt_010 | none | 1087170 |
| [038-seed1-new-game](../eb-weight-input-038-seed1-new-game/README.md) | engineB-weight-input-038-seed1-new-game-9f769ee | 0 | 0 → 36000 | ck_evt_038 | none | 738607 |
| [051-seed1](../eb-weight-input-051-seed1/README.md) | engineB-weight-input-051-seed1-9f769ee | 0 | 171999 → 184000 | ck_evt_051 | none | 1184771 |
| [059-seed3](../eb-weight-input-059-seed3/README.md) | engineB-weight-input-059-seed3-9f769ee | 0 | 44149 → 48000 | ck_evt_059 | none | 201528 |
| [080-174-seed1](../eb-weight-input-080-174-seed1/README.md) | engineB-weight-input-080-174-seed1-9f769ee | 2 | 500000 → 560000 | none | ck_evt_080, ck_evt_174 | 1995106 |
| [209-seed2](../eb-weight-input-209-seed2/README.md) | engineB-weight-input-209-seed2-9f769ee | 0 | 98047 → 103000 | ck_evt_209 | none | 385537 |
| [audit](../eb-weight-input-audit/README.md) | engineB-weight-audit-input-9f769ee | 0 | 54320 → 55000 | ck_evt_052 | ck_evt_013, ck_evt_025 | 335002 |

## Genuine offered-state inputs retained

The 22 records below cover 14 distinct cohort IDs. “Offered” includes any genuine offer already present at the first observation; it does not imply every row arose after resuming. The acquisition loop captured the offered state before answering it. Choice IDs are the actual offerChoices result, not newly enabled alternatives.
| Case | Event | Tick | Actual offered choices | Retained save |
|---|---|---:|---|---|
| 010-seed3 | ck_evt_032 | 174000 | roll, defer | [ck_evt_032-offered-174000-0.save.json.gz](../eb-weight-input-010-seed3/files/eb-weight-acquire-remaining/010-seed3/ck_evt_032-offered-174000-0.save.json.gz) |
| 010-seed3 | ck_evt_038 | 177000 | enforce, defer | [ck_evt_038-offered-177000-1.save.json.gz](../eb-weight-input-010-seed3/files/eb-weight-acquire-remaining/010-seed3/ck_evt_038-offered-177000-1.save.json.gz) |
| 010-seed3 | ck_evt_046 | 178000 | trim, cancel | [ck_evt_046-offered-178000-2.save.json.gz](../eb-weight-input-010-seed3/files/eb-weight-acquire-remaining/010-seed3/ck_evt_046-offered-178000-2.save.json.gz) |
| 010-seed3 | ck_evt_209 | 180000 | a, b, c, d | [ck_evt_209-offered-180000-3.save.json.gz](../eb-weight-input-010-seed3/files/eb-weight-acquire-remaining/010-seed3/ck_evt_209-offered-180000-3.save.json.gz) |
| 010-seed3 | ck_evt_010 | 184000 | a, b, c | [ck_evt_010-offered-184000-4.save.json.gz](../eb-weight-input-010-seed3/files/eb-weight-acquire-remaining/010-seed3/ck_evt_010-offered-184000-4.save.json.gz) |
| 038-seed1-new-game | ck_evt_005 | 26000 | a, b, c | [ck_evt_005-offered-26000-0.save.json.gz](../eb-weight-input-038-seed1-new-game/files/eb-weight-acquire-remaining/038-seed1-new-game/ck_evt_005-offered-26000-0.save.json.gz) |
| 038-seed1-new-game | ck_evt_042 | 27000 | light, firm | [ck_evt_042-offered-27000-1.save.json.gz](../eb-weight-input-038-seed1-new-game/files/eb-weight-acquire-remaining/038-seed1-new-game/ck_evt_042-offered-27000-1.save.json.gz) |
| 038-seed1-new-game | ck_evt_211 | 29000 | a, b, c | [ck_evt_211-offered-29000-2.save.json.gz](../eb-weight-input-038-seed1-new-game/files/eb-weight-acquire-remaining/038-seed1-new-game/ck_evt_211-offered-29000-2.save.json.gz) |
| 038-seed1-new-game | ck_evt_201 | 31000 | a, b, c | [ck_evt_201-offered-31000-3.save.json.gz](../eb-weight-input-038-seed1-new-game/files/eb-weight-acquire-remaining/038-seed1-new-game/ck_evt_201-offered-31000-3.save.json.gz) |
| 038-seed1-new-game | ck_evt_092 | 32000 | a, b | [ck_evt_092-offered-32000-4.save.json.gz](../eb-weight-input-038-seed1-new-game/files/eb-weight-acquire-remaining/038-seed1-new-game/ck_evt_092-offered-32000-4.save.json.gz) |
| 038-seed1-new-game | ck_evt_038 | 36000 | enforce, defer | [ck_evt_038-offered-36000-5.save.json.gz](../eb-weight-input-038-seed1-new-game/files/eb-weight-acquire-remaining/038-seed1-new-game/ck_evt_038-offered-36000-5.save.json.gz) |
| 051-seed1 | ck_evt_038 | 173000 | enforce, defer | [ck_evt_038-offered-173000-0.save.json.gz](../eb-weight-input-051-seed1/files/eb-weight-acquire-remaining/051-seed1/ck_evt_038-offered-173000-0.save.json.gz) |
| 051-seed1 | ck_evt_209 | 179000 | a, b, d | [ck_evt_209-offered-179000-1.save.json.gz](../eb-weight-input-051-seed1/files/eb-weight-acquire-remaining/051-seed1/ck_evt_209-offered-179000-1.save.json.gz) |
| 051-seed1 | ck_evt_046 | 182000 | trim, cancel | [ck_evt_046-offered-182000-2.save.json.gz](../eb-weight-input-051-seed1/files/eb-weight-acquire-remaining/051-seed1/ck_evt_046-offered-182000-2.save.json.gz) |
| 051-seed1 | ck_evt_051 | 184000 | file, leave, file_with_deed | [ck_evt_051-offered-184000-3.save.json.gz](../eb-weight-input-051-seed1/files/eb-weight-acquire-remaining/051-seed1/ck_evt_051-offered-184000-3.save.json.gz) |
| 059-seed3 | ck_evt_059 | 48000 | delegate, loyal_candidate | [ck_evt_059-offered-48000-0.save.json.gz](../eb-weight-input-059-seed3/files/eb-weight-acquire-remaining/059-seed3/ck_evt_059-offered-48000-0.save.json.gz) |
| 080-174-seed1 | ck_evt_083 | 501000 | a, c | [ck_evt_083-offered-501000-0.save.json.gz](../eb-weight-input-080-174-seed1/files/eb-weight-acquire-remaining/080-174-seed1/ck_evt_083-offered-501000-0.save.json.gz) |
| 080-174-seed1 | ck_evt_046 | 509000 | trim, cancel | [ck_evt_046-offered-509000-1.save.json.gz](../eb-weight-input-080-174-seed1/files/eb-weight-acquire-remaining/080-174-seed1/ck_evt_046-offered-509000-1.save.json.gz) |
| 080-174-seed1 | ck_evt_092 | 534000 | a, b | [ck_evt_092-offered-534000-2.save.json.gz](../eb-weight-input-080-174-seed1/files/eb-weight-acquire-remaining/080-174-seed1/ck_evt_092-offered-534000-2.save.json.gz) |
| 080-174-seed1 | ck_evt_083 | 551000 | a, c | [ck_evt_083-offered-551000-3.save.json.gz](../eb-weight-input-080-174-seed1/files/eb-weight-acquire-remaining/080-174-seed1/ck_evt_083-offered-551000-3.save.json.gz) |
| 209-seed2 | ck_evt_209 | 103000 | a, b, d | [ck_evt_209-offered-103000-0.save.json.gz](../eb-weight-input-209-seed2/files/eb-weight-acquire-remaining/209-seed2/ck_evt_209-offered-103000-0.save.json.gz) |
| audit | ck_evt_052 | 55000 | punish, replace, tolerate | [ck_evt_052-offered-55000-0.save.json.gz](../eb-weight-input-audit/files/eb-weight-audit-acquire/ck_evt_052-offered-55000-0.save.json.gz) |

## Initial, final and external input provenance

| Case | Captured initial/admitted save | Final save |
|---|---|---|
| 010-seed3 | External pinned historical input; not copied by producer | [final.save.json.gz](../eb-weight-input-010-seed3/files/eb-weight-acquire-remaining/010-seed3/final.save.json.gz) |
| 038-seed1-new-game | [initial.save.json.gz](../eb-weight-input-038-seed1-new-game/files/eb-weight-acquire-remaining/038-seed1-new-game/initial.save.json.gz) | [final.save.json.gz](../eb-weight-input-038-seed1-new-game/files/eb-weight-acquire-remaining/038-seed1-new-game/final.save.json.gz) |
| 051-seed1 | External pinned historical input; not copied by producer | [final.save.json.gz](../eb-weight-input-051-seed1/files/eb-weight-acquire-remaining/051-seed1/final.save.json.gz) |
| 059-seed3 | External pinned historical input; not copied by producer | [final.save.json.gz](../eb-weight-input-059-seed3/files/eb-weight-acquire-remaining/059-seed3/final.save.json.gz) |
| 080-174-seed1 | External pinned historical input; not copied by producer | [final.save.json.gz](../eb-weight-input-080-174-seed1/files/eb-weight-acquire-remaining/080-174-seed1/final.save.json.gz) |
| 209-seed2 | External pinned historical input; not copied by producer | [final.save.json.gz](../eb-weight-input-209-seed2/files/eb-weight-acquire-remaining/209-seed2/final.save.json.gz) |
| audit | [initial-admitted.save.json.gz](../eb-weight-input-audit/files/eb-weight-audit-acquire/initial-admitted.save.json.gz) | [final.save.json.gz](../eb-weight-input-audit/files/eb-weight-audit-acquire/final.save.json.gz) |

For resumed cases, the external original input container was not copied into these fetched outputs. Its path and SHA pins remain in each original acquisition report and archive.json. The admitted audit envelope retains the authentic state, but is not the original raw input byte container.

- 010-seed3: `/home/hyunlord/fls-runs/_kept/engineB-weight125-kept-clean-2485af4/.remote/eb-weight-kept/checkpoints/seed-3/ck_evt_009-consequence-h-008234.save.json.gz`; matching fetched original raw container: absent.
- 051-seed1: `/home/hyunlord/fls-runs/_kept/engineB-answer-json-92bbc7d-92bbc7d/.remote/eb-answer-replay/seed-1/ck_evt_034-preclose-171999.save.json.gz`; matching fetched original raw container: absent.
- 059-seed3: `/home/hyunlord/fls-runs/_kept/engineB-weight125-kept-clean-2485af4/.remote/eb-weight-kept/checkpoints/seed-3/ck_evt_209-answer-h-001950.save.json.gz`; matching fetched original raw container: absent.
- 080-174-seed1: `/home/hyunlord/fls-runs/_kept/engineB-weight125-kept-clean-2485af4/.remote/eb-weight-kept/checkpoints/seed-1/final.save.json.gz`; matching fetched original raw container: absent.
- 209-seed2: `/home/hyunlord/fls-runs/_kept/engineB-weight125-kept-clean-2485af4/.remote/eb-weight-kept/checkpoints/seed-2/ck_evt_046-answer-h-007126.save.json.gz`; matching fetched original raw container: absent.
- audit: `/home/hyunlord/fls-lmr2-states/audit-pending.json`; matching fetched original raw container: absent.

## Interpretation limits

- 010, 051, 059, 080/174 and 209 resume pinned authentic historical saves under current rules and normal bot commands. They are new trajectories, not reproductions of the original historical run.
- 038 starts an ordinary seed-1 lord_slice game and uses the normal bot. Opening policy and state facts were not edited.
- The audit input is an authentic but deliberately chosen player-policy path from lmr2States: actual inheritance, appointment and visit audit. It is not the default lord-bot cohort. It advances the pending audit from 54320 to 55000 without answering it, before its 55320 deadline.
- Audit status is at_least_one_target_acquired: only 052 is present. It does not establish 013 or 025 acquisition.
- 080/174 stayed absent through tick 560000 from tick 500000. That bounded observation does not prove permanent unreachability; the final genuine save is retained for later authorized work.
- These archives verify inputs and provenance. They do not verify real card interaction, successful answers, outcome traces, automatic results chips, visual readability, event frequency, or a 56-event UI gate.
- This archival step used local file inspection, decompression and hashes only. No additional game, browser, DGX or simulation run was started.
