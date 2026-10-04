# 정본 독립 검수: 001–130

검수자는 병합 담당자와 독립적으로 원본 A/B 및 shard 결과를 읽었다. 저장소 코드·자료와 타인의 shard를 수정하지 않았다. 실제 등록·게임 실행 검증은 수행하지 않았다.

## 발견 사항

### IR-01 — 높음: 소송 후보를 먼저 하나 고른 뒤 가용성을 검사하여 후순위 유효 소송을 잃음

- 대상: ck_evt_009·032·033·053. JSON 경로: `registry.entries[id].bindings.suit.where`, `.bindings.suit.select`, `.bindings.claim.where`, `.conditions.any`(마지막 any 절).
- 현재 `bindings.suit`는 원고 lord 및 filed/evidence 단계만 거르고 ID 순서의 `first`를 고른다. 선택 가능한 미제출 증거·비용 검사는 그 후에 한다.
- 재현 가능한 반례: suit-a와 suit-b가 둘 다 열려 있고 금고가 충분하다. suit-a에는 해당 카드의 모든 증거가 이미 제출되어 있으며 suit-b에는 미제출 증거가 있다. 현재 명세는 suit-a를 고른 뒤 카드 전체를 차단한다. B가 원한 '열린 소송의 가용한 증거 상시 후보'는 suit-b에서 충족되지만 탐색하지 않는다.
- 원인: A의 first 바인딩 구조가 B의 개별 가용성·상시 후보 편집과 합쳐지면서 남은 후보 선택 문제. 단순 문구나 JSON Schema 검증으로 발견할 수 없는 의미 차이이다.
- 권고: suit/claim을 연결한 후보 묶음마다 선택 가용성을 검사한 뒤 안정적인 순서로 첫 유효 묶음을 고르는 계약을 정한다. 지원되지 않으면 미결 사항에 명시하고 현재 미설치·차단 상태를 유지한다. 중앙 dedup 계약과는 별개다.

### IR-02 — 중간: 013의 살아 있는 후임 바인딩과 실제 감사 명령의 후임 선택이 분리됨

- JSON 경로: `ck_evt_013.registry.bindings.successor`, `.choices[id=a|c].commands[0].args`.
- 바인딩은 `ESTATE_PERSON_ALIVE === true`인 후임을 골라 보증한다. 그러나 punish/replace 명령에 `replacementId`가 없다. 052에서는 같은 인수를 명시하여 바인딩과 실행을 연결한다.
- 근거: `src/engine/stewardship.ts:489–492`의 실제 `answerAudit`는 명시 replacementId가 없으면 status가 dismissed/dead가 아닌 후보 전체에서 능력 우선으로 고른다. 해당 fallback에는 person.alive 검사가 없다.
- 따라서 살아 있는 후임이 따로 있어도 높은 능력의 status/person 불일치 기록이 있으면 명령은 바인딩된 후임과 다른 사람을 택할 수 있다. 일상 엔진 상태에서 그런 불일치가 발생한다고 실측한 것은 아니며, A에서 물려받은 계약의 방어성 문제다.
- 권고: 013 punish/replace에도 `replacementId: {binding: "bound.successor.personId"}`를 명시한다. 엔진이 이미 지원하는 인수라 새 효과를 만들지 않는다. 정상 상태에서는 동작을 바꾸지 않고 정본의 생존 조건을 실제 실행 대상에 연결한다.

## 확인한 정합성

- 001–130 shard 전체에서 `conditions`와 등록기 `conditionBinding.sourceConditions`가 동일하다(해당 필드가 있는 사건). 선택별 effect preconditions와 `choices.conditions.sourcePreconditions`도 동일하다.
- 원고 연도와 등록기 calendar min/max가 동일하며 모든 `enabledInEngine`은 false이다. A의 unsupportedFilters는 검수 범위 전체에서 유지되었다. 따라서 창 확대를 이유로 미지원 맥락을 자동 허용한 회귀는 발견하지 않았다.
- 005는 750<D<1250, 024는 750<D≤2000, 042는 650<D<1250으로 원고와 AST가 동기화되었다. 024의 시장 장려금 및 042의 장려금 조건은 선택별 AST에 있다.
- 004는 L≥40으로 확대하며 초기 40d 총한도 및 20+20d 후속 검사의 차이를 원고에 명시한다. 등록기 기존 안전조건(물 서비스·밀 반입 차단·실제 적법 사업)은 유지한다.
- 032·033·053 복합 선택 AST는 각각 60d·54d·50d를 초기 금고 조건으로 요구한다. 개별 선택은 해당 종류 미제출만 검사하고, 보류는 빈 명령·무결과 선택으로 남아 있다. 이 정적 확인은 원자적 실행을 실측했다는 뜻이 아니다.
- 038은 enforcing 단계와 실제 점유 미이행 조건을 유지한다. 실행1+보류가 전역 최소 실효 선택2 정책에 걸린다는 제한을 담당자 보고서가 명시하고 있다.
- 013·052는 direct/steward 둘 다 허용하며 감사 존재·기한·현 담당 일치·생존·후임을 유지한다. 관용 +10을 항상 보장하지 않고 충성도 상한을 반영한다.
- 034의 세 preset은 서로 다르고 현재 규칙과의 같음 검사로 no-op을 제외한다. recurring 미존재를 false와 동등하게 처리하는 분기가 있다. 직접 감독에서 규칙을 저장하는 것이 청원 자동 판결을 뜻한다고 바꾸지 않았다.
- 031/059는 현직 교체 대 직접 감독에서 위임으로 구분되는 제목·mode 조건을 유지한다. 059의 direct 유지 선택은 no-op으로 AST상 비활성화되므로 두 실제 위임 대안을 결과 선택으로 센다.
- 061–130의 기간 변경 전후와 각 본문·history.basis를 함께 확인했다. 특정 연도 사례가 중심인 079/080/099/104/107/109/111/112/115/116/117/119/120 등은 좁은 창을 유지하고, 관행성 소재를 넓힌 범위에서 확정적인 시대 모순을 발견하지 않았다. 원전 전문을 재검증한 역사 감수는 아니다.

## 범위와 한계

입력은 `/tmp/astra-content-v4-20261004/records/inputs/`의 A-events/A-registry 및 B-events-v3.1과 `/tmp/astra-canon-{001-030,031-060,061-130}/`의 결과이다. 131–200과 중앙 dedup 정책은 부모 담당이며 이번 독립 검수 대상이 아니다. 실제 게임 플레이·등록기 evaluator 실행·저장 복원은 검증하지 않았다. Graft는 새 clone에 그래프가 없어 ask/grep 모두 정보를 주지 않았으므로 지시대로 소스의 정확한 함수 범위만 직접 읽었다.

### IR-01 추가 계약 확인

`bindingResolution.multipleMatches = stable_first_after_required_predicates`라는 메타데이터는 있다. 다만 A의 `ADAPTER_CONTRACTS.json`, `READ_MODEL.json`, `COMMAND_CONTRACT.json`, `docs/verification/lm-e9/`에서 그 필수 술어가 연결 claim의 선택 가용성까지 포함하며 후순위 suit를 다시 탐색한다는 전체 계약 정의는 확인하지 못했다. ADAPTER의 binding-scope 처리 순서는 shared binding → choice binding → 최소 선택 수이며, backtracking 보장을 명시하지 않는다. 따라서 IR-01은 실행 중인 엔진의 확정 결함이 아니라 **first 바인딩과 상시 후보 의도 사이의 의미 미정/어댑터 미구현**으로 최종 기록하는 것이 정확하다. evaluator를 실행해 특정 동작을 관측했다는 주장은 하지 않는다.

## 최종 통합 처리

IR-01은 REMAINING.md R2로 유지했다. IR-02는013 a/c의 지원되는replacementId를 bound.successor.personId로 연결하여 수정했고 FINAL_CHECKS.json에서 두 선택을 검사했다. 원고효과의 인수·제한 설명도 함께 반영했다.
