# EB-TLINK: 125년 원본과 재계산

기준판과 **0b04 시제품의 공식125년 수집·재생은 완료**했다. 0b04 점수는 **204/816=25%, pass=false**로 기준판292/816=35.7843%보다 낮다. 세 판 명령 스트림·checkpoint·최종 규칙 투영은 일치하지만 전체 최종 상태 해시는 모두 다르다. 최신 관계 제품 `9ad9253468592e7cba144946081d2fbced36adca`의125년·native는 별도 진행 중이며 이 결과를 승계하지 않는다. 최신 geometry는27행·540조건·실패0·미개방0으로 통과했다. 최신 changed는553파일·4425시험 중4412통과·실패0·skip13,66파일 결과 재사용으로 끝났다. 최신 브라우저의 양방향 이동·저장 검증은 통과했지만390px 오른쪽 잘림은 NEEDS_WORK다([실제 화면 근거](../eb-tlink-relation-browser/README.md)).

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


## 공식 0b04 결과 — 실행 성공과 기준 미달 구분

`engineB-tlink-prototype125-0b04cd0`, source `0b04cd0becc4d73059fbfcf372395c8672d1a381`: seed1–3 각125년 수집·재생 검증 완료, 실행 exit0, command4654.2초(prepare7.9·wait8102.1초). Node `v24.21.0`·Linux·lock 및 도구 핀은 [summary](prototype-0b04-summary.json)에 보존했다. 실행기의 exit0은 점수 승인 결과가 아니다.

| seed | 무거운 답 | 성숙 | 미래 자기 ID 연결 | 관측 부족 | 미연결 |
|---|---:|---:|---:|---:|---:|
| 1 | 245 | 238 | 52 | 7 | 186 |
| 2 | 282 | 275 | 70 | 7 | 205 |
| 3 | 309 | 303 | 82 | 6 | 221 |
| 합계 | 836 | 816 | **204 (25%)** | 20 | 612 |

[원래 점수](prototype-0b04-score.json.gz)는 pass=false, conditional0이며 기존 미분류 선포2건도 남는다. [잔여 판독](prototype-0b04-residuals.json.gz)은 직접204를 제외한632건을 immediate-only-observed433·unexplained179·insufficient-observation20으로 보존했다. 즉시 종결을 미래 성과로 세거나 영수증 부재를 조건 미충족으로 바꾸지 않았다. baseline과 동일한 scorer/분모/12000tick 창을 유지했다.

[전후 비교](prototype-0b04-parity.json.gz)는 세 판 commandStreamEqual/parityEqual/finalProjectionEqual=true, fullFinalHashEqual=false다. 이 전체 상태 해시는125년 producer 산출물 비교이며 별도 native guardrail 결과가 아니다. history와 trace decisions/answers를 제외하는 기존 규칙 투영 범위의 일치이며 모든 tick·전체 상태·별도 native guardrail 동등성을 주장하지 않는다. raw 해시 차이를 정규화해 없애지 않았다. 0b04 native 대기 작업은 실행 전 취소되었고 통과 근거가 없다.

### 원본·압축·재현 경로

- `prototype-0b04-{score,residuals,parity,config}.json.gz`: 실제 도구 입력/출력 JSON 바이트 그대로 gzip. [summary](prototype-0b04-summary.json)의 압축 전후 SHA로 대조한다.
- [휴대 가능한 config](prototype-0b04-config.json): 저장소 상대 경로만 재배치했다. 따라서 configSha256와 이를 포함한 재계산 score/residual byte hash는 원본과 달라진다. 원본 byte 재현에는 압축된 원래 config를 `.omo/evidence/prototype-0b04-config.json`에 복원해야 한다. 경로 변경본의 전체 JSON이 원본과 byte동일하다고 주장하지 않는다.
- `prototype-0b04/seed-{1,2,3}/archive.json`: 원본 각 파일의 크기·SHA와 tar 해시. 기존 `pack-evidence.py`로 모든 구성원을 다시 읽어 검증했다. tar는 `.omo/evidence/packed-prototype-0b04/seed-N/evidence.tar.gz`에만 두었다(1,755,289 / 2,097,506 / 1,622,396 bytes). 합계5,475,191 bytes를 나눠 Git 한도를 우회하지 않는다. 이 보관물에는 작은 index만 포함한다.
- 공식 원본은 `.remote-runs/engineB-tlink-prototype125-0b04cd0/eb-tlink-prototype`와 DGX `~/fls-runs/_kept/engineB-tlink-prototype125-0b04cd0/`에 보존한다. release하지 않는다. 아래 fetch 후 구성원 해시를 index와 대조할 수 있다.
- `prototype-0b04/diagnostics/`: 진단 도구·결과·인계문10개 gzip과 [해시 목록](prototype-0b04/diagnostics/archive.json). 원문은 당시의 provisional/seed2-running 표현을 그대로 보존했다. **공식 완료 후에도 동일25%였음**을 이 README가 갱신하며 과거 문서를 소급해 공식 결과로 바꾸지 않는다. source-derived seed1 관계0(성숙 charter17·audit26)는 관계 수치만의 증명이다. 청원/감사 종결 상태와 후속 제어 효과는 남으므로 전체 명령 무효·80% 불가능·분모 제외를 뜻하지 않는다. 독립 scope_review의 차단 결함 없음은 당시 메시지로 전달된 범위이며 별도 서명된 검토 artifact는 없다.

```sh
scripts/remote/run.sh --fetch engineB-tlink-prototype125-0b04cd0
mkdir -p .remote/eb-tlink-0b04-recomputed
node scripts/engineBOutcomeRun.mjs docs/verification/eb-tlink-outcomes/prototype-0b04-config.json .remote/eb-tlink-0b04-recomputed/score.json
node scripts/engineBTlinkResiduals.mjs docs/verification/eb-tlink-outcomes/prototype-0b04-config.json .remote/eb-tlink-0b04-recomputed/score.json .remote/eb-tlink-0b04-recomputed/residuals.json
node scripts/engineBTlinkCompare.mjs .remote-runs/engineB-tlink-baseline125-cf3fa94/eb-tlink-baseline .remote-runs/engineB-tlink-prototype125-0b04cd0/eb-tlink-prototype .remote/eb-tlink-0b04-recomputed/parity.json
```

scorer exit1은 예상되는 실제 기준 미달이다. 각 명령을 따로 실행하여 잔여 분석을 이어간다. source/도구 hash가 맞는 checkout과 비어 있는 출력 경로를 사용한다. diagnostics는 별도 checkout의 원래 `.omo/evidence` 상대 위치에 풀고 보존된 인계문의 offline 명령을 사용한다. JSON에 남은 작성 머신 절대 경로는 provenance이며 실행 경로 계약으로 강제하지 않는다. 대형 원본·전체 state·이미지는 복제하지 않았다. 최종 보관 크기는 3MB 미만이며 gzip 복원·SHA·모든 링크를 검증했다.


### 즉시 처리 기록의 추가 목록 — 잔여 판정 유지

[즉시 own-ID 목록·재현 핀](prototype-0b04/diagnostics/archive.json)에 `tlink-immediate-own-receipts.{mjs,json,md}.gz` 원본3개를 추가했다. 공식 unexplained179건 중101건에 같은 tick의 정확한 자기 ID 비결정 기록이 있다(감사94·감독3·감사 방식3·실패한038 집행1). 나머지78건에는 그 기록이 없다. 179건 중 정본 `commands:[]` 선택은47건이며005:c 1건을 포함한다. 이는 기록/명령 목록이며 재분류가 아니다. **공식 immediate-only433·unexplained179·관측 부족20과 미래204/816 점수는 그대로다.** 특히 감사 기록에는 auditId/estateId가 없다는 제한을 유지하며 실제 충성도 변화나 미래 효과를 추정하지 않는다. scope_review는 차단 결함 없음을 보고했으나 이 목록을 새로운 효과 증명으로 확대하지 않는다. 별도 checkout에 원래 config/score/residual 및 script 경로를 복원한 뒤 `node .omo/evidence/tlink-immediate-own-receipts.mjs`로 재현한다. 입력·source selector·압축 전후 SHA는 보존된 JSON/해시 목록에 있다.


### 세 판 감사 충성도 fold와 별도9ad 명령 기여 검토

`prototype-0b04/diagnostics/`에 `tlink-audit-loyalty-three-seed.{mjs,json}.gz`와 `tlink-mixed-command-proof.md.gz`의 원본 바이트를 추가했다. [압축 전후 SHA·소스·입력·재현 정보](prototype-0b04/diagnostics/archive.json)를 보존했다. 세 판 감사 잔여94건은 source-derived 충성도 증가27·증가0인67로 나뉘며42명 최종값이 맞았다. **27은 후보 상한이고 실제 미래 효과 입증은0건**이다. 공식 점수·성숙 분모·잔여 범주를 변경하지 않는다. 독립 scope_review는 차단 결함 없음을 보고했다. 스크립트는 고정 출력에 wx를 사용하므로 별도 checkout에 필요한 원본 입력을 복원하고 출력 JSON이 없는 상태에서 `node --import tsx .omo/evidence/tlink-audit-loyalty-three-seed.mjs`로 재현한다. 보존된 원본을 지우거나 덮어쓰지 않는다.

mixed-command 문서는 **9ad 소스의 증명 초안**이며0b04 실행 증거·새 구현·실측 연결률이 아니다. 반대 부호의 후속 명령에 대한 제한적 기여 보존 가능성을 논하지만 아직 적용하거나 성과로 세지 않는다. 같은 진단 폴더에 둔 이유는 인계 편의이며 각 source pin과 범위를 구분했다. 검토 중인 hold-cost 자료는 이번 보관에 포함하지 않았다.


### 강화된 hold-cost 감사 —0b04 범위

`tlink-hold-cost-audit.{mjs,json}.gz`를 [진단 해시 목록](prototype-0b04/diagnostics/archive.json)에 추가했다. 정식 config/score/residual 연결 및 세 판 manifest/raw/context/final-state 핀3/3을 검증하고 faction ID를 포함한 키로 판독한 **0b04 source-derived 결과**다. 전체 commands[] hold60건은 claim17·관계43이며, 공식 unexplained 교집합47건은 판결 후038 claim10·관계37이다. 관계43건은 실제 clamp 적용 후 각각−2였고 faction 최종값27/27이 맞았다. Claim17건의 실제 강도 변화는 미확인이다. 미래 링크47건을 추가로 입증한 것이 아니며 기존 점수·잔여 분류를 바꾸지 않는다. 이 자료는 최신9ad 실측 점수가 아니다.

강화 전 결과는 분석 근거로 추가하지 않았다. 고정 원본 script SHA `44f324ed8c4e81b1a8ce2a01304fd8c55fbe73677899d986c346cb8549677adc`, JSON SHA `8a470755a64ac44ccfe7fda56e7810a367e2e6cca9fb5b42b02bbe9be70838c5`와 source/input 핀을 보존했다. 별도 checkout에 원래 입력 경로를 복원하고 `node .omo/evidence/tlink-hold-cost-audit.mjs`로 재현한다. 생성기는 고정 JSON 출력을 덮어쓰므로 보존 원본 위치에서 실행하지 않는다. `currentHead`는 작성 시점 provenance이며 다른 checkout에서는 해당 메타데이터가 달라질 수 있다.


### 최신9ad 수집 잠정 snapshot — 공식 판정 전

[별도9ad snapshot·입력/소스/재현 핀](collection-9ad9253/archive.json)에 원본 TS/JSON 두 파일을 gzip으로 보존했다. `engineB-tlink-final125-9ad9253`, source `9ad9253468592e7cba144946081d2fbced36adca`의 **수집 시점 잠정값은301/816=36.8873%**(seed1 98/238·seed2 93/275·seed3 110/303)이며 관측 부족20·미연결515·미분류2다. 캡처 시점 replay는 진행 중으로, 종료 코드·정식 scorer·관문 통과를 주장하지 않는다. 앞의0b04 공식 결과와 별도이며 기존 원본/index를 덮어쓰지 않았다.

원본 JSON SHA는 `e19b438325ba8cdee31762d488853407d3436f99b5fa8f8566ca6025ab0b79c8`이다. 별도9ad checkout에 해시가 맞는 raw/context·baseline 비교 입력과 script를 원래 상대 경로로 복원하고 `node --import tsx .omo/evidence/tlink-9ad-three-seed-provisional-links.ts`로 재현한다. 생성기는 wx이므로 고정 출력 JSON이 없는 새 위치에서만 실행한다. 이번 보관에서는 스크립트를 재실행하지 않았다. 전체 그룹은3MB 미만이며 압축 전후 해시를 검증했다.


### 9ad estate 잔여336건 — 최초 무효화 원인은 미관측

[collection-9ad9253 인덱스](collection-9ad9253/archive.json)에 `tlink-9ad-estate-residual-audit.{mjs,json}.gz` 원문을 추가했다. 잠정301/816에서 성숙 미연결 estate 답336건은 관계 변화0인213·부분 clamp4·답변 후 경계 도달3·나중 무효화116으로 나뉜다. 이는 증거 상태 판독이며 **명령 전체 무효과를 뜻하지 않는다.** 나중116건의 최초 무효화 분기는 보존되지 않았고, expected가 내부값인62건은 조사 우선순위일 뿐 입증된 누락 링크62건이 아니다. 이 집합에서 첫 철 이전 반대 부호의 알려진 같은 차원 명령은0건이므로 mixed-command 증명으로 연결률 증가를 주장하지 않는다.

source/input 핀과 재현 명령 `node .omo/evidence/tlink-9ad-estate-residual-audit.mjs`는 인덱스에 있다. 별도 checkout에 입력을 복원해야 하며 고정 출력을 덮어쓰는 생성기를 보존 원본에서 실행하지 않는다. 원본 script SHA는 `b37d57273efb1ed95a7af1b64146dc4c1d6d5b58acaf023159146dc63a36f6ee`, JSON SHA는 `7bab64d3349a719a7bc9588245b9e3643c6c346dbc9d4ebe5d828e448f2b7af2`다. 독립 검토에서 차단 결함은 없었지만 공식 재생·scorer 인수 결과가 아니다. 별도 `engineB-tlink-invalidation-probe-9ad9253`는 인계 시점 제출·대기 중이며 실행/결과를 주장하거나 probe 자료를 보관하지 않았다.
