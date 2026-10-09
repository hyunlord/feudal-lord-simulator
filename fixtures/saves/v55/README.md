# v55 standard migrated save fixtures

현재 분기 전용 provisional v55 fixture입니다. GROW v55와 충돌하므로 통합 시 migration과 함께 조정해야 합니다. 기존 v54 원본은 수정하지 않았습니다. 별도 EB-TLINK own-answer fixture와 그 설명은 그대로 보존합니다.

생성 소스: `eba2bbcb2e94d6076fe0e874512851b10fc8ebfe`. 명령: `node --import tsx scripts/buildSaveFixtures.ts --from-version 54`. 기존 generator의 decodeSave → encodeSave 경로로 v54 manifest의 13개 상태를 재인코딩했습니다. 새 성장 실행이나 엔진 tick 진행은 하지 않았습니다. 타임스탬프는 generator 고정값 2026-09-24T00:00:00.000Z입니다.

검증: 모든 입력 SHA가 manifest와 일치, 출력 크기 일치, official decode 후 전체 state deep equality, schema55, 동일 encode의 바이트 SHA 일치. 과거 상태의 trace.answers는 없는 상태로 유지하며 답변을 역산하지 않습니다.

현재 버전 참조 테스트의 chapter-two-town / chapter-four-town / chapter-five-town / new-game / population-176 / zone-undo와 manifest를 쓰는 표준 fixture 소비자를 위해 원본 manifest 전체를 유지합니다.

| 파일 | v54 SHA256 | v55 SHA256 | tick |
|---|---|---|---|
| new-game.save.json | ac3f489bac168954330e03ff074172a78bb7621158ea61cab200a2ed23dff875 | 83be7eab55833a01f53e50adbcd12181ab245c5945fb8f9a6dae59f8d0190b59 | 0 |
| population-176.save.json | d42e61a2360f13690b941830005f8ffb8d0fcfc0fc1b9bdc1fe48f22f04566cc | 35444249117a641983a2c6b02c4195168cc0827f281d1b3f1dbab4f30d084d3e | 27471 |
| palisade-construction.save.json | 1f95e9b7438ab009e382186e136dfe41774662f42503dd1e5d495d4bb068fba4 | 984e5dccf7821bc4b5723e7a029f10e44ba97830d8d649d7ce4f0f73a52c1fe4 | 90976 |
| timber-shortage.save.json | 666e2fa3ebcb7257eff8496040ac421939172f7096121c1e2e63915f338ca835 | 983cc8ec99f6ee6e188776b248c1507ff5335135e3d5d2c1e655f1505fd783f6 | 92684 |
| zoned-opening.save.json | aa757aa129f0718b253c81fd6b1c38ff66bd09376222d34ec6f709bbd8504717 | 8ee600ff3207785f8fbb0294e355039e2efb6d9197221d8bec436d088e2894fe | 0 |
| ledger-rollup.save.json | 983c2219f3cf560ed589fbc10922f06bcf812066f94fc19a40cf644016d40ba9 | 6c22ed1002a402f94dc5d33ecb6de8d53a3da580d14b21c52c5421761a6a452e | 20480 |
| money-arrears.save.json | 74d4cdd4d8bd46cb1e6c8ee248b0aa5ad4375632413a290d6903fc58a20d83de | dc032bc6da19634d52487bd7d0ed05e32a44e5e0ced23cbb0efceef807e6d736 | 2400 |
| zone-undo.save.json | 284179c993782548f1dc606204255614a97b530a5856f91af7a77c671621443e | dc021a614964ddb29c92528fc4c84f22abcd23ab34d9082c9c711583d538e86d | 0 |
| four-farms.save.json | 391b9b6aa66e446121cc8801617d9ebc74f2ed2378c3bba3a297a74d0cc13ad1 | b0f3e4cf88aed91a911a44f0d99d3a620386aabe08a8ae1b8fd23d231455b7b8 | 15162 |
| chapter-four-town.save.json | 7119421cde2169e0623149a4c12159d2ca81ba8c71d2468246772020ebf2b9d4 | 1b3673d52acd4d3e07780dd2c4b37af30bd7dd61f26d49de0e0b9c421bbf95ca | 275340 |
| chapter-five-town.save.json | 53e0b5e2221357216674fb771006d0bfdadecc6f16181bd25ca5c001ec0f4cdc | e32050b4fc45737cfbc81163e616f7eb4006da947035aeec762f66738457c8f9 | 329000 |
| chapter-two-town.save.json | 5f167f109ce2bc63cc119be63fd902c9fd4a054d47dc168450021610bb5d2313 | 42321fdec2a9706a8636f27fd5067bb731f07fce4a52c14d6174d7226f9acfbe | 77500 |
| chapter-three-town.save.json | 45d38812725c5afc37a64185e084f171d81da05feff615aa0c1c39595ef79c9b | 91d073bafc5e127c79709cc249208a6576641e334028056b5b9495d2da5250bf | 160000 |

검증 실행: `node --import tsx --test tests/humanPathChapterFive.test.ts tests/humanPathLawsuit.test.ts tests/qa032ChapterPage.test.ts tests/qaRounds0314.test.ts tests/lineage.test.ts tests/in18Hud.test.ts` — 26/26 PASS (약 13.4초). `git diff --check` PASS. tests/nat1Props.test.ts와 tests/serviceMeasure.test.ts 역시 표준 chapter-four/two 파일을 참조하며 해당 파일을 포함했습니다. 전체 save-fixture 순회/장기 관측은 실행하지 않았습니다.

추가 지정 소비자 검증: `node --import tsx --test tests/nat1Props.test.ts tests/serviceMeasure.test.ts` — 모두 PASS. 위 `in18Hud.test.ts`를 포함한 최초 실행과 분리해 실행했으며, 원본 v54와 기존 `eb-tlink-own-answer.save.json`은 변경하지 않았습니다.
