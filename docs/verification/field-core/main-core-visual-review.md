# FIELD main core 독립 실제 캡처 시각 검토

판정: **PASS WITH LIMITS — 이 20개 준비 장면에서 core 이관에 따른 시각 회귀 blocker 없음.** 새 FIELD spring3 데이터나 자연 플레이를 승인한 판정은 아니다.

## 대상과 방법

- BEFORE: `output/art-architecture/field-main-before-3e722109`, commit `3e722109194cfea10e9fd53a1b870ebfc26a2dfe`.
- AFTER: `output/art-architecture/field-main-core-a392694c`, commit `a392694c3056b93812a0bcc3de767a387f2f3f3b`.
- 두 디렉터리 root PNG를 각각 20개, 총 40개 개별 원본 열람했다. contact sheet로 대체하지 않았다.
- DPR1 18개는 1280×800, DPR2 2개는 2560×1600. DPR2 전체 표시가 축소되어 x/y 각각 BEFORE/AFTER 원본 좌표 `[1150,750,1406,1006]`의 256×256 부분을 리샘플링 없이 추가 열람했다. 부분 이미지는 메모리에서만 만들었으며 원본은 수정하지 않았다.
- 원본 `captures.json` 두 개의 전체 identity 객체(상태 SHA, tick, 계절, camera, zoom, viewport/DPR, browser, renderer, visualTime, captureProtocol, expectedRequests 포함)를 독립 비교했다. PNG를 Pillow로 RGBA 디코딩하여 BEFORE↔AFTER와 양쪽 original↔repeat를 실제 바이트 비교했다. summary 수치를 그대로 승인하지 않았다.

## 독립 수치 결과

- view 이름 집합 및 20/20 전체 identity 동일.
- BEFORE↔AFTER 20/20 크기·전체 RGBA 동일: differing pixels 0, max channel delta 0.
- BEFORE A/A 20/20 및 AFTER A/A 20/20 전체 RGBA 동일.
- AFTER 직접 계산 RGBA SHA가 captures.json receipt와 20/20 일치.
- 재검산 기록: `.omo/drafts/field-main-core-visual-audit.json`.

## 개별 이미지 관찰

각 행은 BEFORE와 AFTER 원본 둘 다 열람한 비교 판정이다.

| 이미지 이름 (확장자 .png) | 판정 | 관찰 |
|---|---|---|
| field-x-spring-z1 | PASS | 꽃/풀 덩어리가 이랑 위에 겹치는 기존 patchiness 유지. 방향·밴드 경계·지면 접촉 회귀 없음. |
| field-x-spring-z06 | PASS | 전체 밭 경계와 색 띠 구별 유지. 세부 텍스처 판독은 축소율로 제한. |
| field-x-spring-z14-dpr1 | PASS | 근접 이랑 끝/헤지 경계에 새 틈·잘림·축 전환 없음. 기존 꽃 겹침 유지. |
| field-x-spring-z1-dpr2 | PASS | 원본 2560×1600 열람 및 1:1 부분 비교. 이랑/씨앗/성장 줄 무늬 연결 동일. |
| field-x-summer-z1 | PASS | 기존 마른 풀 겹침 유지. 밴드와 외곽 위치 동일. |
| field-x-summer-z06 | PASS | 작은 크기에서도 밭 실루엣과 줄 방향 유지; 미세 디테일 제한. |
| field-x-autumn-z1 | PASS | 기존 낙엽 겹침과 주변 황갈색 지면 유지. 새 접합선 없음. |
| field-x-autumn-z06 | PASS | 축소 밴드 대비/외곽 동일; 기존 지면 패치 유지. |
| field-x-winter-z1 | PASS | 눈 이랑/헤지와 기존 눈 패치 유지. 새 흰 사각형·반쪽 텍스처 없음. |
| field-x-winter-z06 | PASS | 눈/갈색/녹색 띠 배치 동일. 세부 눈 픽셀 판독 제한. |
| field-y-spring-z1 | PASS | 꽃/풀 덩어리가 이랑 위에 겹치는 기존 patchiness 유지. 방향·밴드 경계·지면 접촉 회귀 없음. |
| field-y-spring-z06 | PASS | 전체 밭 경계와 색 띠 구별 유지. 세부 텍스처 판독은 축소율로 제한. |
| field-y-spring-z14-dpr1 | PASS | 근접 이랑 끝/헤지 경계에 새 틈·잘림·축 전환 없음. 기존 꽃 겹침 유지. |
| field-y-spring-z1-dpr2 | PASS | 원본 2560×1600 열람 및 1:1 부분 비교. 이랑/씨앗/성장 줄 무늬 연결 동일. |
| field-y-summer-z1 | PASS | 기존 마른 풀 겹침 유지. 밴드와 외곽 위치 동일. |
| field-y-summer-z06 | PASS | 작은 크기에서도 밭 실루엣과 줄 방향 유지; 미세 디테일 제한. |
| field-y-autumn-z1 | PASS | 기존 낙엽 겹침과 주변 황갈색 지면 유지. 새 접합선 없음. |
| field-y-autumn-z06 | PASS | 축소 밴드 대비/외곽 동일; 기존 지면 패치 유지. |
| field-y-winter-z1 | PASS | 눈 이랑/헤지와 기존 눈 패치 유지. 새 흰 사각형·반쪽 텍스처 없음. |
| field-y-winter-z06 | PASS | 눈/갈색/녹색 띠 배치 동일. 세부 눈 픽셀 판독 제한. |


## 기존 현상과 한계

x 축 장면은 물/지도 가장자리, y 축 장면은 숲 인접 배치다. 두 축 모두 밭 줄과 사각 투영 외곽의 지면 접촉 및 방향이 유지된다. y 주변 나무와 식생이 경계를 가리는 위치도 BEFORE와 같다. 밭 위 꽃·마른 풀·낙엽·눈 패치, 주변 지면의 얼룩, 가는 지면/물 격자선은 기존 장면에서 이미 보이며 이번 이관이 새로 만든 결함으로 분류하지 않는다. 이는 기존 표현 전체의 미적 완성도 승인도 아니다.

0.6 배율에서는 줄 방향과 색 띠는 구별되지만 개별 식물·씨앗·접합 픽셀 판독에는 한계가 있다. 1.4 및 DPR2 부분에서는 눈에 띄는 새 불연속·반쪽 로드·외곽 bleed·피벗 이동을 발견하지 않았다. 준비된 겨울 장면에 녹색/황색 작물 띠가 남는 것은 동일 상태의 BEFORE에도 있는 결과이며 실제 계절 작물 시뮬레이션 검증으로 해석하지 않는다.

정적 준비 상태 20뷰의 안정화 후 결과만 검토했다. 자연 플레이, 모든 occlusion, 장시간 이동/계절 전환, 실패 네트워크나 warm-up 중간 프레임의 원자성은 이 이미지 검토가 증명하지 않는다. source request/decode/draw lineage는 별도 기계 증거이며 개별 source의 모든 픽셀이 눈에 보였다는 주장으로 바꾸지 않았다. 새 spring3 실제 데이터의 시각 관문은 별도다.

변경은 이 보고서와 선택적 수치 감사 JSON 두 파일뿐이며 제품/공식문서/원본 캡처는 편집하지 않았다.
