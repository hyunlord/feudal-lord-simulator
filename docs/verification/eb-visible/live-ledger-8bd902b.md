관문: 실패 — DGX `engineB-live-ledger-8bd902b` exit **1**, `valid:false`. 계절 결산은 정상적으로 계속했지만, 뒤의 새 결정 카드에서 멈춰 자동 결과 표시와 수동 추적 연결을 완료하지 못했다.

2026-10-09 종료한 제한된 후속 실험이다. 이전 `live-thread-a51965f`의 결산 인식 실패와 구분한다. 원본 증거는 보존했으며, 이번 결과를 전체 게시 차단이나 EB-OUTCOME 전체 결과로 확대하지 않는다.

## 실행·출처

- 실행 위치 DGX; 로컬 retained root `/tmp/engineB-live-thread-c5/.remote-runs/engineB-live-ledger-8bd902b/`, 원격 보존 root `/home/hyunlord/fls-runs/_kept/engineB-live-ledger-8bd902b/.remote/`.
- 브라우저/도구 revision `8bd902bc0f5ed4def2ea74991dd202bf5e267f4e`. 제품 기준 `c5d2b35341dfb9c1a496d3f7bda532bf7e2d4fb8`와 `src`, `package.json`, `package-lock.json` 차이 없음을 문서 작성 시 git diff로 재확인했다.
- 원본 저장 생성 revision `2485af40046793f1856829fa1161dc4431942aa7`. seed1 `ck_evt_005-answer-h-002653.save.json.gz`, tick40015, 108421bytes. gzip SHA-256 `7c01f32f3e48e5cd18229838c322385cb6b48edc6247b5027f19e287b1b31b16`; encoded-save SHA-256 `ce8a2f7c975bf400f9a4da910356837c832943041fb64dc64b8984f88c056b1c`.
- checkpoint manifest pin `e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d`; wrapper가 검사한 선행 historical manifest pin `91bdcf3dd03e9e9d36b2bb06d138c90d29e386877ac9830ea47f0604363b2cfc`.
- Node v24.21.0, Playwright1.62.1, Chromium1234, port4304. sync33.8s·prepare15.8s·queue4248.9s·command46.1s. `exit-code`와 run.log가 모두 종료1을 기록한다.

## 실제 진행과 종료

환영 화면 닫기, fast 두 번, 결산 Continue 한 번을 정상 UI handler의 synthetic DOM click으로 수행했다. `tenSelected=true`, `progressAtTen=true`; 16ms 가상 시계 표본710개로 tick40015→41151을 관측했다. 초기 presentation 비교 differingPaths=0, serializationOnly=true다. 새 봇 없는 continuation이므로 원래125년 실행의 재현 동등성은 주장하지 않는다.

| 표본 | 관측 |
|---|---|
| frame615 / tick41000 | `season-ledger-card`, season1310:0, paused=true, ten=false, Continue 1개·사용 가능 |
| Continue 전후 | presentation SHA가 모두 `e02395561f63484e597288a9869dc02c6dc66919c34aa989eb2480537b622c11`; 같은 tick에서 결산을 닫음 |
| frame616 / tick41002 | panels=[], paused=false, ten=true로 재개 |
| frame709 / tick41151 | `story-modal petition-card decision-card lord-card`, **옆 시장으로 향하는 수레**, paused=true, ten=false; season=null, Continue 없음 |

마지막 패널은 시장 좌판세 인하/인상/장려금 선택을 담은 새 결정 카드다. 도구는 답변하지 않고 `intervention_required_unknown_or_substantive_blocker`로 종료했다. 이전처럼 결산을 인식하지 못한 중단은 아니다. 이번 기록은 새 결정 개입을 요구하는 화면에서 관측을 중단했다는 뜻이며, 그 이후의 자동 표시 가능/불가능은 확인하지 않았다.

## receipt·표시·탐색의 구분

- 새 receipt `h-002663`(tick40800)의 because는 answer `h-002653`, key=`payment_flow`, **part=true**다. 실제 기여 연결을 확인했지만 단독·주원인으로 부풀리지 않는다.
- `receiptEvidence.automaticVisible=false`, automaticPresentations=[]; `threadEvidence.automaticThreadVisible=false`, threadPresentations=[]. 초기 `trace:h-002653:40` chip은 이미 존재한 답변 직후 표시로, 새 receipt의 직접 표시나 canonical thread membership 증거를 대신하지 않는다.
- `manualDiscovery.attempted=false`, verified=false. 자동 receipt/thread identity가 인정되지 않아 수동 탐색 단계에 도달하지 못했다. 수동 탐색이 불가능하다는 판정도 아니다.
- errors=[]·cleanupErrors=[]지만 valid=false다. 예외 부재와 목표 달성은 다르다. proof는 raw browser store가 아닌 presentation이며, Continue 전후 같은 SHA는 그 범위의 비교다. native pointer·실시간 성능·화면 전수 시각 품질은 미검증이다.

## SHA-256

retained 파일은 문서 작성 시 직접 해시했다. 도구 세 파일은 해당 revision의 git blob을 해시했다. 원격 Playwright 해시는 manifest 기록이며 이번에 다시 가져오지 않았다.

| 자료 | SHA-256 |
|---|---|
| `eb-live-speed/manifest.json` | `3f8c28845ed778a0bf216c9323fa37d16aa3087bed0e9719a5fefa55bcc715ee` |
| `eb-live-speed/final.json` | `1257f5d44b231365d4357ac8c073f31329ab6f5c171f6402cb81b823166719d9` |
| `eb-live-speed/transition-5.json` | `1257f5d44b231365d4357ac8c073f31329ab6f5c171f6402cb81b823166719d9` |
| `eb-live-speed/information-1-before.json` | `e02395561f63484e597288a9869dc02c6dc66919c34aa989eb2480537b622c11` |
| `eb-live-speed/information-1-after.json` | `e02395561f63484e597288a9869dc02c6dc66919c34aa989eb2480537b622c11` |
| `run.log` | `0cd631669278c1d4b4672c64cf1ca016899654c745b3d795dc79f1dc01a7797d` |
| `exit-code` | `4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865` |
| `timing.env` | `980dda93ec7e8f6f6ed10c05d0ea6b411e34055548d8e88e84798f699a455d9c` |
| `scripts/engineBLiveSpeedCapture.mjs` | `0c4410a03a5b887c91cc83cd8c88a110f03307f0a21b0e9bd8c6cc97060ea9db` |
| `scripts/engineBLiveThreadEvidence.mjs` | `e2a88d979c93e2f320b6142a5510cb0a651180c6ae108c0e72acc6294634b20c` |
| `scripts/engineBLiveThreadRun.sh` | `aea3177c9e5aa68606f269f15a2b57d8f34c343dd99534a761092afc6adba9a9` |
| Playwright `moduleSha256` (manifest 기록) | `01525ebd1843067aa50f926aabc66c81a1b7043d0e9f842a004bff56691a5baf` |
| Playwright `coreSha256` (manifest 기록) | `3d36e2132d3c8b62397d23f0bb4177336aaee503203ae2a2c90fbeb5bf3317dd` |
| Playwright `packageSha256` (manifest 기록) | `07c47543631fef9508760365dee9fbe958c562093ec8d122543949ed231f233f` |

원칙 점검: 기록된 결과와 표시·발견을 구분하고 기여 관계(part=true)를 보존한다. 이번 작업은 Mac의 읽기 전용 증거 검토와 이 문서 작성뿐이다. 재실행·수정·새 실험·커밋은 하지 않았다.
