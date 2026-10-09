# EB-TLINK: 125년 원본과 재계산

현재 이 묶음은 **기준판만 완료**했다. 시제품 연결률과 전후 규칙 불변 판정은 아직 없다.

공식 실행 `engineB-tlink-baseline125-cf3fa94`가 seed1·2·3 각각125년(500000틱)을 수집하고 같은 명령을 재생했다. 세 판 모두 재생 일치, 실행 exit0, 명령 시간13416.9초다. 실제 소스는 `cf3fa941659ecb78396eed3780f88024a2bde0dd`, 제품 코드는 승인 기준 `64a16b5a6c1d91024415039db89bb88412528e15`와 같다. 측정 계측만 별도 커밋했다.

| seed | 무거운 답 | 관측 충분 | 직접 연결 | 비율 | 관측 부족 | 미연결 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 245 | 238 | 71 | 29.83% | 7 | 167 |
| 2 | 282 | 275 | 114 | 41.45% | 7 | 161 |
| 3 | 309 | 303 | 107 | 35.31% | 6 | 196 |
| 합계 | 836 | 816 | 292 | **35.7843%** | 20 | 524 |

원래 scorer는 **exit1·pass=false**다. 조건부0이며, 기존 분류기가 놓친 seed2의 선포 답2건도 남아 있다. 보충 판독은 두 실제 BIG 결정 기록을 확인했지만 원래 점수나 분모를 고치지 않는다(보충 분모818, 직접292). 후속 흔적이 없는 답을 조건부로 추정하지 않았다. strict contract 결과도 원본에 그대로 보존한다.

## 보존 내용

- `baseline-summary.json`: 실제 실행·제품 소스, seed별 점수·명령 수·규칙 투영 해시·checkpoint 수, 원본 점수/잔여 판독 파일의 압축 전후 해시.
- `baseline-config.json`: 승인 기대표와 각 원본 archive의 핀을 포함한 재계산 입력.
- `baseline-score.json.gz`, `baseline-residuals.json.gz`: 원래 도구의 정확한 JSON 바이트를 gzip으로 보존. 압축 전 SHA256은 summary에 있다.
- `baseline/seed-N/archive.json`: 원본45파일 전체의 바이트 수·SHA256과 로컬 검증 묶음 해시. 대용량 원본은 보존된 공식 실행과 `.remote-runs/engineB-tlink-baseline125-cf3fa94/eb-tlink-baseline`에 두며 Git에 넣지 않는다. 로컬 압축 묶음은 같은 실행 결과의 `packed-baseline/seed-N/evidence.tar.gz`에 보존했다(1.66MB·1.99MB·1.53MB). 각 묶음을 다시 풀어 모든 구성원 해시를 검사했다. 공식 `--fetch`로 원본 전체를 가져올 수 있고 파일 목록과 내용은 이 인덱스로 대조한다.
- `pack-evidence.py`: 실제 사용한 압축 도구. 기존 출력 디렉터리 덮어쓰기를 거부한다.
- `baseline/tlink-baseline-instrumentation.bundle`: 공개 기준64a가 전제인 측정 커밋cf3의 Git bundle. `git bundle verify` 통과. 제품 변경을 포함하는 별도 기준판이 아니다.

세 seed의 runtime·lock·측정 도구 핀은 같고, 각 판의 collect/replay parity 및 최종 규칙 투영도 서로 일치했다. 이는 **동일 소스 수집/재생 검증**이며 시제품과의 동등성 증거로 바꿔 말하지 않는다. 투영은 명령별·철 경계·최종 상태를 해시하며 모든 tick의 상태를 해시하지 않는다.

## 재계산

저장소 루트에서 보존된 공식 원격 실행의 원본을 config가 가리키는 무시 경로로 가져온다. 기존 재계산 결과를 덮어쓰지 않도록 새 checkout이나 비어 있는 출력 경로를 쓴다. 원격 실행은 `--keep`으로 보존되어 있으며 이 인계가 끝나도 release하지 않는다.

```sh
git bundle verify docs/verification/eb-tlink-outcomes/baseline/tlink-baseline-instrumentation.bundle
git fetch docs/verification/eb-tlink-outcomes/baseline/tlink-baseline-instrumentation.bundle refs/heads/codex/engine-b-tlink-baseline:refs/remotes/eb-tlink-evidence/baseline
scripts/remote/run.sh --fetch engineB-tlink-baseline125-cf3fa94
mkdir -p .remote/eb-tlink-recomputed
node scripts/engineBOutcomeRun.mjs docs/verification/eb-tlink-outcomes/baseline-config.json .remote/eb-tlink-recomputed/baseline-score.json
node scripts/engineBTlinkResiduals.mjs docs/verification/eb-tlink-outcomes/baseline-config.json .remote/eb-tlink-recomputed/baseline-score.json .remote/eb-tlink-recomputed/baseline-residuals.json
```

첫 scorer의 exit1은 기준판이80%에 못 미치는 실제 결과다. 잔여 판독 명령은 그 결과 파일을 사용해 별도로 실행한다. 재계산한 JSON의 SHA256은 `baseline-summary.json`의 `reports`와 같아야 한다. 로컬에서는 이 오프라인 판독만 하며125년 시뮬레이션을 다시 돌리지 않는다.
