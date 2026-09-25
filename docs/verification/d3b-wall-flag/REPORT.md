# D3b 후속 — 벽 띠 플래그 분리 (`RENDER_WALL_STRIPS`, 기본 끔)

관문: ①띠 켬 = D3b · ②곡선 지면 끔 = D3b · ③띠 끔 경로 · ④C25 · ⑤전체 회귀·클론 — 통과

근거: 2026-09-25 사용자 D3b 검토("석벽·목책 띠가 윗면·흉벽 없이 밝은 톤이라 벽으로 안 읽힘"). 결정 WL6.

## 바뀐 것
- `src/render/renderWallStripsFlag.ts`: `RENDER_WALL_STRIPS`. URL `render-wall-strips=1|0` > 저장값 `feudal.renderWallStrips` > 기본 **끔**. 설정 토글은 없다.
- 면 띠·모듈은 곡선 지면과 띠 플래그가 둘 다 켜졌을 때만 그린다(`drawObjectRenderItems`). 띠를 끄면 완공 벽은 예전 칸 조각이고, 조각 캐시 키도 D3b 전과 같다(`drawPalisadeSegments`).
- 곡선 지면이면 늘 켜진 채로 두는 것: 벽 기준선, 물가 공유선(0.45칸 스냅), 얕은 물·물가 띠 색 보정, 띠 이음 마스크 수정.
- 물가 띠를 벽 밑에서 생략하는 규칙만 띠 플래그를 따른다. 그 자리를 덮는 것이 면 띠라서, 조각으로 그리면 물가 띠가 벽까지 보인다. 이 설정은 물가 청크 키 `:ws`에도 들어간다.
- 성벽 논리와 `src/engine`·`state`·`save`·`content`·`zones`는 0줄 바꿨다.

## 관문
| 관문 | 결과 | 증빙 |
|---|---|---|
| ① 띠 켬(`render-wall-strips=1`)이 D3b 본선(`61995cc`, 기본)과 같다 | 16/16 픽셀 같음(8화면 × DPR 1·2, 소프트웨어 래스터 FNV-1a) | `strips-on-vs-d3b.json` |
| ② 곡선 지면 끔이 D3b 본선과 같다 | 16/16 | `curved-off-vs-d3b.json` |
| ③ 띠 끔(기본)이면 벽 면 그리기 코드가 돌지 않는다. 물가 띠는 벽 밑에도 그린다 | Node 커버리지: `drawWallFaceSlice`·`drawWallModules` 0회(켬 대조군에서는 실행). 지면 청크 연산 수는 끔 > 켬 | `tests/wallStripsFlag.test.ts` |
| ④ C25 판 | 띠 켬이면 D3b 판과 12/12 같다. 기본(끔) 판으로 12화면을 다시 기록했다(`--write`) | `tests/fixtures/boundary/c25-board.json` |
| ⑤ 전체 회귀·typecheck·build·깨끗한 클론 | 2775/2775(새 테스트 2개) | 아래 |

캡처(`captures/`): 전(before)은 D3b 본선 기본(띠)이고, 후(after)는 이 커밋의 기본(조각)이다. 12화면 × 2장이다.
- `seed2-south`·`seed2-tower`: 석벽이 물가에 서 있고, 물가 띠가 벽까지 이어진다.
- `seed3-stone`
- `natural-timber`
- `building-*`: 공사 중 고정 장면.

성능: 띠를 끄면 면 띠 그리기가 빠지고 조각 경로는 D3a와 같다. 따로 재지 않았다.
