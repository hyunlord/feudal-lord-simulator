관문: 통과 — ① 저장 이행 Node 전역 0(v9ToV10 `process.env` 제거, 가져오기 189모듈 검사) · ② 초상 풀 3차 72장 반입, 세력 수장 9명 전원 3차 얼굴이고 초상이 manifest에 있음(seed 1~5, 1450년 후계까지) · ③ 이름 한글 읽기 표(라틴 문자 0, 다섯 도시와 세력 사람 전원) · 전체 회귀 `300585c` 3,278/3,278 · 클론 `300585c` 3,278/3,278·build

# FIX-6 보고서 — 저장 이행의 Node 전역, 초상 풀 3차, 사람 이름 한글 읽기

지시서: UI-6에서 넘어온 셋(사용자 2026-09-28, 합쳐서 2시간). 엔진 세션, 검증 DGX. 결정 FX6-1~FX6-5.

## ① 저장 이행 코드의 Node 전역
- `src/save/migrations/v9ToV10.ts`의 `process.env.MIG_DEBUG` 줄을 지웠다. 브라우저에서 v9 이하 저장의 이행이 이 줄에서 멈췄다.
- 시험 `tests/saveMigrationBrowserSafe.test.ts`
  - `saveCodec.ts`와 `migrations/index.ts`에서 상대 가져오기를 따라간다. 모두 189개 모듈이다.
  - 주석과 문자열을 비운 코드에서 `process`·`Buffer`·`require`·`__dirname`·`__filename`·`global`·`setImmediate`·`clearImmediate`와 Node 내장 모듈 가져오기를 찾는다.
  - 옛 줄을 되돌리면 `v9ToV10.ts:202: process`로 실패하는 것을 확인했다.
  - 둘째 시험은 검사 자체를 본다: 주석·문자열·속성 이름은 통과하고, 템플릿 식 안의 `process`는 잡는다.

## ② 초상 풀 3차(CODE-1a)
- **반입**
  - `docs/design/portraits/portrait_pool3.csv`(받은 `portraits.csv` 그대로)를 `scripts/portraitPoolImport.ts`가 읽는다.
  - `portraitPool.ts`는 304장, 124명이다. 3차 줄에는 `faction`·`rank`가 붙는다.
- **고르기**(결정 FX6-2)
  - 세력마다 3차 얼굴이 정해져 있다(`FACTION_PORTRAIT_POOLS`).
  - 수장 계급이 먼저다(`FACTION_HEAD_RANKS`): 백작은 후계자보다, 주교는 부주교보다 앞선다.
  - 후계자는 선대의 얼굴이 아닌 것을 받는다. 그 세력에 다른 얼굴이 있을 때만이다.
  - 도시 세력(상인 가문 둘·도시 공동체·농민 공동체)의 수장은 뽑힌 계절에 그 세력의 얼굴을 받는다. 그 성별의 얼굴이 없으면 제 얼굴을 지킨다.
  - 도시의 다른 사람은 3차를 뽑지 않는다.
  - 해마다의 얼굴 재선택은 세력 얼굴을 지킨다(그 나이대 그림이 있는 동안).
- **첫 수장**(seed 1~5): 백작 I101 · 왕실 I104/I106 · 이웃 I107·I109 · 주교 I111 · 상인 I115(seed 2는 여성 가장 I117)·I116(seed 4는 I118) · 도시 I124/I120 · 농민 I121. 45명 모두 3차다.
- **설치**(결정 FX6-3, 생성 파일 재생성 예외)
  - `scripts/installChronicleArt.py`에 3차 팩을 더하고 다시 돌렸다.
  - 생성된 것: `portraitArtManifest.generated.ts`(304장, 파생본 608), `docs/provenance/assets.csv`(72줄 추가, 스크립트가 제 줄을 끝으로 옮겨 순서만 바뀜), `INBOX_LEDGER.csv`(3차 72줄 `installed_by` = FIX-6), 프롬프트 72개.
  - 손으로 쓴 렌더 코드는 0줄이다.
- **시험** `tests/factionPortraits.test.ts`
  - 3차 72장, 모든 풀 그림이 manifest에 있다.
  - 세력 수장 9명 전원의 초상이 manifest에 있고, 제 세력 얼굴이다(seed 1~5, 첫 계절과 1450년 후계 뒤).
  - 도시의 다른 사람은 3차를 쓰지 않는다.
- **고정값**(결정 FX6-5)
  - 다시 적은 것: X9 세력 해시, B4 전체 상태, seed 3 경로 캐시 전체·돈 뺀 상태, 장부 세계 기준 두 사례, 풀 개수 232 → 304.
  - B4 상태에서 모든 `portraitIdentity`를 빼면 본선과 같은 해시 `3b790d8e…`다(본선 작업 트리에서 같은 24,000틱을 돌려 비교). 경제 해시는 그대로다. 그래서 가드레일은 돌리지 않았다.

## ③ 사람 이름 한글 읽기
- `src/content/personNames.ko.ts`의 표:
  - 세례명 60
  - 성: 직업 13·지명 16·부칭 18·청지기 6, 가문은 `GENTRY_NAMES_KO`
  - 별칭 18
  - 국왕 7
- 별칭은 이름 앞의 수식어로 읽는다: 나이 든·젊은·붉은 머리·갈색 머리·금발·키다리·꼬마·하얀·조카·착한, 셋째~열째. 마지막 `no. N`은 "N번"이다.
- `personDisplayName(person)`(API `persons.displayName`): "나이 든 토머스 애덤슨", "윌리엄 드 리종드", "에드워드 3세".
- 상태에는 시대 영어 이름이 그대로 남는다(`displayName`·`persons.name`·전기 `name`은 그대로).
- 시험 `tests/personDisplayName.test.ts`
  - 표가 게임이 주는 이름을 모두 덮는다.
  - 예시 일곱 개를 본다.
  - 다섯 도시(산 사람·지난 사람)와 1450년까지의 세력 사람 전원의 이름에 라틴 문자가 0이다.
- 직업 별칭("대장장이 ○○")은 지금 별칭 목록에 없다. 넣으면 `NAMESAKE_EPITHETS`와 이 표에 한 줄씩이다(다음 후보).

## 렌더가 넘겨받을 것
- **이름을 `personDisplayName` 하나로**: 지금 영어 이름을 쓰는 곳은 다음과 같다.
  - `personModels.ts`: `personRow`·인물 카드 `name`·`household`·걷는 사람
  - `factionLeaderName`
  - `factionTabModel.ts`
  - `chronicleScreenModel.ts`의 `displayName` 네 곳과 전기 `biography.name`
- `personsCopy.ko.ts`의 `kings`는 `KING_NAMES_KO`와 같다. 옮기면 하나를 지운다.
- 초상 3차는 manifest에 있어서 바로 보인다. 세력 탭·청원 칩의 수장 초상이 3차 얼굴로 바뀐다.
- 병합 규칙(FX6-3): 렌더가 같은 생성 파일을 바꿨으면 본선을 받은 뒤 스크립트를 다시 돌린다.

## 필수 조건
- 전체 회귀(DGX): `cde997d` 3,270/3,275(고정값 5개, 위 표), `293f073c` 3,277/3,278(돈 뺀 상태 해시 1개 더), `300585c` 3,278/3,278.
- 깨끗한 클론 `300585c` 3,278/3,278·build.
- 로컬: typecheck, lint(eslint 0), 새 시험 여덟.

## C4의 현황(이 작업 앞에 멈춘 것)
- 가드레일 1회차 `4c18479`: seed 2·3·5가 L4 16·17·21에서 30만 틱 넘게 멈췄다(조언 "조치 없음", 교착).
- 찾은 결함은 둘이다.
  - 가마의 엿기름이 집에서 14~30칸 떨어진 곡창에 쌓였다.
  - 등급 1 양조 집은 제 에일을 마시지 못했다.
- 둘을 고친 규칙(결정 AL9, `2f3899e`)으로 450,000틱 확인 실행(`engine-C4-ale4`)을 했다. **풀리지 않았다.**
  - seed 1·4는 L4 24/24에 닿았다(12만 틱쯤).
  - seed 2·3·5는 L4 16·16·22에서 멈췄다.
  - 남은 원인은 아직 찾지 못했다. 가드레일은 1회 남았고, 돌리지 않았다.
- C4 브랜치 `claude/c4-ale-chain`은 푸시만 했고, 본선에 합치지 않았다. 다음 C4 작업이 이 막힘부터 다시 본다.

## 소요 시간
- 01:53 시작 → 02:40 마감(KST, 명령 시각). 판정 질문(3차 설치 스크립트) 하나를 포함한다.
