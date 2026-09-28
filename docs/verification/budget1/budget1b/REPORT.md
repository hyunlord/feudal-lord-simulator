# BUDGET-1b 글꼴 woff2만·장 그림은 그 장에서·시작 시 그림 메모리 — 보고서

관문: 통과 — 빌드 woff 0·글꼴 그려짐 · 장 그림 시험 5/5(뒤 장 그림이 시작 목록에 들면 실패) · 예산표 "시작 시 불러오는 그림 메모리" 1장 66.04 MB · DGX 회귀 `531786c` 3,352/3,352 · 깨끗한 클론 `6cef5b0` 3,354/3,354·build

사용자 판정(BUDGET-1 보고의 판정 둘, 2026-09-28)을 반영했다. 코드와 표는 하위 에이전트가 `claude/budget1b`에서 만들었고, 검토·DGX·보고는 이 세션이 했다.

## 1. 글꼴 woff2만
- `scripts/woff2OnlyFonts.ts`(Vite `pre` 플러그인): @fontsource CSS의 `url(….woff) format('woff')` 대체 경로를 CSS 단계 전에 지운다(패키지에 woff2만 가져오는 입구가 없다). 빌드에 .woff 0개, CSS에 woff 경로 0, 글꼴 면 372개는 woff2(7.06 MB) 그대로.
- UI 1,002개 22.75 MB → 630개 13.62 MB, 전체 2,416개 63.60 MB → 2,044개 54.45 MB([../BUDGET.md](../BUDGET.md)).
- 글꼴이 그려지는지: 헤드리스 Chrome에서 개발 서버와 빌드 미리보기 둘 다 Noto Sans KR·Noto Serif KR `document.fonts.check` 참, woff2 26개 받음, woff 0. 시험 `tests/woff2OnlyFonts.test.ts` 2/2.

## 2. 아직 들어가지 않은 장의 그림은 그 장에 들어갈 때
- 규칙 한 곳 `src/render/chapterArt.ts`(`chapterOfArt`, `artForChapter`, `artChapterLimit`): 새 캠페인은 1장, 불러온 저장은 그 장까지, 자유 모드는 전부(전과 같이). 캔버스가 매 프레임 장 번호를 읽어 올라가면 그 장의 그림을 바로 불러온다(`preloadChapterArt`). 그림이 아직 안 온 소품은 그 프레임 건너뛰는 기존 대체 경로 그대로.
- 지금 옮겨진 것은 적다 — 8장, 파일 0.22 MB, 해제 1.05 MB:
  - 2장: 전쟁 소품(봉화·불타는 부두·연기·Wave 12 부두) 5장, 해제 0.82 MB.
  - 3장: Wave 9 흑사병 봉쇄 집 `plague_shut_l1..3`, 해제 0.24 MB(그리는 코드가 아직 없어 주제로 3장에 묶었다).
- 장 선언 한 줄: `CHAPTER_ART`(`src/render/chapterArt.ts`)에 매니페스트(또는 그 일부)마다 `{ chapter, what, urls }` 한 줄(매니페스트의 url을 그대로 씀). `manifestArt` 기반 매니페스트는 `CHAPTER_SCOPED_MANIFESTS`(`preloadGameArt.ts`)에 들어가고, 시설 그림 로더도 장으로 거른다(`preloadGameArt(chapter)` → `preloadHistoricalFacilityAssets(chapter)`) — 앞으로 Wave 12 시설은 `CHAPTER_ART` 한 줄이면 된다. 이를 위해 시설 로더가 그림을 하나씩 불러오게 바뀌었다(전에는 첫 시설 그리기가 모든 시설 그림을 시작; 이제 필요한 그림만. 그려지기 전 대체 경로는 같다; 자유 모드와 캡처의 `preloadGameArt()`는 전부).
- 지키는 시험(`tests/chapterArt.test.ts` 5/5): 선언된 url마다 실제 시작 목록(`startupArtList.ts`)을 장마다 돌려, 그 장 전에는 없고 그 장부터 있고 전체에는 있어야 한다. 장을 따르지 않는 로더(예: Wave 7)의 url을 선언하면 "… out of the chapter-1 startup set"으로 실패하는 것을 임시 수정으로 확인했다.
- 전제가 반만 맞았다: Wave 12 시설 그림은 아직 설치되지 않았고(public에 있는 Wave 12 파일은 부두 하나), 3~5장 삽화는 CSS 배경이라 원래 미리 불러오지 않는다. 
- 건물은 장이 아니라 정착 단계(마을·장터 도시·성곽 도시)로 열려 1장에도 나올 수 있으니 단계 그림(성곽 기둥·탑, 방어 킷, 옛 성문)은 그대로 둔다.
- 1장 끝 저장(`ui4ChapterStates` chapter-end)은 끝나는 순간 장 번호가 2라서 2장 그림을 불러온다(로컬 탐침 [image-memory-chapter-end-local.json](image-memory-chapter-end-local.json)); 대기근 도착 저장(1장)은 장 그림 0([image-memory-famine-arrival-local.json](image-memory-famine-arrival-local.json), 부르기 단계만 유효 — 뒤 단계는 대기근 결정 창이 열려 시간 초과).

## 3. 예산표의 "시작 시 불러오는 그림 메모리"
- 1장 캠페인 시작: 441장, 파일 15.18 MB, 해제 66.04 MB(세계 그림 65.70). 전부(자유 모드, 이 변경 전 모든 시작): 449장, 15.39 MB, 67.10 MB. 2장에 들어가면 5장, 3장에 3장이 더해진다.
- 목록은 `scripts/checks/startupArtList.ts`가 게임의 `preloadGameArt`·`preloadFrameArt`(와 첫 지형 프레임이 늘 부르는 경계·계절 그림)를 가짜 그림 로더로 돌려 기록한다(손으로 옮긴 목록 없음). 지도에 있을 때 처음 그릴 때 불러오는 그림(물가·구역·성벽 면·날씨·마을 생활)은 빠져서 BUDGET-1 탐침의 추정 118.8 MB보다 작다. 예산 없음(보고만). 표·`dist-budget.json`·`check:merge` 출력에 있다.

## 4. 검증
- 로컬: typecheck, lint, 관련 시험 18파일 130/130(chapterArt 5/5, woff2OnlyFonts 2/2, distBudget 8/8), `check:merge` 통과(budget 1.6 초).
- DGX 전체 회귀 `531786c` 3,352/3,352. 본선(CODE-1a·INBOX-1y) 병합 뒤 깨끗한 클론 `6cef5b0` 3,354/3,354·build(장 선언 한 줄·시설 로더 변경 포함).

## 5. 다음 후보(규칙이 다름 — 판정 필요)
- 정착 단계별 불러오기(해제 크기): 지금 시작 때 불러오는 것 — Wave 11 방어 킷 6.29 MB·공공 킷 2.00 MB, 장터 도시·성채 시설 그림 1.61 MB, 돌 성문 아치 둘 2.10 MB, 합 약 12.0 MB를 미룰 수 있다. 성벽 면·기둥·탑·성문 16장 35.73 MB는 이미 성벽이 있을 때 처음 그리면서 불러온다. 목책 성문 부분은 마을 단계부터 쓰여 그대로.
