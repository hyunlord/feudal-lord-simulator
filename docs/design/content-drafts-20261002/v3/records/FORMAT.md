# v3 초안 형식·편집 검토

검토 대상: v2 폴더의 전체 파일 목록·JSON 파싱과 60개 초안의 필드/조건/선택 구조, 등록기 제안·스키마·예제·작성 계약, v2 검수 기록, glossary, lord-mode. 긴 원고는 JSON을 정본으로 구조와 해당 사건을 대조했으며 외부 역사 출처를 이번에 다시 검증한 것은 아니다.

## 스키마 경계

- `v2/events.json`은 60개 초안의 **배열**이다. `conditions`는 `land/population/rights/relations/season/state` 여섯 **문자열**이다. 구조화 등록기 조건식으로 바꾸면 같은 형식이 아니다.
- `v2/registry.schema.json`은 `proposalVersion/policy/entries`를 가진 **별도 객체**인 `registry.example.json`용이다. 초안 배열이 이 스키마를 통과했다고 말할 수 없다.
- 새 `events-v3.schema.json`은 v2 전체 60개와 `records/AUTHORING_CONTRACT.md`를 바탕으로 작성한 Draft 2020-12 초안 스키마다. 모든 객체의 미지 키를 금지하고, 기존 필수 키·타입·번호·ID·분류·시대·2~4개 선택·효과 키를 검사한다. 다양한 기존 효과 매개변수는 v2 전체에서 확인한 키/타입 합집합을 허용한다. 효과마다 어떤 인수가 실제 명령 입력인지까지 이 구조 스키마가 판정하지는 않는다.
- 독립 의미 검증 필요: ID와 number 일치/중복, 연도 범위 순서와 시대 포함, 금액 범위 순서, 유효한 두 선택, 실제 대상/조건 어댑터, 인물 바인딩, 엔진 실행 성공, 원자성, 누적 장려금 예산.
- Mac python3의 기존 jsonschema로 스키마 자체를 검사하고 **원본 v2 60개, 수정한 019·031·059 3개 모두 오류 0개** 확인했다. 최종 통합 v3는 루트가 다시 검증해야 한다.

## 019·031·059 교정

`records/editorial-events.json`에 기존 필드를 유지한 세 초안 전문을 제공한다.

| ID | 구별 축 | 교정 |
|---|---|---|
| 019 | 직접 감독 → 위임, **성향** | 본문에서 소작인 친화와 상인 친화를 앞세우고 능력·충성도는 함께 표시하는 정보로 구별. 현재 direct를 공통 조건에 명시. 직접 감독 유지는 무변동이며 결과 있는 선택 수에 제외. |
| 031 | 이미 위임 → **현직 교체** | 제목 `청지기를 갈아야 할 때`. 첫 문장에 이미 맡긴 현직과 후임 둘을 명시. 현재 steward, 생존 현직, 두 후보가 서로 및 현직과 다른 ID라는 공통 조건. 셋째 직접 전환은 종전 주의력 경계 조건 유지. |
| 059 | 직접 감독 → 위임, **자질** | 제목 `직접 감독을 내려놓을 때`. 본문에 능력·충성도의 교차 비교를 명시. 두 실제 후보가 모두 유효한 경우만 제시. 직접 유지 선택은 무변동. |

059의 “처음 위임”은 현재 직접 감독 상태에서 청지기에게 판단을 맡기는 장면이다. `oversight.mode=direct`만으로 해당 영지의 생애 최초 위임임을 증명할 수 없다. 생애 최초만 허용하려면 등록기 발생 이력 바인딩이 필요하며 임의 새 저장 필드를 만들지 않았다.

## 엔진 근거

- graft ask `setEstateOversight StewardRecord disposition ability loyalty attention load capacity` 뒤 실제 소스 확인.
- `src/engine/stewardship.ts:371`: setEstateOversight. 같은 영지의 유효한 청지기만 허용. `mode`와 `stewardId` 모두 같으면 no-op. 교체하면 종전 담당 candidate, 선택 후보 serving.
- `src/engine/stewardship.types.ts:11`: `StewardDisposition = merchant | peasant | greedy`.
- `src/engine/stewardship.types.ts:14`: StewardRecord의 `personId`, `estateId`, `ability`, `loyalty`, `disposition`, `connection`, `status`.
- 위 소스는 `5c16778d2eff26a1501485a7c0d7413ce16a6388` 클론 기준. 새 원고의 원래 v2 코드 링크는 보존했으며 통합 담당이 이번 확인 링크를 추가할 수 있다.

## 정본 및 일관성 주의

- 청지기와 집행관은 다르다. 영지·장원·영주관도 구별한다. 농민 공동체(세력)와 소작인 친화(후보 성향)를 기계적으로 서로 바꾸지 않는다.
- 금액 단위 페니(d), 자원 목재(timber)와 통나무(logs), 시설 직조공 집·축융 방앗간·곡물 방앗간을 구별한다.
- 일반 본문/선택에는 내부 tick을 표시하지 않는다. 기술 조건과 효과 명세의 tick 표기는 엔진 연결 근거로 유지 가능하다.
- 장려금 설정은 즉시 금고 출금 또는 건설 보장이 아니다. 범위를 고정하면 label/parameters/rangeNote/tradeoff/ledger/chronicle의 모든 액수를 일치시킨다.
- v2의 `minimumEnabledConsequentialChoices=2` 계약에서는 유지/미루기/no_op를 두 선택에 세지 않는다. 019와 059는 후보 선택 두 개가 모두 유효해야 카드가 성립한다.
- v2의 `sequential_non_atomic` 복합 선택을 콘텐츠만 고쳐 원자적 실행으로 선언하지 않는다. 등록기 미지원이면 복합 선택을 막되 유효 단일 선택 둘을 확보한다.

Graft: 1회, 출력에 명시된 절감 추정 19,827 tokens. 금액 표기 없음.
