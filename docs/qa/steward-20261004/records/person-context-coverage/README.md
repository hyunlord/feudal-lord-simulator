# R06 개인·가구 문맥 공백 대응

**12개 유형의 대응을 정리하고, 기존 20개를 재작성하지 않은 별도 후보 13개를 만들었다. E 전체 완료가 아니다.** 정본·R05 원고는 변경하지 않았다. 새 후보는 현재 canonical 스키마와 직접 호환되지 않으며 모두 차단 상태다. 이름을 고정하지 않고 원래 `history.summary(record,state)`와 FIX-12 읽기 시점 이름 경로를 유지한다.

## 기존 20개와 이번 13개의 실제 대응

| 유형 | 기존 R05 나이 후보 | 이번 대응 | 여전히 없는 문맥 |
|---|---:|---|---|
| person.fell_ill | 4 | 재사용, 중복 작성 없음 | 질병 원인·당시 가족역할 |
| person.recovered | 4 | 재사용, 중복 작성 없음 | 앓은 기간 |
| person.injured | 3 | 재사용, 중복 작성 없음 | 부상 당시 직업·사고 원인 |
| person.healed | 3 | 재사용, 중복 작성 없음 | 회복까지 걸린 기간 |
| person.pilgrimage | 3 | 재사용, 중복 작성 없음 | 실제 목적지 |
| person.returned | 3 | 재사용, 중복 작성 없음 | 실제 여행 기간 |
| person.emptied | 0 | 이전 거주자 1명/여럿 2개 | 빈집이 된 원인, 사실 줄 충돌 |
| person.arrived | 0 | 도착 나이 14–29/55–70세 2개 | 누구와 어떤 친척인지 |
| person.reeve | 0 | 임명 나이 25–29/30–54/55–60세 3개 | 실제 이전 직업 |
| person.steward | 0 | 앞선 청지기 사망/이주가 동일 전이에 입증되는 경우 2개 | 일반 임명 경위·과거 직책 |
| person.bailiff | 0 | 당시 장인/상인 가구주 2개 | 구체적 임명 사유 |
| person.expecting | 0 | 임신 기록 나이 16–29/30–44세 2개 | 당시 가족 역할·이전 임신 이력 |

기존20은 R05에서 오프라인 adapter 경계와 보존된 자연 기록의 선택을 확인한 제안이다. 설치·실제 UI·모든 유형의 모든 문맥을 검수한 것이 아니다. 이번 작업에서는 R05 결과를 재실행한 것처럼 주장하지 않고 원본 입력 SHA만 확인했다. 기존 adapter를 그대로 복사하여 새 나이 후보의 합성 경계 사례를 검사했다.

## 새 후보와 필드 계약

### 기존 기록에서 읽기 시 계산 가능한 나이: 7개

`person.arrived` 2개, `person.reeve` 3개, `person.expecting` 2개는 R05 HistoricalAgeProposal의 동일한 allowlist·유일 ID 조회·시나리오·생년·기록 tick 검사를 사용한다. 현재 나이나 현재 직책으로 과거를 대체하지 않는다. `context.subjectAgeAtRecord`와 슬롯 연결은 여전히 미설치다.

- arrived의 일반 친척 생성은 14–30 또는 55–70세(`persons.ts:373–387`). 이번 14–29세만 “젊은”이라 썼다. 30세 또는 다른 생성 경로의 나이는 baseline으로 돌아간다. 도착 기록만으로 부모/형제/고아를 판정할 수 없어서 혈연 관계 분기는 만들지 않았다.
- reeve의 후보는 25–60세 가구주(`persons.ts:510–524`). 나이 세 구간 외에 당시 직업을 추정하지 않는다.
- expecting의 생산 조건은 16–44세 여성이면서 head/spouse 역할 및 동거 상대 등(`persons.ts:832–848`). 과거 기록 나이는 계산해도 현재 역할을 문장에 투사하지 않는다. 첫아이/늦둥이/건강한 출산은 주장하지 않는다.
- steward 생성 나이는 35–50세(`persons.ts:477–483`)로 모두 adult다. 임의로 중간 나이 경계를 나눠 “다양성”을 부풀리지 않는다.

### 새 기록 시점 필드가 필요한 6개: 현재 기록으로 소급 적용 금지

제안 envelope는 `version:1, recordId, capturedAtTick, source:emitter_before_after`다. 기존 record의 params에 이미 있다는 주장이 아니다. 작성 시점의 단일 before/after 전이와 대상 ID를 검증한 뒤 불변 기록 또는 별도 사실 스냅샷으로 저장해야 한다. 읽기 시 새로 현재 상태를 조회하여 만들면 안 된다. 누락·타입 오류·다른 기록 ID·다른 tick·알 수 없는 값은 선택하지 않는다. 테스트 envelope의 source 문자열만으로 진위를 보장하는 구현이라는 뜻도 아니다. 실제 producer만 생성할 수 있게 해야 한다.

1. **emptied: `residentsBefore`, `residentsAfter:0`, `householdId`, `abandonedAfter:false`, `burnTransition:false`.** `history.ts:362–371`의 분기 순서와 before/after 거주자 수를 그대로 캡처한다. 이전 주민 1명/2명 이상만 구분한다. 가구주가 subject여도 개인 나이를 쓰지 않는다. 기아·사망·이주 원인 추정 없음.
2. **steward: `predecessorExitAtAppointment:died|left_town` 및 전임자 ID/증거(전이 직전 후보 수 predecessorCountBefore=1).** 같은 before/after에서 유일한 전임 steward가 before people에 있고, after people에는 없으며 새로 after past로 옮겨졌고, 그 사람이 alive=false/true인지 입증되어야 한다. 현재 past 전체에서 마지막 steward를 찾는 추정은 금지한다. 신규 청지기 기록이 같은 전이에 실제 생성됐다는 것은 template로 확인한다. 다중 전임자·초기 생성·이전 틱에 생긴 공석·아직 재직·전임자 미조회는 unknown이다. 현재 emitter는 이 문맥을 저장하지 않는다. `history.ts:395–405,416–421`와 `persons.ts:477–483`가 연결 후보 근거일 뿐, 두 후보의 자연 발생은 이번에 확인하지 않았다.
3. **bailiff: `classBandAtAppointment:artisan|merchant`, `roleAtAppointment:head`, `ageAtAppointment:25..60`, 비 manor `householdId`.** `persons.ts:528–542`에서 실제 선임된 대상의 값을 해당 전이에 캡처한다. 가구 수준이나 도덕성을 계급에 연결하지 않는다. 현재 Person.classBand는 나중에 변하므로 과거 재사용 금지다. `history.ts:407–410`의 태그 추가는 직무 부여를 기록하지만 이 계급값은 저장하지 않는다.

모든 문장 전문은 PROPOSALS.json에 있다. 6개는 새 필드 없이는 실제 적용할 수 없는 문장 계약이며, 숫자가 늘었다고 사용 가능한 정본이 늘어난 것이 아니다.

## 별도 사실 줄 차단

`person.emptied`의 현행 `historyCopy.ko.ts:347`은 **“굶주려 가구가 흩어졌다”**라고 단정한다. 하지만 `history.ts:370`은 거주자 >0→<=0 및 미방치만 검사한다. 새 headline을 중립적으로 써도 retainFactLine=true이면 기아 단정이 그대로 노출된다. 따라서 두 후보는 `BLOCKED_BASELINE_FACT_LINE_AND_NEW_FIELD`다.

필요한 수정은 엔진 담당의 명시적 승인/작업으로 기존 사실 줄을 “가구가 살던 집이 비었다”처럼 입증 범위로 좁히거나, 실제 기록 원인이 있는 경우에만 기아를 표기하는 것이다. 이번 작업은 원본 사실 줄도 baseline도 바꾸지 않았다. 과거 원인 미확정 기록에 새 원인을 채워 넣지 않는다. emptyCauseAtRecord 분기 자체는 지금 의미를 입증할 필드가 없으므로 작성하지 않았다.

## 검증·전달

`ruby check.rb`는 나이 adapter→선택→슬롯 렌더링과 새 시점 필드 모형→선택을 오프라인에서 실행한다. 현재 142개 합성 fixture를 확인했다. 원본 20개와 템플릿이 겹치지 않음을 검사하고 기준 정본 SHA·R05 원고 SHA·소스 5개 및 정확한 행을 확인한다. 입력 객체 불변도 검사한다. `FIXTURE_RESULTS.json`의 인물/가구 ID는 합성 검사 ID이며 실존 관측 근거가 아니다.

기존 canonical selector나 엔진 producer에 연결한 검사는 아니다. 새 스냅샷 필드의 실제 생성, 자연 발생, 저장/재로드, 읽기 시 이름 변경, 실제 UI, 독립 문구 검수는 남아 있다. 기존 단일 기본형이 의미상 충분한 came_of_age 등은 이번 12개 대상 밖이며 불가능한 나이 분기를 추가하지 않는다.

build.rb는 저작 재현용이며 현재 입력 SHA를 다시 고정한다. 검수 재현에는 check.rb만 사용한다. 후보를 합치려면 부모 검수와 별도 adapter/producer·사실 줄 작업이 선행되어야 한다.
