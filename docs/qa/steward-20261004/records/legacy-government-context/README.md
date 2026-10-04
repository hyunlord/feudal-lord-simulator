# 왕실·자치·가문 문맥 초안

**요청한6종의 조건형14개 저작을 완료했다. 새 캡처·실제 적용은 미구현이며 정본에 합치지 않았다.** 초안 작성 완료와 통합 완료는 별개다. 독립 문구 검수는 대기 중이다.

## 문장·분기

| 유형 | 축 | 문장 |
|---|---|---|
| royal_tax_envoy | 도시가 market_tolls 보유 | 도시가 시장 좌판세를 거둘 권리를 지닌 때에 국왕의 과세 사절이 왔다. |
| royal_tax_envoy | 해당 권리 미보유 | 도시가 시장 좌판세를 거둘 권리를 지니지 않은 때에 국왕의 과세 사절이 왔다. |
| royal_subsidy | 납부 기록 시점 잔액0 | 국왕에게 보조세를 낸 때, 금고에 남은 돈은 없었다. |
| royal_subsidy | 잔액 양수 | 국왕에게 보조세를 낸 뒤에도 금고에 돈이 남아 있었다. |
| city_seal | 아들 후계 선택 기록 | 아들을 후계자로 정한 뒤, 도시는 제 인장을 새겼다. |
| city_seal | 딸의 남편 후계 선택 기록 | 딸의 남편을 후계자로 정한 뒤, 도시는 제 인장을 새겼다. |
| city_seal | 조카/먼 친족 후계 선택 기록 | 다른 친족을 후계자로 정한 뒤, 도시는 제 인장을 새겼다. |
| charter_sealed | 당초 후보와 시장ID 같음 | 당초 후보를 첫 도시의 시장으로 올리며 자치 특허에 인장을 찍었다. |
| charter_sealed | 두 ID가 서로 다름 | 당초 후보와 다른 이를 첫 도시의 시장으로 올리며 자치 특허에 인장을 찍었다. |
| charter_sealed | 시장ID 명시적 null | 첫 도시의 시장 이름을 기록하지 않은 채 자치 특허에 인장을 찍었다. |
| family_departed | 과세 사절 요구 납부 누계 양수 | 과세 사절이 요구한 보조세를 낸 가문이 영주관을 떠나 시골 장원으로 갔다. |
| family_departed | 그 누계0 | 과세 사절의 요구에 따른 납부 기록 없이 가문은 영주관을 떠나 시골 장원으로 갔다. |
| family_stayed | 과세 사절 요구 납부 누계 양수 | 과세 사절이 요구한 보조세를 낸 가문은 영주관에 그대로 남았다. |
| family_stayed | 그 누계0 | 과세 사절의 요구에 따른 납부 기록 없이 가문은 영주관에 남았다. |

market_tolls의 게임 표기는 **시장 좌판세**(`src/ui/lordshipCopy.ko.ts:10`)다. 영어 ID만 보고 일반 통행세로 바꾸지 않았다. 도시의 시장·자치 특허·가문·영주관을 glossary대로 사용했다. 주민의 계층·가문의 충성심·왕의 의도·이주 이유를 만들어내지 않았다.

## 기록 시점 포착 계약

PROPOSAL.json의 captureContract가 각 분기의 상세 계약이다. 공통으로 기존 history emitter 전이를 확인한 즉시 before/after에서 읽고, recordId·recordTick·template·sourceHead에 묶은 불변 context로 저장하는 adapter가 필요하다. 과거 record를 현재 게임 상태와 대조해 채우면 안 된다.

- **envoy**: `history.ts:737`에서 단계 신규 생성. `politics.rights`의 정확한 market_tolls ID 및 townsfolk 보유만 읽는다. 정치 권리와 estates 권리 조각 전체를 같은 것으로 보지 않는다. 목록 부재/손상/중복은 unknown.
- **subsidy**: `history.ts:743`의 royalSubsidy 증가량과 record.params.amount가 일치해야 한다. 잔액은 treasuryBalance(after)로 읽는다. “보조세 때문에 금고가 다 비었다”는 단독 인과가 아니라 같은 기록 시점 잔액이다. before/after 사이 다른 지급이 있을 수 있다.
- **city_seal**: `legacy.ts:251`은 후계 응답 뒤 인장 단계를 예약한다. 실제 heir.tick과 선택된 candidate.personId·kind·relation이 일치할 때만 분기한다. nephew 종류에는 먼 친족도 포함되어서 모두 조카라고 번역하지 않았다(`persons.ts:655–678`). 이 선택 기록으로 현재 영주 생존·직위·실제 권리승계를 추정하지 않는다.
- **charter**: 자치 응답 absent→accept 및 params.mayorId 일치 확인. 후보와 시장의 ID 차이만 쓰며 사망/이주 등 교체 이유를 말하지 않는다. 명시적 null은 unnamed, undefined/손상은 unknown이다. 후보ID가 빈 채 시장ID만 있는 경우도 replacement라고 추정하지 않는다.
- **family**: 단계 신규 생성과 family=departed/stayed 및 자치 응답의 일치를 확인한다. 고정 사건의 가문 이동/잔류 서사를 따르며 실제 모든 Person.householdId가 이동했다고 새로 주장하지 않는다. 인물 이름·가문 이름은 저장 params와 기존 사실 줄의 읽기 경로를 유지한다.

## 보조세 누계와 원장 혼동 방지

`legacy.ts:152–157`은 royal_tax 수락 때 실제 이동 금액만 legacy.royalSubsidy에 더한다. 하지만 자치 특허 확인금도 원장 category=royal_subsidy로 기록되면서 이 누계에는 더해지지 않는다(`legacy.ts:179–180`). 그러므로 누계0을 “국왕에게 돈을 한 번도 안 냈다/보조세 원장이 전혀 없다”로 쓰면 거짓이 될 수 있다.

가문 문장4개는 이 충돌을 피하려 **과세 사절의 요구에 따른** 납부만 말한다. 누계 미설정/음수/비정수면0으로 대체하지 않는다. 왕실 확인금의 액수나 이 사건의 재정 효과를 새 문장에 합산하지 않는다. record.amount의 정본 사실 줄은 그대로 보존한다.

## 스키마·FIX-12·fallback

selector 진입 전에 RECORD.schema와 CONTEXT.schema를 모두 검사한다. 실제 history record 전체를 받는 스키마가 아니라 id/tick/template만 뽑은 선택기용 입력 envelope다. 추가 키를 통과시키는 느슨한 우회가 아니다. context는 템플릿별 정확한 enum 한 개만 허용하며 unknown은 빈 fields와 referenceVerified=false만 허용한다. 빈/공백/줄바꿈 ID, 잘못된 tick 타입, 음수, 교차 템플릿·다른ID/tick, 다른HEAD, 잘못된captureKind는 fallback한다.

referenceVerified=true를 누가 넣어도 출처가 증명되는 것은 아니다. 실제 adapter가 원본 전이·record 결합·저장 무결성을 검증한 뒤 설정해야 한다. 현재는 합성 fixture의 입력표식이다. 14개 모두 retainFactLine=true, requiredSlots=[]다. 특히 mayorId의 표시 이름은 `historyNames.ts:43–54`가 읽을 때 조회하도록 둔다. 후보에 당시 이름/현재 이름을 굳혀 넣거나 이름 없는 ID를 현재 다른 사람으로 교체하지 않는다.

PROPOSAL.schema는 이 저작물 전체를 const로 고정한 **검수용 계약**이다. 신규 원고를 자유롭게 등록하는 일반 스키마가 아니다. 수정하면 독립 검수 뒤 schema도 갱신해야 한다. Ruby validator는 사용한 JSON Schema 키워드 부분집합만 지원한다. ID용 ^\\S+$는 Ruby의 줄별 anchor가 아닌 전체 문자열 의미로 검사하도록 명시 처리했다. JSON Schema 표준 인증 주장은 하지 않는다.

## 검증

`ruby validate.rb`: 양성14, 잘못된 context196, 잘못된 record98, proposal 변조4. selector 검사 총308개. 소스10개18구간 SHA·행, 기준 정본 SHA,14개 ID 유일성·사실 줄 유지·이름 슬롯 없음 확인. 기존 원고·정본·엔진을 수정하지 않았다.

새 캡처는 아직 구현하지 않았으므로 실제로 이 enum이 생성된다는 증거, 자연 분포, 원본 저장 복원, 저장/재로드, UI 출력, 문구 독립 검수는 남아 있다. source 조건상 가능한 분기와 자연 관측을 혼동하지 않는다. 현재 추가 사실 줄 차단은 발견하지 않았지만 가문 누계 해석·미명명 시장·먼 친족 위 세 경계는 독립 검수에서 우선 확인해야 한다.
