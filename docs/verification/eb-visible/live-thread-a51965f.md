관문: 실패 — DGX `engineB-live-thread-a51965f` exit **1**, `valid: false`; 자동 표시와 수동 추적 연결의 완료 증거 없음.

2026-10-09 완료한 제한된 후속 실험의 종료 기록이다. 원본 결과를 보존하며, 이 실패를 다른 검증이나 전체 게시의 차단 판정으로 확대하지 않는다.

## 실행과 출처

- 실행 위치: DGX `aitopatom-d6bb`, unit `fls-run-engineB-live-thread-a51965f-1791522045`; 원격 보존 경로 `/home/hyunlord/fls-runs/_kept/engineB-live-thread-a51965f/.remote/`. 실행기 로그는 clean checkout (`dirty=0`)과 exit 1을 기록했다. 부모 세션은 unit inactive를 별도 확인했다.
- 로컬 원본: `/tmp/engineB-live-thread-c5/.remote-runs/engineB-live-thread-a51965f/` (이 문서는 결과 복사본이나 새 실행이 아니다).
- 브라우저/도구 revision: `a51965fa5688453f7d719b317c27acbf4158a6a4`; 제품 기준 `c5d2b35341dfb9c1a496d3f7bda532bf7e2d4fb8`와 `src`, `package.json`, `package-lock.json` 차이 없음을 읽기 전용 재확인했다.
- 원래 저장 생성 revision: `2485af40046793f1856829fa1161dc4431942aa7`. seed 1 `ck_evt_005-answer-h-002653.save.json.gz`, tick 40015, 108421 bytes. gzip SHA-256 `7c01f32f3e48e5cd18229838c322385cb6b48edc6247b5027f19e287b1b31b16`; encoded-save SHA-256 `ce8a2f7c975bf400f9a4da910356837c832943041fb64dc64b8984f88c056b1c`.
- 원본 checkpoint manifest SHA-256 `e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d`; 선행 historical manifest pin `91bdcf3dd03e9e9d36b2bb06d138c90d29e386877ac9830ea47f0604363b2cfc` (실행 wrapper의 선행 검사).
- Node v24.21.0, Playwright 1.62.1, Chromium `chromium-1234/chrome-linux/chrome`; sync 23.4s, prepare 12.0s, queue 2965.7s, command 45.6s.

## 관찰과 종료 조건

정상 UI handler에 synthetic DOM click으로 환영 화면을 닫고 fast를 두 번 눌렀다. `tenSelected=true`, `progressAtTen=true`; 가상 시계 16ms 간격의 616개 표본에서 tick 40015 → 41000으로 진행했다. 봇 없는 새 continuation이며 원래 125년 실행과의 재현 동등성 증거가 아니다. 초기 presentation 비교는 differingPaths=0, serializationOnly=true였다. proof는 raw browser store가 아닌 presentation을 노출한다.

마지막 표본은 `paused=false`, `ten=true`, 패널 하나 `season-ledger-card`, season `1310:0`, `continueCount=1`, `continueAvailable=true`였다. 패널은 `isInformationalSeasonLedger`의 구조 조건을 만족하지만 capture의 **`observation.paused && isInformationalSeasonLedger(observation.panels)`** 조건(`scripts/engineBLiveSpeedCapture.mjs:173`)에는 들어가지 않았다. 이후 panels.length 조건(:186)이 `intervention_required_unknown_or_substantive_blocker`로 종료했다. informationalContinues는 비어 있다. 이 paused 값은 pause seal의 aria-pressed 관찰값(:76)이다. 이것만으로 결산 중 실제 시뮬레이션이 계속 진행했거나 결산 자체가 실질적 선택을 요구한다고 판정할 수 없다. 이번 중단은 도구의 정보성 패널 인식 조건과 관찰값 불일치까지 확인된 것이다.

- 실제 새 receipt `h-002663`(40800)는 answer `h-002653`에 `payment_flow`, **part=true**로 연결된다. 생성 사실과 기여 원인 연결은 확인되지만 독점 원인이나 화면 표시 증거가 아니다.
- `receiptEvidence.automaticVisible=false`, `automaticPresentations=[]`; `threadEvidence.automaticThreadVisible=false`, `threadPresentations=[]`. 초기 `trace:h-002653:40` chip/관계 −2는 이미 답변 직후 존재한 표시로, 나중 receipt의 직접 표시나 canonical thread membership을 대신하지 않는다.
- `manualDiscovery={attempted:false,verified:false}`. 이번 실행으로 수동 발견 가능/불가능을 판정하지 않는다. exact receipt 또는 canonical thread identity가 인정되기 전에 중단했으므로 후속 탐색이 실행되지 않았다.
- errors와 cleanupErrors는 모두 빈 배열이다. 예외가 없다는 뜻이며 관문 통과는 아니다. native pointer, 실제 시간 성능, 화면 전체의 시각 품질은 검증하지 않았다.

## SHA-256 재확인

아래는 로컬 retained bytes의 SHA-256이다. 두 도구 파일은 pinned git blob과도 대조했다. 원본 증거는 수정하지 않았다.

| 파일 | SHA-256 |
|---|---|
| `scripts/engineBLiveSpeedCapture.mjs` | `6076aae3d5d06826fa5afe12910a033f4a099da02ed09d1212d63c82868a69c9` |
| `scripts/engineBLiveThreadEvidence.mjs` | `e2a88d979c93e2f320b6142a5510cb0a651180c6ae108c0e72acc6294634b20c` |
| `command wrapper (main .omo/evidence/eb-live-thread-command.sh)` | `bea271fd4721dda68b6b3aee9f21c66580a5159c85372741c5455b33f51057bc` |
| `eb-live-speed/manifest.json` | `a8f9164f5294eb27bf8695f62ad7e7f38e4b249f6b7dfa81bce23e8316c1d8c1` |
| `eb-live-speed/final.json` | `e02395561f63484e597288a9869dc02c6dc66919c34aa989eb2480537b622c11` |
| `run.log` | `60f6554651d444e85260956462288f19960f6ad0b78b0a50299867098d033667` |
| `exit-code` | `4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865` |
| `timing.env` | `beaba2837343347bbfc6cb4db720fdd9fc5bba0420f9aebcaeb3d24eaff6c6a8` |

manifest가 기록한 Playwright shim/core/package SHA-256은 각각 `01525ebd1843067aa50f926aabc66c81a1b7043d0e9f842a004bff56691a5baf`, `3d36e2132d3c8b62397d23f0bb4177336aaee503203ae2a2c90fbeb5bf3317dd`, `07c47543631fef9508760365dee9fbe958c562093ec8d122543949ed231f233f`다. 이 원격 도구 바이트는 이번 문서 작성에서 다시 가져오지 않았다.

원칙 점검: A4·A5는 receipt 생성/연결과 표시를 구분했고, A7·과장 금지는 part=true 및 미검증 탐색을 명시했다. 이 작업은 Mac에서 결과·소스·해시를 읽고 문서 한 개만 작성했다. 시뮬레이션, 브라우저 재실행, UI/도구 수정, 커밋은 하지 않았다.
