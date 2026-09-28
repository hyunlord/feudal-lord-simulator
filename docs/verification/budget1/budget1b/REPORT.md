# BUDGET-1b 글꼴 woff2만·장 그림은 그 장에서·시작 시 그림 메모리 — 보고서

관문: GATES_LINE

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
- 전제가 반만 맞았다: Wave 12 시설 그림은 아직 설치되지 않았고(public에 있는 Wave 12 파일은 부두 하나), 3~5장 삽화는 CSS 배경이라 원래 미리 불러오지 않는다. 앞으로 설치되는 장 그림은 `chapterArt.ts`에 한 줄로 장을 적으면 된다. 시험(`tests/chapterArt.test.ts` 4/4)이 실제 시작 목록을 돌려 뒤 장 그림이 시작 목록에 들어가면 실패한다.
- 건물은 장이 아니라 정착 단계(마을·장터 도시·성곽 도시)로 열려 1장에도 나올 수 있으니 단계 그림(성곽 기둥·탑, 방어 킷, 옛 성문)은 그대로 둔다.
- 1장 끝 저장(`ui4ChapterStates` chapter-end)은 끝나는 순간 장 번호가 2라서 2장 그림을 불러온다(로컬 탐침 [image-memory-chapter-end-local.json](image-memory-chapter-end-local.json)); 대기근 도착 저장(1장)은 장 그림 0([image-memory-famine-arrival-local.json](image-memory-famine-arrival-local.json), 부르기 단계만 유효 — 뒤 단계는 대기근 결정 창이 열려 시간 초과).

## 3. 예산표의 "시작 시 불러오는 그림 메모리"
- 1장 캠페인 시작: 441장, 파일 15.18 MB, 해제 66.04 MB(세계 그림 65.70). 전부(자유 모드, 이 변경 전 모든 시작): 449장, 15.39 MB, 67.10 MB. 2장에 들어가면 5장, 3장에 3장이 더해진다.
- 목록은 `scripts/checks/startupArtList.ts`가 게임의 `preloadGameArt`·`preloadFrameArt`(와 첫 지형 프레임이 늘 부르는 경계·계절 그림)를 가짜 그림 로더로 돌려 기록한다(손으로 옮긴 목록 없음). 지도에 있을 때 처음 그릴 때 불러오는 그림(물가·구역·성벽 면·날씨·마을 생활)은 빠져서 BUDGET-1 탐침의 추정 118.8 MB보다 작다. 예산 없음(보고만). 표·`dist-budget.json`·`check:merge` 출력에 있다.

## 4. 검증
VERIFY_SECTION

## 5. 다음 후보(규칙이 다름 — 판정 필요)
- 정착 단계별 불러오기: 메모리는 여기에 있다 — 성곽 기둥·탑 5 × 6.3 MB, 방어 킷 6.3 MB, 옛 성문 9.4 MB(해제). 지금은 시작 목록이 아니라 처음 그릴 때 불러온다.
