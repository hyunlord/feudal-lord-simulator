# Seed2 retained checkpoint validation

**PASS** — fetched completed existing DGX artifacts only. No simulation or browser launch.

Local: `.omo/evidence/weight125-kept-partial/checkpoints-seed2`. Remote: `hyunlord@100.70.109.50:/home/hyunlord/fls-runs/engineB-weight125-kept-clean-2485af4/.remote/eb-weight-kept/checkpoints/seed-2/`.

Manifest SHA-256: `766a84d5db46f5a91777f885f11c0a249b3e84aec3169635216201efb1b3553e`. Entire parsed manifest equals pinned seed2 raw report checkpointManifest (raw SHA-256 `9e3737c46b4825564510f1748f36d0abef4376824cf34bf57237d89ba50663be`). Checkpoint source clean `2485af40046793f1856829fa1161dc4431942aa7`; validator HEAD `016ab02e96fadcb66beb7884e831af295d46b0ba`.

Save source compatibility: git diff from checkpoint source to validator HEAD under src/save is empty; working tree src/save is clean. All 31 gzip files pass exact file set, size, compressed hash, uncompressed encoded-save hash, official decodeSave, and unnormalized JSON.stringify(decoded.state) === JSON.stringify(originalEnvelope.state). No state normalization or reconstruction was applied.

All files: seed2, scenario `core:lord_slice`, state/header tick agrees with manifest observedTick. 16 first-lord pairs: 14 with consequence, 2 without retained consequence (ck_evt_046, ck_evt_209). Total compressed bytes 5621916.

| File | Tick | Bytes | Full original state JSON preserved |
|---|---:|---:|---|
| ck_evt_009-answer-h-000381.save.json.gz | 9049 | 64654 | yes |
| ck_evt_009-consequence-h-000474.save.json.gz | 10000 | 68818 | yes |
| ck_evt_211-answer-h-002496.save.json.gz | 33073 | 101867 | yes |
| ck_evt_211-consequence-h-002538.save.json.gz | 33600 | 103547 | yes |
| ck_evt_005-answer-h-002615.save.json.gz | 34009 | 104820 | yes |
| ck_evt_005-consequence-h-002813.save.json.gz | 36000 | 107811 | yes |
| ck_evt_092-answer-h-002817.save.json.gz | 36037 | 107217 | yes |
| ck_evt_092-consequence-h-002999.save.json.gz | 38400 | 110675 | yes |
| ck_evt_042-answer-h-002984.save.json.gz | 38065 | 109415 | yes |
| ck_evt_042-consequence-h-003000.save.json.gz | 38400 | 110675 | yes |
| ck_evt_201-answer-h-003145.save.json.gz | 40015 | 111981 | yes |
| ck_evt_201-consequence-h-003190.save.json.gz | 40800 | 114769 | yes |
| ck_evt_032-answer-h-003241.save.json.gz | 41029 | 114884 | yes |
| ck_evt_032-consequence-h-003336.save.json.gz | 42000 | 117186 | yes |
| ck_evt_083-answer-h-004078.save.json.gz | 51013 | 130517 | yes |
| ck_evt_083-consequence-h-004152.save.json.gz | 52800 | 129765 | yes |
| ck_evt_130-answer-h-005112.save.json.gz | 67003 | 140375 | yes |
| ck_evt_130-consequence-h-005543.save.json.gz | 74320 | 144357 | yes |
| ck_evt_053-answer-h-006245.save.json.gz | 85021 | 159509 | yes |
| ck_evt_053-consequence-h-006304.save.json.gz | 86000 | 166565 | yes |
| ck_evt_046-answer-h-007126.save.json.gz | 98047 | 181834 | yes |
| ck_evt_209-answer-h-007455.save.json.gz | 103039 | 183909 | yes |
| ck_evt_140-answer-h-015428.save.json.gz | 222067 | 250014 | yes |
| ck_evt_140-consequence-h-015881.save.json.gz | 230320 | 253082 | yes |
| ck_evt_206-answer-h-019502.save.json.gz | 286027 | 297360 | yes |
| ck_evt_206-consequence-h-019504.save.json.gz | 286080 | 298006 | yes |
| ck_evt_204-answer-h-023122.save.json.gz | 326041 | 336331 | yes |
| ck_evt_204-consequence-h-023125.save.json.gz | 326400 | 335853 | yes |
| ck_evt_165-answer-h-026606.save.json.gz | 366055 | 358516 | yes |
| ck_evt_165-consequence-h-026607.save.json.gz | 366080 | 358586 | yes |
| final.save.json.gz | 500000 | 449018 | yes |

Per-file compressed/encoded/state hashes and decode schema details are retained in sibling JSON. This verifies archival integrity/load compatibility, not UI visibility, effect completion or three-seed frequency closure.
