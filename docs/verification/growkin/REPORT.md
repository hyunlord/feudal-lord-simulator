# 가족 소식의 사람들·가문 일의 기한·감사 줄 — 렌더 A 보고

렌더 A, 2026-10-10. 엔진 GROW-BLOCK(본선 `588d28d1`)이 요청서 [engine-play2-reads.md](../../requests/engine-play2-reads.md) 4절에 답한 가족 기록 id와 `lordMattersDue`의 새 두 종류를 화면에 잇는다. 엔진 파일 0줄.

## 실행 위치
- 코드·시험: Mac 작업 트리 `~/github/fls-grow-kin`(가지 `claude/grow-kin`, 에이전트 grow-kin; 마지막 단계는 리드) — 본선 `26e53ed26` 병합.
- 상태(DGX): 순간 그림 상태를 지금 엔진으로 다시 만든 `~/fls-growkin-moment-states-e86811d`(공용 `~/fls-wave40-moment-states`는 그대로).
- 기하 관문(--gate --keep, 마지막 트리 `694c3e32`, 커밋 trailer `UI-Geometry-Run`): `render-GROWKIN-geometry-694c3e3` — 바뀐 줄 7(가족 순간 카드·연대기 가족 고리·전기·감사와 지도 밖 청원의 칩과 카드)과 문구 변형·famine-answered 8줄을 함께, 15줄 300칸, 실패 0·열지 못함 0·등록 안 된 틀 0, **`retried: []`**.
- test:changed: 마지막 트리에서 DGX `--gate`(푸시 기록).

## 1. 가족 소식(엔진 기록의 사람 id)
- `marriage.child_born`·`marriage.brother_in_law_born`의 `child`·`father`, `person.married`·`person.died`의 `spouseId`로 소식이 사람을 이름한다: 혼인의 두 사람, 죽음이 남긴 배우자, 첫아이와 그 아버지. id가 없는 옛 기록은 기록이 주는 사람만(짐작하지 않음).
- 전기: 친척의 아이를 영주 아이들의 형제로 부르지 않는다.
- 칩은 사람을 이름(given name)으로 줄이고, 온 이름은 기록의 연대기와 혼인 타임라인에 남긴다(긴 문구의 세 사람 온 이름이 카드를 행동 도크 밑으로 밀었다).
- 높이 800px 이하 화면에선 가족 순간 카드의 그림을 96px 띠로 — 카드가 행동 도크와 청지기 줄 위에서 끝난다(제목·단추는 그대로, 안에서 스크롤 없음).

## 2. 가문 일의 기한(`lordMattersDue`의 감사·지도 밖 청원)
- 감사의 발견과 지도 밖 청원의 칩을 엔진 목록에서만 읽는다 — 화면이 따로 더하던 것(결정 SUIT-D5)은 뺐다. 실제 플레이 상태(와 lord2 audit-pending·inherited)에서 칩 id 모음이 옛 어댑터(엔진 ∪ 카드 머리, 중복 없앰)와 같음을 시험으로 확인했다. 칩은 엔진 `dueTick`을 철로 말한다.
- 자동 정지: 둘은 제 사건으로 이미 멈추므로 기한 일로는 멈추지 않는다 — 엔진 GROW-BLOCK `cc7618259`의 거름과 낱말을 그대로(`autoPauseModel.ts`·`autoPauseCopy.ko.ts`·시험의 링크 표가 본선과 같음). 이로써 엔진이 예외로 고친 렌더 파일 넷(`lordMattersDue.ts`의 칩 두 줄 포함)을 넘겨받았다.

## 3. 감사 줄(지난 푸시의 재시도)
- `src/ui/decisionCard/surfaces.ts`: 다른 카드를 미룬 뒤 원하는 카드가 스스로 열기까지 20초(4초였다) — 함께 잰 판의 짐에서 더 오래 걸려 칩 누르기가 열리는 카드에 닿았다(render-GROWUI-final-geometry-223e9ec의 variant-056 재시도). 이번 함께 잰 판에서 variant-056·famine-answered 모두 첫 라운드에 열림.

## 결정(렌더 A 판단, 2026-10-10)
- KIN-D1 가족 소식은 엔진 기록의 사람 id로만 사람을 이름한다(혼인의 둘·남은 배우자·첫아이와 아버지), id 없는 옛 기록은 짐작하지 않는다. 칩은 이름만, 온 이름은 연대기·혼인 타임라인에.
- KIN-D2 감사의 발견·지도 밖 청원의 칩은 엔진 `lordMattersDue`에서만 — SUIT-D5를 대신한다. 자동 정지는 둘을 기한 일로 세지 않는다(제 사건으로 멈춤, 엔진 판 그대로).
- KIN-D3 높이 800px 이하 화면에선 가족 순간 카드의 그림을 96px 띠로 줄여 카드가 행동 도크·청지기 줄 위에서 끝난다.

## 원칙 점검
- 엔진 파일 0줄. 한국어는 `*.ko.ts`에만, 색은 palette.ts에만, `title=` 0, 그림 문자 0. 바뀐 화면 파일 250줄 이하이거나 본선에서도 넘었던 파일.
- 화면마다 주 단추 하나. 글자 12px 이상, 터치 44/48px — 기하 감사.
- 감사·판정 규칙은 바꾸지 않았다. 공용 상태 폴더는 건드리지 않았다(새 순간 그림 상태는 따로).
