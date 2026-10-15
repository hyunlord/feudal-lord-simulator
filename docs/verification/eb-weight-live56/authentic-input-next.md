# EB-WEIGHT: 다음 실제 제안 입력의 제한 생산

상태: **도구 준비·구문 검사만 완료. 실제 제안 확보나 화면 관문 통과 아님.** 제품은 `0eddc146c7d57b4cae091bff62295a1fc16e1f97`로 고정한다. 기존 DGX 실행 줄은 바꾸지 않는다. 아래 두 모드는 각각 공식 `heavy` / `experiment` 슬롯에서 한 판씩 순서대로 실행한다.

## 고정 원본과 실행 경로

공통 archive는 `codex/engine-b-tlink:docs/verification/eb-answer-effects/fixtures.tar.xz`, SHA256 `03a010b04a9de48492b4fc0de7c5ec994f3d20d7216e1010c0b12ccf9c5057e4`다. 원래 실행 HEAD를 새로 입증하는 값은 아니다. 원격 raw 파일의 바이트 SHA를 반드시 확인하고 현재 codec 왕복 후 전체 상태가 같아야 입장한다. 원본이 없거나 달라졌으면 복원·필드 보충 없이 오류로 끝낸다.

| 모드 | 원본·raw SHA256 | 정상 경로 | 대상 |
| --- | --- | --- | --- |
| `marriage` | `/home/hyunlord/fls-lord-states/registry-offer.json`, archive `lord/registry-offer.json`; `0ff4d88a516b6b6868529ccc80281a4ea8a4e68c79b5ecf9ac01a024332bb508` | seed1 @13000→18000, `advanceTick`만 | 018·128·131·132·133·139 |
| `small-rights` | `/home/hyunlord/fls-lmr2-states/inherited.json`, archive `lmr2/inherited.json`; `cc9af1c61693d7148b833e71aa285a00a908808935faee4bac20e1f5fd9b3349` | seed1 @52030에 아래 정상 명령 한 번, 이후 @60000까지 `advanceTick`만 | 061·077 |

```json
{"type":"set_exception_rules","rules":{"amountAtLeast":100,"rights":false,"marriage":false}}
```

정상 reducer 진입점은 `src/state/gameStore.ts`의 `set_exception_rules` 분기이며 `setExceptionRules(state, action.rules)`로 이어진다. `src/engine/stewardship.ts`는 같은 규칙이면 무변경, 다른 규칙이면 실제 예외 방침을 변경한다. inherited 원본은 위임·방문 감사와 현직 `est-000006`, 문턱 null·rights=false·marriage=false다. 100d는 명시적인 플레이어 방침 선택이며 원본 조건을 조작한 것이 아니다. 도구는 명령·전후 SHA·답 직후 저장을 보존한다. 봇은 이 정책을 덮을 수 있으므로 호출하지 않는다.

## 생성 출처와 관측 한계

- 혼인 원본은 `scripts/eventArtStates.ts`의 정상 `newGameState(core:lord_slice)` → 봇 명령/reducer → tick 경로에서 실제124 제안을 봇 답변 전에 저장한 것이다. 새 경로에서는 봇도 혼인 명령도 사용하지 않는다. 최초124 및 모든 초기 미답 제안은 `initialOffers`와 `initial-admitted.save.json.gz`에 남기되 새 확보 건수에 넣지 않는다. 현금은46d이며 자연 수입과 실제 연금/필지/부채 조건을 건너뛰지 않는다. 미답 만료와 엔진의 lapse 동작도 그대로 적용한다.
- inherited 원본은 `scripts/lmr2States.ts:68`의 실제 `marriagePath` 상속 뒤 실제 greedy 후보를 `set_estate_oversight`로 임명하고 `set_audit_mode(visit)` 후 한 tick을 진행한 경로다. 현재 읽은 생성 소스 SHA는 `3acc4de6d49e7ba5f8562dc4a2734c17d74d5f142c47677a8462f611cdf901dd`; 원래 실행 HEAD 보증과는 구별한다.
- 작은 권리 맥락은 `registryPetitionContextEstates.ts:16`의 실제 권리·비혼인 청원, 문턱 미만 금액, 청지기 처리 완료, 보유 영지와 생존 재직 청지기를 모두 요구한다. 정책 명령 자체를 그 청원의 발생으로 세지 않는다.
- 매 tick 직후 cohort56의 새 실제 미답 offer를 저장한다. 모든 대상이 확보되거나 정해진 끝 tick에 이르면 멈춘다. 새 제안을 답하지 않는다. 확률·pace·경쟁·실제 조건 때문에 제안이 없으면 `bounded_search_no_target`, 일부만 있으면 그 목록만 보고한다.
- 초기/최종 감사·청원·방침·소송·협상·registry 상태를 보존해 자연 만료나 다른 결과로 조건이 닫힌 경우도 확인할 수 있게 한다. 처리 기록을 실제 결정 효과나 화면 통과로 세지 않는다.

공식 runner에 넘길 명령은 각각 `bash docs/verification/eb-weight-live56/acquire-marriage.sh marriage`와 `bash docs/verification/eb-weight-live56/acquire-marriage.sh small-rights`다. shell을 Mac에서 실행하거나 DGX에서 직접 병렬 제출하지 않는다. 출력은 각각 `.remote/eb-weight-acquire-marriage`와 `.remote/eb-weight-acquire-small-rights`; 기존 출력 디렉터리는 덮어쓰지 않는다.

검증: `node --check acquireMarriage.mjs`, `bash -n acquire-marriage.sh`. 게임·브라우저·DGX 실행은 미실시. 실제 enabled/빈도/성과는 실행 전 미검증으로 유지한다.
