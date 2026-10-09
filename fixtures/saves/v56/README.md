# Provisional v56 relation evidence fixtures

Engine integration owns final numbering alongside the provisional v55/GROW collision. All v55 files remain unchanged.

Standard fixtures: official `node --import tsx scripts/buildSaveFixtures.ts --from-version 55` migrated 13 existing states with no growth run or tick advance. Every input SHA, output size, full decoded state and deterministic re-encoding was checked.

`eb-tlink-estate-relation.save.json` uses the delegated estate test fixture and a real `answer_estate_petition` repair grant, recording tenants 0→4. It is a prepared fixture, not natural-play evidence. Fixed timestamps: 2026-10-10T00:00:00Z. SHA256: e894e16d5251ee2e2d140a4618299609f41da6516f139f4503d74c7bd10583e8. Generated on HEAD 4e7ac9c6be21647d59486101d41abc077e249cf9 plus the uncommitted relation implementation.

Optional legacy evidence stays absent; no backfill. The official fingerprint samples both pending and consumed prepared states in addition to its existing fixture set.

| File | v55 SHA256 | v56 SHA256 |
|---|---|---|
| new-game.save.json | 83be7eab55833a01f53e50adbcd12181ab245c5945fb8f9a6dae59f8d0190b59 | ea70a4fe7710eb225fc21394957e5553b8b1ce0c2787091f0e71525bec83086b |
| population-176.save.json | 35444249117a641983a2c6b02c4195168cc0827f281d1b3f1dbab4f30d084d3e | 3f2d6a631ad4fe2aff8cf24b45ebd8368be2b1d79ed442c424470c3a24319d73 |
| palisade-construction.save.json | 984e5dccf7821bc4b5723e7a029f10e44ba97830d8d649d7ce4f0f73a52c1fe4 | 57bacacca8a58adc86fea1504f380edeb9b2dc86a129e9b6672cf19c7704c2b3 |
| timber-shortage.save.json | 983cc8ec99f6ee6e188776b248c1507ff5335135e3d5d2c1e655f1505fd783f6 | 908441f2571ec46fdf152eaa6a3dbb0a0abf2fa5337c92099fd2881144175efa |
| zoned-opening.save.json | 8ee600ff3207785f8fbb0294e355039e2efb6d9197221d8bec436d088e2894fe | d0aeb7d34624453c16e92293556f237b05cc00c4fc7ebd1167da2524390c73e5 |
| ledger-rollup.save.json | 6c22ed1002a402f94dc5d33ecb6de8d53a3da580d14b21c52c5421761a6a452e | 5539cf072cd05bdfdb88dbba70270b7fa8ecff00d4fd69cb604db88f87e89cee |
| money-arrears.save.json | dc032bc6da19634d52487bd7d0ed05e32a44e5e0ced23cbb0efceef807e6d736 | 346c1f94473a1ed12fc6db6d91b6dc165f29f94ac580d6f075e600b49278ec9c |
| zone-undo.save.json | dc021a614964ddb29c92528fc4c84f22abcd23ab34d9082c9c711583d538e86d | efe5401dc672ecd06ffc9a1fc89156d8c37d91f1f2726b83a9af074b72c18787 |
| four-farms.save.json | b0f3e4cf88aed91a911a44f0d99d3a620386aabe08a8ae1b8fd23d231455b7b8 | 7947403c4488fcac418e4d4a916c12bfccda716105a913caa112c51acd373f7f |
| chapter-four-town.save.json | 1b3673d52acd4d3e07780dd2c4b37af30bd7dd61f26d49de0e0b9c421bbf95ca | 26b20c9cfc84598c000b2a7d2c50bc1681eff4824594887a97232c600a1bcce4 |
| chapter-five-town.save.json | e32050b4fc45737cfbc81163e616f7eb4006da947035aeec762f66738457c8f9 | f09d4f59064469dafb7538ea8e0010c844554416a55bd1c9ddd1c3f5fe2b0a13 |
| chapter-two-town.save.json | 42321fdec2a9706a8636f27fd5067bb731f07fce4a52c14d6174d7226f9acfbe | 45f15b632abcc5a67bb86a802bc86b6d5493b75296f5d1281d085e250b195b0e |
| chapter-three-town.save.json | 91d073bafc5e127c79709cc249208a6576641e334028056b5b9495d2da5250bf | b06ad50ca45bcc92697a79147d43b0342c35c35a813919cc467b76c25a873a76 |

`eb-tlink-estate-relation-consumed.save.json` starts from the pending fixture and runs the real first-next-season domain path at tick 2000: `advanceStewardship` → `advanceHistory` → `advanceTrace`. Actual answer `h-000002` is linked on the already allocated `stewardship.season` record `h-000003`; tenants remain 4, with retained prior-answer contribution +4. This is prepared transition evidence, not natural play. The record ID was checked against the pre-trace history and the entire state passed official encode/decode equality. SHA256: 8d09ef0265b0f823cbae40bb5222701d33397da6a1e04d44213abf24b802cf3c.
