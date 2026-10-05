# REGION core18 독립 native 수락 검토

**PASS — 이번 고정 core18의 안정화 화면 동등성·native 검토 수락.** 실제 core `442b71822c189a245877cc1da1af86831e19448a`, baseline `fd68f124cf6f8f0b60e6c05049cd03cfc6b817b5`, run `astra-region-core-v1-442b718`에 한정한다. 신규 회귀 차단 사항은 없다. DATA4, cold-loading 동일성, 미래 HEAD/본선 이관 성공 판정은 아니다.

## 직접 수행한 검증

- raw core 원본18장을 view_image로 **각각 개별 열람**했다. 합성 sheet·thumbnail로 대체하지 않았다. 전부1280×800이며 열람 순서/원본 경로/SHA/관찰은 아래와 JSON에 보존했다.
- core18+baseline18+core repeat18의 **PNG54장을 독립 RGBA decode**했다. 전체18쌍 baseline/core 및18쌍 A/A의 RGBA 완전동일을 확인했고 receipt RGBA SHA와 일치했다. baseline PNG를 다시 개별 육안 열람한 것은 아니며 기존 baseline native 검토와 전체 픽셀 동일성으로 연결한다.
- 양쪽 raw captures.json의 full identity18을 직접 비교했다. core errors/repeatErrors0, stable 및 repeat pass18, differingPixels0을 확인했다. 예상 URL-뷰34쌍(양성16×A/B2 + 음성2×grass1)의 first-open request/decode/paint lineage를 raw 배열에서 확인했다. **서로 다른 URL34개라는 뜻은 아니다.**
- 현재 detached core HEAD442b와 tracked clean을 확인하고 fresh freeze의 **26857개 입력 SHA 전부**를 실제 로컬 파일과 대조해 불일치0이다. export26858과의 차이1은 self-manifest `.omo/evidence/region-core-runtime-prep-full-freeze.json`이다. 원격 pre/post guard는 같은 HEAD/clean/입력맵으로 PASS이며, 원격 명령을 새로 수행한 검증은 아니다.

## 18장 개별 native 열람 기록

1. `region4-chalk_downs-spring-z1` — 올리브 바탕·강굽이·갈색 섬 경계가 연속적이며 빈 fill 없음. **PASS.**
2. `region4-chalk_downs-spring-z06` — 축소된 지도 외곽·암반·강 경계 유지; 새 사각 패턴판 없음. **PASS.**
3. `region4-chalk_downs-summer-z1` — 여름 비/물웅덩이 아래 기존 올리브 fill과 강 윤곽 유지. **PASS.**
4. `region4-chalk_downs-winter-z1` — 밝고 거친 겨울 입자와 짙은 heath 섬 대비는 baseline 동일; 새 틈 없음. **PASS.**
5. `region4-coastal_port-spring-z1` — 해안의 밝은 가는 테두리와 내륙 녹지 경계 유지; 해상 대각 격자 기존. **PASS.**
6. `region4-coastal_port-spring-z06` — 해안/숲/지도 모서리를 포함한 축소 화면에서 새 직사각 누출 없음. **PASS.**
7. `region4-coastal_port-summer-z1` — 비 아래 해안 fill과 물가 윤곽 연속; 녹지 경계 기존. **PASS.**
8. `region4-coastal_port-winter-z1` — 흰 입자 해안 fill과 옅은 내륙 녹지 대비가 강하나 baseline 동일. **PASS.**
9. `region4-fen_drainage-spring-z1` — 청회 습지 연결띠가 연못을 연결; 녹지섬·갈대 경계 연속. **PASS.**
10. `region4-fen_drainage-spring-z06` — 저줌 지도 가장자리와 여러 습지/연못 연결 유지; 빈 쐐기 없음. **PASS.**
11. `region4-fen_drainage-summer-z1` — 비 아래 습지 fill·연못·마른 녹지 경계 위치 유지. **PASS.**
12. `region4-fen_drainage-winter-z1` — 겨울 청회 입자와 갈대 톱니 경계 뚜렷하나 기존; 물/땅 누출 없음. **PASS.**
13. `region4-forest_edge-spring-z1` — 갈색 숲바닥과 초록 마을/초지 경계 유지; 나무 아래 fill 누락 없음. **PASS.**
14. `region4-forest_edge-spring-z06` — 숲 둘레·암반·지도 모서리 축소 화면에서 새 타일 사각 경계 없음. **PASS.**
15. `region4-forest_edge-summer-z1` — 여름 비 아래 갈색 숲바닥·마을 초지 및 밭/건물 배치 유지. **PASS.**
16. `region4-forest_edge-winter-z1` — 회색 겨울 숲바닥/옅은 초지 고대비와 눈층은 기존; 신규 seam 없음. **PASS.**
17. `region4-open_field-spring-z1` — 음성 open_field 녹지 연속; 별도 지역 fill판 보이지 않음. **PASS.**
18. `region4-open_field-spring-z06` — 음성 저줌 녹지·지도 모서리·숲 경계 연속; 새 누락 없음. **PASS.**

## 기존 관찰과 코드 검토의 남은 한계

기존 baseline 보고서의 sharp terrain transitions, 겨울의 강한 grain, 해상의 가는 grid는 이번에도 보인다. 특히 fen/forest 겨울 바탕과 초지의 대비가 강하다. full RGBA18 동일이므로 이 특성을 새 REGION 회귀로 분류하지 않는다. 관찰된 지도 외곽·강/연못·숲 경계에서 새 빈 영역, 직사각 이미지 넘침, 패턴 위치 이동은 없다. 이는 최종 미감 전체 승인과 다르다.

기존 core 코드 검토의 **안정화 readiness에서 실제 baseline/core pixel parity 필요**는 이18뷰 범위에서 해소됐다. shared loader decode/치수 검증으로 인한 cold-loading 타이밍 변화는 여전히 의도된 차이다. optional pair 실패의 원자성은 기존 정적 시험 증거이며, 아직 설치되지 않은 DATA4의 성공 seasonal pattern/paint 수락을 이 core parity로 대체하지 않는다.

촬영 범위는 spring z1/.6, summer/winter z1, DPR1이다. autumn·chapter4/1380·실제 drainage 명령·DPR2 및 신규4의 source 사용은 증명하지 않았다. source paint lineage는 개별 A/B texel 가시성 증명이 아니며 open_field grass 증인만으로 모든 regional source의 미요청을 단정하지 않는다. repeat의 RGBA/A-A는 직접 확인했지만 repeat request/draw 상세배열은 저장되지 않아 별도 lineage/absence 재검산은 불가능하다. 외부 Node/Chromium/Playwright/cache 식별은 원격 guard 영수증 범위이며 Mac binary/OS/font 동등성을 주장하지 않는다.

과거 prep inputs/check의 REQUIRED_AFTER_CANDIDATE_COMMIT 문구는 준비 이력이다. 이번 판정은 실제442b run receipt와 fresh full-freeze/pre/post guard를 근거로 하며 과거 placeholder를 현재 검증으로 쓰지 않았다.

작성은 본 MD/JSON만. 제품·공식 문서·원본·fixture 수정, remote/browser/commit 실행 없음.
