# UI-6 2장 화면 — 전쟁 결정·예고·봉화·습격·영주 권리·가문 문장·세력 연대기·장 목표 — 보고서

관문: 통과(⑧ 사용자 판정 대기) — seed 2 2장 전쟁 열 단계 세계 → UI 캡처 · 결정 카드 다섯 · 세력 탭(아홉 세력·국왕 쪽) · 가문 교체(seed 3 naive, 1305 쇠퇴 → 1307 교체) · 스킨 감사 0 / 909(26개 상태, 2장 다섯 포함) · 면적 1280 평소 5.9 % / 6 % · 튜토리얼 22 = 22 · B9·TOUCH 14/14 · 터치 대상·글자 위반 0 · DGX 전체 회귀 3,269/3,269 · 병합 전 검사 · 클론(아래 5절)

## 1. 2장 결정 카드 다섯(defId별 표현 표)
- 청원 카드는 이제 `src/ui/petitionPresentation.ts`의 표 한 줄로 그린다. `defId`마다 삽화(Wave 16·17)·제목·요구 줄·선택지 이름·결과 줄이 있다. 시장권 고정 문구와 인장은 `market_charter` 줄에만 남았다. 모르는 종류는 `PETITION_SUBJECTS` 제목과 일반 문구로 보인다.
- 전쟁 다섯(`wool_payment`·`levy_response`·`war_funding`·`refugee_admission`·`wall_or_market`): Wave 17 `illustration/decision/*` 삽화, 선택지는 원장의 `WAR_CHOICES` 이름, 요구 줄은 규칙의 수(양모 `집 24채 × 20d = 480d`, 징집 인원, 보조세, 들일 자리).
- 예측: 전쟁 결정은 엔진의 `warDecisionForecast`로 두 계절 뒤 금고를 보인다(청원 예측 경로가 전쟁 결정에는 빈 값을 냈다).
- 보낸 이: 청원자의 세력(`factionOfPetitioner`) — 이름(`factionDisplayName`), 문장(세력 탭과 같은 열쇠 `factionEmblem`, 상인 가문은 상인 표식), 수장 칩(초상·"○○의 수장 · 나이"). 왕실 칙령은 Wave 14 매단 밀랍 인장.
- 캡처: [w02](captures/w02-wool_payment-2-ui.jpg) 양모, [w03](captures/w03-levy_response-2-ui.jpg) 징집, [w04](captures/w04-war_funding-2-ui.jpg) 보조세, [w08](captures/w08-refugee_admission-2-ui.jpg) 피란민, [w09](captures/w09-wall_or_market-2-ui.jpg) 석벽과 시장.

## 2. 전쟁 예고·봉화·습격 — 세계 → UI
- **세계**(하위 에이전트, 병합해 함께 검증): Wave 17 봉화대(꺼짐·켜짐)를 해안 풀밭 한 칸에(결정적, 표현만), 습격 뒤 두 계절 동안 부두 불과 불탄 집마다 연기 기둥(4프레임). 불탄 집은 Wave 9 화재 그림 그대로. 전쟁이 없으면 대기열에 아무것도 없어 C25 판은 그대로다. 완성된 성벽 구간을 누르면 성벽 카드에 방어도(`ringDefencePermille`). [world/](world/)
- **UI**: 이야기 칩과 사건 카드(Wave 17 `illustration/event/*`) — 전령(그 계절), 봉화(켜진 동안, "습격은 ○○년 ○○까지"), 습격(그 계절, 잃은 것), 습격 뒤(다음 계절), 징집으로 빈 일터, 석벽 선포. 칩의 [위치로]는 봉화대·부두.
- **예고**: 계절 띠에 전쟁의 다음 단계(`warForecast`, 1년 안) — 표시와 "다가오는 일" 줄, 원인 계열 아이콘(왕실 요구 rights·봉화와 습격 safety·피란민 labour). 청지기 말풍선은 전령·봉화·습격 1년 전. [w00](captures/w00-season-strip.jpg)
- **떠난 사람**: 결산 카드 줄, 인구 서랍 "징집되어 떠난 사람 ○명 · ○○년 ○○에 돌아옵니다".
- **순서**: 각 단계의 첫 캡처는 이야기 지연(5초) 전 세계, 둘째는 칩·카드. 습격은 그 앞 틱에서도. [captures/](captures/) · [captures.json](captures/captures.json)(각 장의 모달·칩).

| 단계(seed 2) | 해 | 세계 | UI |
|---|---|---|---|
| 전령 | 1337 봄 | [w01-1](captures/w01-messenger-1-world.jpg) | [w01-2](captures/w01-messenger-2-ui.jpg) |
| 양모 칙령 | 1337 여름 | [w02-1](captures/w02-wool_payment-1-world.jpg) | [w02-2](captures/w02-wool_payment-2-ui.jpg) |
| 징집 | 1338 봄 | [w03-1](captures/w03-levy_response-1-world.jpg) | [w03-2](captures/w03-levy_response-2-ui.jpg) |
| 보조세 | 1338 가을 | [w04-1](captures/w04-war_funding-1-world.jpg) | [w04-2](captures/w04-war_funding-2-ui.jpg) |
| 봉화 | 1339 봄 | [w05-1](captures/w05-beacon-1-world.jpg) | [w05-2](captures/w05-beacon-2-ui.jpg) |
| 습격 앞 틱 | 1339 봄 | [w06-1](captures/w06-before-raid-1-world.jpg) | [w06-2](captures/w06-before-raid-2-ui.jpg) |
| 습격 | 1339 여름 | [w07-1](captures/w07-raid-1-world.jpg) | [w07-2](captures/w07-raid-2-ui.jpg) |
| 피란민 | 1339 가을 | [w08-1](captures/w08-refugee_admission-1-world.jpg) | [w08-2](captures/w08-refugee_admission-2-ui.jpg) |
| 석벽과 시장 | 1339 겨울 | [w09-1](captures/w09-wall_or_market-1-world.jpg) | [w09-2](captures/w09-wall_or_market-2-ui.jpg) |
| 2장 끝 | 1340 봄 | [w10-1](captures/w10-chapter2-end-1-world.jpg) | [w10-2](captures/w10-chapter2-end-2-ui.jpg) |

## 3. 영주 권리·칭호·가문 — 장부 서랍 "권리" 탭
- Wave 14 권리 등록부 틀(9분할)에 두 쪽: 왼쪽 가문(문장 — `lordHouse().heraldrySeed`의 문장 레이어, 몇 대째·언제부터·앞선 가문), 칭호(강등이면 본래 칭호), 쇠퇴 중이면 원인, 전쟁(왕실의 신임·떠난 사람·성벽 방어). 오른쪽 세 권리(Wave 14 아이콘, 잃은 권리는 누가 가졌는지 붉게), 영주가 준 권리.
- 3단 쇠퇴: seed 3 naive 1305 가을, 방앗간 사용료를 상인들이 가져감 [h-decline](captures/h-decline-rights.jpg). 4단 교체: 1307 가을 "드 브리즈몽 가문 · 2대째 · 앞선 가문: 드 메로언" [h-house-change](captures/h-house-change-rights.jpg), 연대기의 물러남·맡음 카드에 두 가문 문장 [h-house-change-chronicle](captures/h-house-change-chronicle.jpg). 2장 끝 [h-chapter2-end](captures/h-chapter2-end-rights.jpg).
- 결산 카드: 쇠퇴·가문 교체·떠난 사람 줄(`SeasonLedger.lordship`, 전쟁).

## 4. 세력 연대기(CHRON-2 화면 1차) — 연대기 "세력" 탭
- 하위 에이전트가 따로 작업 가지에서 했고, 병합해 함께 검증했다.
- 아홉 세력 줄: 문장(상인 가문은 상인 표식), 이름, 수장 초상과 이름·직함·나이, Wave 19 관계 척도(−100…+100, 핀), 요구·약속 수. 아래 바깥 세상 연표(`worldTimeline`, 올해까지). [f1](captures/f1-faction-tab.jpg)
- 세력 쪽(Wave 19 `frame_faction_page`): 수장·문장·척도, 요구, 약속, 우리와의 일(원장 기록 — 누르면 그 세력으로 거른 기록 목록), 그들의 연표. [f2 국왕과 왕실](captures/f2-faction-page.jpg), [faction/](faction/)
- 원장 새 문장: `war.*`, `faction.relation`, `house.*`(`house.resettled` 포함), 쇠퇴 원인 `derelict`·`arrears`·`depopulated`·`empty`가 연대기 카드에 뜬다(`tests/factionChronicleTab.test.ts` 18종 + `house.resettled`).

## 5. 장 목표·장 쪽
- 목표 카드: 2장부터 튜토리얼 카드 줄에 장 제목과 목표(`chapterGoals`) — "제2장 · 전쟁의 그늘 0/2 · 번영하는 시장도시를 이룬다".
- 2장 시작: Wave 16 `chapter2_intro`에 장 이름과 목표. 3장부터는 "아직 만들지 않은 장" 한 줄.
- 2장 끝: Wave 17 `chapter2_end` 위의 장 쪽. 범위는 1장 끝부터, 전쟁 결정은 요구 이름과 그 답으로 인용(시장권 문구 아님), 숫자에 습격·징집·석벽/시장. 대기근 줄은 1장 쪽에만. 제 장의 시작·끝 이정표만(장은 같은 틱에서 만난다). [w10-2](captures/w10-chapter2-end-2-ui.jpg)
- 장 쪽은 장 끝 1,000틱 안에서만 열린다(나중에 그 도시를 불러올 때마다 다시 열리지 않게).

## 6. 이름
- 세력·가문 이름은 `factionDisplayName`·`GENTRY_NAMES_KO`(`LORD_HOUSE_NAMES_KO`)만. 수장 이름은 한 길 `factionLeaderName`(`personModels.ts`): 국왕은 한글 왕호(에드워드 3세), 외부 세력 향신·성직자는 이름 + 성의 한글(William 드 리종드), 도시 사람은 원래 이름. 청원 카드·세력 탭이 같은 함수를 쓴다(따로 있던 `KING_NAMES_KO` 지움).
- 시험이 행·쪽·표시에 실존 가문·주교구·백작령 이름과 영어 왕 이름이 없음을 본다.

## 7. 고친 것(이 작업 중 발견)
- **CODE-1c 후속**: 멈춘 게임에서 장 끝 쪽이 열리지 않았다(이야기 타이머가 렌더 때 정해지는데 처음 본 순간을 기록하지 않아서). 장 끝을 처음 볼 때 이야기 기록 효과가 한 번 다시 그린다.
- **CHRON-1 이후**: 장 쪽 제목이 눌렸다 — 연대기 화면의 `.chronicle-body` 격자가 장 쪽 클래스와 같았다. 장 쪽 본문은 `chapter-page-body`.
- 2장 쪽 앞머리에 "1장이 끝났다"가, 끝에 "3장이 시작되었다"가 끼었다 → 제 장 이정표만.
- 목표 카드 제목이 "목표 0/2 0/2"로 두 번 셌다 → 제목은 장 이름.
- 스킨 감사: DGX의 UI-5 상태 캐시(09-27 10:20)가 FAIL-3·FACTION-0·FIX-5보다 오래돼, 맨 저장 거부(RES-REG)와 세력 없는 장 끝으로 멈췄다. 새 폴더 `~/fls-ui5-states-v22`에 다시 만들었다(옛 폴더는 그대로). 2장 쪽 단계는 `openScene`의 Esc가 600 ms에 열린 쪽을 닫아(플레이어 Esc와 같음) 이야기 지연을 5초로.

## 8. 검증
- 로컬: typecheck, lint, 관련 시험(UI-6 새 시험 6 `tests/ui6ChapterTwoScreens.test.ts`, 세력 탭 6 `tests/factionChronicleTab.test.ts`, 연대기·인물·원장·Wave 17 파생본 22장 크기).
- DGX 전체 회귀 `fec3670`: 3,269/3,269.
- DGX UI 관문, 본선 `870bc650` 대비([gates.json](gates/gates.json)):
  - 면적 1280 평소 5.9 % / 6 %, 1920 3.0 %, 태블릿 6.5 % / 8 %, 모든 줄 통과([hud-coverage.json](gates/hud-coverage.json)).
  - 튜토리얼 22 = 22(본선과 같음), B9 입력 14/14, TOUCH-1 터치 14/14, 게임패드, 초점 복귀, 터치 대상·글자 위반 0(본선도 0).
  - 스킨 감사 `b2b9c41` 0 / 909(26개 상태: UI-5 상태 21 + 2장 결정 카드 둘·권리 탭 둘·2장 쪽). 본선 0 / 714(세력 탭이 없어 그 두 상태는 빠짐). [audit.json](audit/audit.json) · [sheet](audit/sheet-desktop.jpg)
  - 첫 실행 `77d74f8`의 `exit-codes.txt`는 감사 1(7절의 옛 상태)로 남아 있다. 감사만 `b2b9c41`에서 다시 돌렸다.
  - 캡처 `1999fef`(마지막 커밋) 16단계, 오류 0.
- 증거 2.7 MB(JPEG 960 px, 품질 55; 튜토리얼·패드 재생 그림은 빼고 결과 JSON만).

## 9. 사용자 판정 대기
- ⑧ 화면 전체(결정 카드 다섯·전쟁 칩과 카드·권리 탭·세력 탭·장 쪽).
- **부두 그림**: 부두 불(Wave 17 `raid_burning_quay`)은 풀밭 해안에 선다. Wave 12 `quay-v1`을 그 아래에 둘지는 그림 판정(다음 후보).
- **초상 풀 3차**: 수장 초상은 엔진이 고른 `personPortrait`(풀 1·2차). 풀 3차(I101~I124) 반입은 엔진 몫(CODE-1a)이고 상태 해시가 바뀐다.
- **피란민 청원자**: 엔진이 피란민 청원을 주교 세력에 귀속해 카드가 "보낸 이: 윈캐스터 주교"다.
- **사람 이름**: 사람의 영어 이름은 그대로 둔다("Thomas Adamson the elder" — 별칭 "the elder"도 PERSON-0 그대로). 세력·가문 이름만 한글.
- 세력 쪽 아래 칸이 좁다(기록 링크가 한 개 반 보이고 스크롤). 틀 배치를 바꿔야 넓어진다.

## 10. 엔진 세션에 넘길 것
- `src/save/migrations/v9ToV10.ts:202`의 `process.env.MIG_DEBUG`가 브라우저에서 던진다(RES-REG 때 발견, 그대로).

## 11. 결정
UI6-D1~D8([결정 목록](../../decisions/README.md)).
