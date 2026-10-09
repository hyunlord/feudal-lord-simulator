# 125년 실제 답변→결과 관문

이 관문은 **성숙한 실제 무거운 영주 답변 중, 자기 답변 history ID를 가리키는 후속 기록이 3년 안에 있는 비율 ≥80%**를 검사한다. 기존 원본 세 판의 **292/816=35.7843%**와 같은 식이다. 전체 답변836·관측 창 부족20·고정 trace 분류표 밖 명령2를 숨기지 않는다. root 묶음의 비율이나 추정 멤버십으로 분자를 늘리지 않는다.

`check:merge`에는 연결하지 않은 독립 관문이다. UI 표시·가독성·자동 가시성·게임 효과 유무를 이 관문만으로 판정하지 않는다.

## 운영 경로

새 생산기는 이 저장소의 `engineBOutcomeProduce.ts`와 함께 게시되는 수집기·분류기만 사용한다. 옛 작업 트리의 미게시 answer-replay 도구는 필요하지 않다. 기본125년이며 임의의 양의 seed를 받는다. 현재 깨끗한 커밋·Node·lock·생산기 해시·제품 소스 파일 해시를 기록하고, 현재 `decisionTrace.COMMAND_KIND`와 분류기의 정적 사본이 AST 기준으로 같은지 실행 전에 검사한다. 특정 과거 revision을 하드코딩하지 않는다. AST 파서는 저장소의 기존 `tools/eslint` TypeScript를 사용하므로 해당 lockfile 설치가 필요하다.

공식 DGX 실행기에서만 장기 수집한다. **아래는 향후 운영 명령이며 이 문서 작성 중 새125년 실행은 하지 않았다.** 커밋을 마친 깨끗한 트리에서 유일한 label/output을 쓴다.

```sh
scripts/remote/run.sh EB-OUTCOME-125 --heavy --experiment --keep -- bash -lc '
  set -euo pipefail
  npm --prefix tools/eslint ci --no-audit --no-fund --loglevel=error
  for seed in 1 2 3; do
    npx tsx scripts/engineBOutcomeProduce.ts "$seed" .remote/eb-outcome
  done
'
```

각 seed에 기존 LordBot 명령→reducer→tick 순서로 두 판을 실행한다. 첫 판과 재현 판의 전체 보관 archive JSON·시도 명령 스트림·수집 문맥·최종 전체 상태를 비교한다. 모든 명령 시도와 매 틱을 관측하고, pruning이 decision ID를 ledger에 재사용해도 원래 답변 기록을 보존한다. **중간 전체 상태를 매 틱 비교한 증거는 아니다.** `browserEligible:false`이며 브라우저 체크포인트 증명도 아니다. 실패하면 기존 출력과 `failure.json`을 보존하고 유효 manifest를 내지 않는다. output에는 새 `seed-N` 폴더가 필요하다.

출력은 `seed-N.json` 원본 archive와 `seed-N/{manifest,validity,answer-classification,pins}.json`, 원본/재현 문맥 및 최종 상태 gzip이다. 짧은 배선 확인만 필요하면 마지막 인수로 `1`년을 명시할 수 있다. 이 자료는125년 scorer가 거부하며 장기 통과 증거로 사용하지 않는다. 짧은 DGX probe의 자원 등급은 저장소 원격 실행 규칙을 따른다.

실행기 terminal/fetch 이후 내려받은 데이터 디렉터리에서 설정을 만들고, 순수 파일 판정을 한다.

```sh
node scripts/engineBOutcomeRun.mjs --prepare DATA_DIR docs/design/engine-B-outcomes.json NEW_CONFIG.json 1,2,3
node scripts/engineBOutcomeRun.mjs NEW_CONFIG.json NEW_REPORT.json
```

`--prepare`는 실제 manifest/validity/raw/분류를 검증한 뒤 생산기의 pins와 대조한다. 설정 경로는 설정 파일에 상대적이다. 설정·결과는 기존 파일을 덮어쓰지 않는다. 판정이 미달이면 보고서를 남기고 종료1, 통과면 종료0이다. 입력 해시·구조·출처가 틀리면 거부한다. 외부 terminal receipt와 실제 커밋 확인은 실행 운영자가 별도로 보존한다. SHA와 자체 validity 파일만으로 신뢰할 수 없는 제작자를 인증하는 것은 아니다.

## 입력 계약과 과거 archive

새 형식은 `outcome-replay-v1`; 기존 answer-replay 형식은 명시적으로 `answer-replay-v1`이다. 후자는 browserEligible 및 기존 두 observer 파일만 허용하는 provenance 계약을 그대로 검증하며, 허용된 파일도 manifest tool SHA가 있어야 한다. 새 형식은 깨끗한 소스와 재현 완료가 필요하고 브라우저 적격을 주장하지 않는다.

기존 archive 디렉터리가 서로 나뉘었을 때의 설정 구조:

```json
{
  "schemaVersion": 1,
  "replayFormat": "answer-replay-v1",
  "seeds": [1, 2, 3],
  "replayDirectory": "relative/path/to/replay",
  "rawDirectory": "relative/path/to/raw",
  "contractFile": "relative/path/to/engine-B-outcomes.json",
  "contractSha256": "실제 계약 파일 SHA256",
  "ticksPerSeason": 1000,
  "horizonTicks": 12000,
  "replayPins": [
    {"seed": 1, "manifestSha256": "검증된 원문 SHA256", "rawSha256": "검증된 원문 SHA256"},
    {"seed": 2, "manifestSha256": "검증된 원문 SHA256", "rawSha256": "검증된 원문 SHA256"},
    {"seed": 3, "manifestSha256": "검증된 원문 SHA256", "rawSha256": "검증된 원문 SHA256"}
  ]
}
```

설정 seed와 내부 seed가 같아야 한다. 세 판은 engine revision·Node·dependency lock·생산 도구가 같아야 한다. 명령 ordinal은1..commandCount 전부 필요하고 중복 ordinal/history ID는 거부한다. raw의 `params.command`가 있는 decision을 분류에서 빼는 것도 거부한다. registry 답변은 정확한 subject occurrence·settlement tick·entry/choice를 결합한다. 입력 source는 특정 역사 revision에 고정하지 않는다.

[보존된 기존 세 판](../eb-weight/answer-replay-92bbc7d/README.md)의 실제 raw/replay 파일을 위 CLI로 읽은 결과는 direct292, conditional0, insufficient-observation20, unlinked524, 성숙 분모816이었다. 비registry 답변도 모두 포함했다. 원래 archive와35.8% 기준은 변경하지 않았다. 전체 출력은 각836답변의 seed/ordinal/tick/history ID, 정확한 후속 ID/tick, 자체 root 및 **추정일 뿐인** 다른 root 후보를 보존한다.

## 분류와 분모

- `direct`: 성숙 답변이며 `answer.tick < result.tick <= answer.tick + 12철`에 decision이 아닌 실제 history의 because가 정확한 answer ID를 이름으로 갖는다. because의 순서와 대상 검증은 이 기존 지표에 추가하지 않는다.
- `conditional`: 성숙 답변에 직접 후속이 없고, 소스 호환 계약의 실행 가능한 matcher가 실제 archive 값으로 조건 불충족을 확인한 경우다. 자연어 조건을 추측해 참/거짓으로 만들지 않는다. 분모에서 제외하지 않는다.
- `insufficient-observation`: `answer.tick + 12철 > endTick`. 창 끝까지 못 보았으므로 실패라고 세지 않는다. 이미 발견한 직접 후속도 행에 유지하되 성숙 분자에는 넣지 않는다.
- `unlinked`: 나머지 성숙 답변. ‘게임 효과가 없었다’는 뜻이 아니다.

네 개수는 상호 배타적이며 전체 무거운 답변 수와 합이 같아야 한다. `legacyDirectRatio.denominator = direct + conditional + unlinked`, numerator는direct다. 정확히80%는 정수식 `numerator*5 >= denominator*4`로 통과한다. 분모0은 통과하지 않는다. 두 미분류 선언처럼 중량을 확정하지 못한 명령은 별도 목록·coverage 공백으로 남기고 전체 `pass`를 막는다. 이미 계산된 범위의 thresholdMet와 이 coverage 판정을 구분한다.

동일 틱 링크는 `sameTickOwnLinks`로 따로 기록하며 기존 미래 비율에 더하지 않는다. decision.card 자체는 결과 증거가 아니다. 실제 즉시 상태 변화의 전후 비교나 표시 계약 충족을 이 목록으로 대신하지 않는다.

## 별도 엄격 감사

`strictContractDirectRatio`는 같은 성숙 분모를 쓴다. 계약의 구체적 template/key·실제 대상·조건과 정확한 첫 because를 추가로 확인한다. `part:true`는 첫 원인의 자격을 없애지 않는다. 첫 because는 엔진의 순서상 주원인 표기이지 독립적인 인과 충분성 증명은 아니다. strict 결과는 기본80%를 대체하지 않는다.

계약 sourceFiles SHA가 생산기의 제품 파일 SHA와 전부 같으면 문서/도구만 달라진 커밋도 호환된다. 제품 파일 pins가 없는 과거 자료는 sourceRevision 일치만 사용할 수 있다. 불일치는 strict 감사에만 남기며 기존 own-ID 비율을 바꾸지 않는다.

현재56/163 계약은 상태 경로와 조건을 기술하지만 자동 증거 matcher를 꾸며 넣지 않았다. 현재 자료에서는 strict0/816가 **입증된 엄격 성공0**이라는 뜻이지 효과 없는816건이라는 뜻이 아니다. 계약이 있는198답변 중 조건부 기대를 포함한180답변, 그중 primary unlinked32답변은 별도 metadata다. 혼합 선택의 즉시 정산을 무시하고 선택 전체를 ‘조건부’로 낮추지 않는다. `conditionalExpectations[].conditionEvidence:unknown`은 조건의 참/거짓 관측이 아니다.

향후 소스 검토를 거친 outcome에 다음 선택적 `evidenceMatcher`를 추가할 수 있다. 임의의 성공 boolean을 입력받지 않고, 원본 decision/occurrence/result 필드를 읽어 비교한다.

```json
{
  "answerTarget": {"record": "occurrence", "path": ["bound", "estate"]},
  "resultTarget": {"path": ["params", "target"], "alternatives": [["params", "faction"]]},
  "resultKey": {"record": "ownCause", "path": ["key"]},
  "conditions": [{"record": "result", "path": ["params", "eligible"], "equals": true}]
}
```

이는 DSL 모양 예시이며 특정 사건의 실제 field 매핑이라고 주장하지 않는다. `resultKey` 생략 시 `result.params.key`; `ownCause`는 해당 답변 ID의 실제 because다. faction.act처럼 params.key가 없는 형식을 명시적으로 다룬다. target path와 조건 값은 source-reviewed 계약에서 지정해야 한다. 필드 부재/null 대상·자연어 조건·null 자연 발생 기한·즉시 상태-only 계약은 이 sparse-history matcher로 입증하지 않는다. 표시 기한 `displayExpectation`은 별도 UI 검증 대상이다.

## 검증 범위

집중 시험은 정확한80 경계, +12000/+12001, 같은 틱, tail의 발견/미발견, 조건 불충족/미상, root-only 링크, 첫 원인의 part:true, 잘못된 대상·출처·중복·누락, 다른 seed 디렉터리, 해시 불일치, 출력 덮어쓰기 거부를 다룬다. 수집기 시험은 실제 작은 reducer 사례에서 병합 답변별 무게와 동적 장 청원 문맥, 수집의 비변경성, pruning ID 재사용, taxonomy drift를 검사한다. 새 생산기의125년 DGX 통합 실행이나 실제 화면 통과를 이 단위 시험으로 주장하지 않는다.
