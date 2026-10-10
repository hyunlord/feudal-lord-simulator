# GROW-BLOCK 화면 — 마을의 목책 계획 · 렌더 A 보고

렌더 A, 2026-10-10. 엔진 GROW-BLOCK(본선 `588d28d1`) 뒤. 요청서 [engine-play2-reads.md](../../requests/engine-play2-reads.md) 4절과 그 끝의 "4절 엔진 답(최종)". 사용자 판정(2026-10-09): 영주 모드 시대 칸의 주 단추는 "마을의 목책 계획" — 계획이 어디 있고 무엇에 막혔는지를 엔진 읽기에서, "성벽 둘레 지정"은 막혔을 때만, 손으로 긋기는 샌드박스만. 엔진 파일 0줄.

## 실행 위치
- 코드·시험: Mac 작업 트리 `~/github/fls-grow`(가지 `claude/grow-ui`) — 본선 `588d28d1` 병합, 에이전트 가지 `claude/grow-plan` 병합, 리드 고침.
- 상태(DGX): `~/fls-growplan-states`(새 상태 묶음 `growplan`, `scripts/growPlanStates.ts` — 영주 봇 seed 2; `states.json`이 준비한 것을 적음), `~/fls-variant-states`(그대로).
- 기하 관문(--gate --keep, 마지막 트리 `223e9ec4`, 커밋 trailer `UI-Geometry-Run`): `render-GROWUI-final-geometry-223e9ec-223e9ec` — 바뀐 줄 15(시대 칸 샌드박스·영주·계획 다섯 단계, 문구 변형 카드 다섯과 칩 둘, famine-answered), 300칸 모두 열림, 실패 0, 등록 안 된 틀 0, 53분. **재시도 라운드 4나무**: 15줄을 한꺼번에 잰 이 판의 짐에서 variant-056이 몇 조건(1280×800·1920×1080·태블릿, 첫 시도에 칩 누르기가 10초를 넘김)과 famine-answered 한 조건(1280×800 normal/extreme)이 재시도로만 열렸다 — 혼자 잰 판에선 둘 다 `retried: []`였다(아래 2절). 다음 푸시(grow-kin)에서 056의 "다른 카드를 미룬 뒤" 대기를 늘려 다시 잰다.
- 단계별: `render-GROWPLAN-geometry-c7ef45f-c7ef45f`(계획 6줄 120칸, 실패 0·재시도 0) · `render-GROWUI-v056b-geometry-c4c22b3-c4c22b3`(variant-056 20칸, 첫 라운드 재시도 0) · `render-GROWUI-famine-geometry-9d57715-9d57715`(famine-answered 20칸, 재시도 0).
- 캡처: `render-GROWPLAN-captures-c7ef45f`(12/12, `docs/verification/growblock/` 1.5 MB).
- test:changed: 마지막 트리에서 DGX `--gate`(푸시 기록).

## 1. 마을의 목책 계획(엔진 `charterWallPlan`)
- 영주 모드 시대 칸의 주 단추 하나가 "마을의 목책 계획" — 누르면 계획이 열린다. 그 아래 한 줄이 단계를 말한다. 영주 모드에선 손으로 긋는 단추와 추천 길이 없다(샌드박스는 그대로).
- 단계 여섯(4절 최종 답과 대조):
  - `waiting` — 차지 않은 선포 조건마다 지금/목표, 엔진의 사업 키(`requirements[].project`)로 무엇을 누가 짓는지("곡창을 마을 공동체가 짓습니다"), 영주의 첫 지렛대와 그 자리(명령 › 방향 / 장려 구역). 돈은 사업 키가 없어 "마을이 지을 것은 없습니다. 금고에 돈이 차면 됩니다". 화면의 조건→사업 짝은 지웠다.
  - `sites` — 둘레 찾기를 붙잡은 공사장마다 선 지 얼마인지(해·계절).
  - `searching` — 마을이 둘레를 찾을 차례, 열면 무엇이 다음인지.
  - `asked` — 마을의 청, 그 청이 있는 칩의 이름.
  - `failed` — 까닭 여덟(`water`·`edge`·`buildings`·`service_space`·`rules`·`lots`·`route`·`other`)을 사람이 읽는 말로(`other`도 "까닭을 하나로 짚지 못했습니다"; 엔진 목록과 어긋나면 컴파일러가 막음), 떨어지는 집 수와 [위치로], 몇 번째인지, 다시 찾는 철.
  - `past` — 시장도시 선포 뒤 시대 칸에 조용한 한 줄 "마을의 목책 계획은 시장도시 선포로 끝났습니다"(주 단추 없음).
- 접은 공사장(`agency.abandonedSites`, 기록 `agency.site_abandoned`): 계획의 모든 단계에서 엔진 문장 그대로 — "도시가 ○○ 공사를 접었다 — n년 동안 길이 닿지 않았다 / 자재가 오지 않았다 / 일할 사람이 없었다"(road·material·work).
- "성벽 둘레 지정": 엔진에 영주의 둘레 명령이 아직 없어 단추는 두지 않았다. 모델의 `ringAllowed`(실패일 때만 참)가 그 자리다.

### 기하 줄로 잰 단계
| 단계 | 줄 | 상태 |
|---|---|---|
| (닫힌 칸) | `slot.goals.era-console.lord` | lord2 offer-countered |
| waiting | `…plan-waiting` | seed 2 자연(1300) |
| sites | `…plan-sites` | 준비(seed 2 searching 상태에 공사장 둘, 길 없는 하나를 마을이 접음) |
| searching | `…plan-searching` | seed 2 자연(1313) |
| asked | `…plan-asked` | seed 2 자연(1313) |
| failed | `…plan-failed` | 준비(같은 searching 상태에 엔진의 실패 모양: service_space, 집 둘, 두 번째) |
| past | 없음 | 감사 상태 묶음에 선포 뒤 영주 모드 상태가 없다 — 다음 푸시의 첫 일 |
- 자연 실패 상태: seed 2·3·4·6은 waiting에서 searching으로 가 첫 탐색에 둘레를 찾았다. GROW-BLOCK 전 1326년에 멈춘 seed 1 저장(`engine-GROW-stall-1ecc0e2`)도 지금 엔진에선 다음 주에 찾는다(틱 104001 searching → 104286 asked). 그래서 failed는 준비 상태로 쟀다.

## 2. 감사 줄 고침(REMOTE 부탁, infra-RR26-full-7af6f5e)
- `modal.lord.home-petition.variant-056`: 원인은 openScene이 불러온 뒤 누르는 Esc — 바쁜 DGX에선 불러오기가 story-delay 3초보다 길어 카드가 이미 떠 있었고 Esc가 카드를 치워 칩까지 사라졌다(재시도 라운드는 페이지가 적어 제때 불러옴). 그 장면엔 시장 부담 제안 카드가 먼저 뜨기도 한다. 고침(줄 쪽만): story-delay 8초, 첫 대기 20초, 먼저 뜬 다른 카드는 한 번 미룸, 그래도 안 열리면 칩 → [결정하기]. 첫 라운드 20조건 모두 열림(`retried: []`, 14분 → 2분).
- `hud.event-card.famine-answered`: 같은 Esc 원인(story-delay 5초 → 8초) + "1배속 한 순간"이 `Digit1`(겹쳐 보기 키)이라 시간이 안 흐르고 뒤의 `Space`가 도시를 다시 흘리던 것을 속도 인장(1배속 → 일시 정지)으로. 첫 라운드 재시도 0.

## 3. 엔진이 고친 렌더 파일
- `src/ui/lord/decisions/lordMattersDue.ts`의 칩 두 줄(감사·지도 밖 청원), `src/ui/hud/autoPauseModel.ts`·`autoPauseCopy.ko.ts`(감사·청원 낱말; 둘은 제 사건으로 이미 멈추므로 자동 정지에서 뺌), `tests/lordAutoPause.test.ts`의 링크 표 — 이번엔 본선의 엔진 판 그대로 둔다. 가족 소식(child·father·spouseId)과 가솔 일의 화면 몫(grow-kin)은 기하가 깨끗해지면 따로 올리며, 그때 이 파일들을 넘겨받아 정리한다.

## 결정(렌더 A 판단, 2026-10-10)
- GBU-D1 영주 모드 시대 칸의 주 단추는 "마을의 목책 계획" 하나, 그 단계와 막힌 까닭은 엔진 `charterWallPlan`만으로; 손으로 긋기·추천은 샌드박스만(사용자 판정 2026-10-09의 화면 몫). "성벽 둘레 지정"은 엔진 명령이 오면 `ringAllowed` 자리에.
- GBU-D2 선포 뒤(`past`)는 시대 칸에 조용한 한 줄, 접은 공사장은 계획의 모든 단계에서 보인다(4절 대조).
- GEO-D1 스스로 열리는 카드를 재는 줄은 장면의 story-delay가 장면 준비(불러온 뒤 Esc)보다 길어야 한다(8초)·첫 대기 20초; 줄 고침은 실행 보고의 `retried: []`로 판정.

## 엔진에 남은 것
- 영주의 "성벽 둘레 지정" 명령(4절이 말한 영주의 둘레) — 화면 자리는 있음.
- 선포 뒤 영주 모드 상태: GROW-BLOCK 125년 판 seed 1의 선포 뒤 저장(엔진 GROW-BLOCK-2 판과 함께) — 다음 푸시의 첫 일(상태 묶음 "시장도시").

## 원칙 점검
- 엔진 파일 0줄. 한국어는 `*.ko.ts`에만, 색은 palette.ts에만, `title=` 0, 그림 문자 0. 새 화면 파일 250줄 이하(WallPlan 61, lordWall 104). EraConsole.tsx는 본선에서도 250줄을 넘었다.
- 화면마다 주 단추 하나(시대 칸의 계획). 누르기는 이름 붙은 명령·입력(R4). 글자 12px 이상, 터치 44/48px — 기하 감사·캡처.
- 감사·판정 규칙은 바꾸지 않았다. 상태 묶음 `growplan`을 variants와 같은 꼴로(STATE_FLAGS 한 줄, `scripts/remote/tasks.sh` 폴더·상태 파일) — 판정 변경 아님(RR22, REMOTE에 한 줄). `scripts/play2Captures.mjs`의 lord-wall은 계획 줄(.era-action-reason)을 잰다(.era-proposal은 영주 모드에 없음).
