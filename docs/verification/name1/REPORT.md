# NAME-1 화면의 사람 이름을 한글 읽기 하나로 — 보고서

관문: 통과 — 연대기·전기·세력 탭·세력 쪽·청원 카드 둘·워커 카드 캡처에서 사람 이름의 라틴 문자 0(`captures/names.json`) · DGX 전체 회귀 3,286/3,286 · 병합 전 검사 · 클론(아래)

## 1. 바꾼 것
- 사람 이름은 모두 엔진 FIX-6의 `personDisplayName`(API `persons.displayName`, 표 `personNames.ko.ts`)으로 쓴다. 저장 상태의 시대 영어 이름(`displayName`·`persons.name`·전기 `name`)은 그대로다.
  - `personModels.ts`: 식구 줄(`personRow`), 인물 카드 이름, "○○의 집", 워커의 사람, 세력 수장 줄(`factionLeaderRow` — 청원·결정 카드의 보낸 사람 칩).
  - `chronicleScreenModel.ts`: 기록 카드의 사람("○○의 집 —"), 인물 거르개 목록, 청원을 함께 낸 사람, 가구 관계 줄, 전기 이름(`biography.name` 대신).
  - `factionTabModel.ts`: 세력 수장 이름, 연표의 수장 줄.
- 겹치던 것을 지웠다: `PERSONS_COPY.kings`(= `KING_NAMES_KO`)와 `factionLeaderName`. 국왕 이름 표는 `KING_NAMES_KO` 하나다.
- 상인 가문 이름("Hodgson 상인 가문")도 그 집안 사람과 같은 읽기로(`factionDisplayName`이 `SURNAMES_KO`를 쓴다): "호지슨 상인 가문". 엔진 시험 `factions.test.ts`의 X3 문장이 영어 가문 이름을 고정하고 있어서 기대값을 `factionDisplayName`에서 나오게 바꿨다(문구만, 규칙 0줄).

## 2. 관문 캡처(DGX, `scripts/name1Captures.ts`)
| 화면 | 상태 | 이름 수 | 라틴 |
|---|---|---|---|
| 연대기 기록 카드 | seed 3 naive 1307(가문 교체) | 8 | 0 |
| 전기 | 같은 판, 첫 인물 | 21 | 0 |
| 세력 탭 | seed 2 1340(2장 끝) | 18 | 0 |
| 세력 쪽(국왕과 왕실) | 같은 판 | 16 | 0 |
| 청원 카드(양모 공납·피란민) | seed 2 1337·1339 | 2 + 2 | 0 |
| 워커 카드 | UI-5 운반 상태(seed 2 1301) | 2 | 0 |
- 동전 금액("605d")은 이름이 아니라 뺐고, 전기의 초상 일치 줄("초상 I067")은 그림 id라서 이름 검사에서 뺐다.
- 캡처: [연대기](captures/n1-chronicle.jpg) · [전기](captures/n2-biography.jpg) · [세력 탭](captures/n3-faction-tab.jpg) · [세력 쪽](captures/n4-faction-page.jpg) · [양모](captures/n5-wool_payment.jpg) · [피란민](captures/n5-refugee_admission.jpg) · [워커](captures/n6-walker.jpg).

## 3. 검증
- 로컬: typecheck, lint, 관련 시험(세력 탭·인물·연대기·UI-6·이름·원장·세력 52개).
- DGX 전체 회귀 `ec618e3`: 3,286/3,286.
- 캡처 `ca1f884`: 7개 화면 라틴 0, 오류 0.
- 증거 0.4 MB.

## 4. 본 것(다음 후보)
- 워커 카드의 "목적" 줄이 공사장 id(`construction-site-000005`)를 그대로 보인다. 이름은 아니라 이번 범위 밖이다.

## 5. 결정
NAME1-D1~D2([결정 목록](../../decisions/README.md)).
