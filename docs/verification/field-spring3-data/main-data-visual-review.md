# FIELD spring3 committed main 독립 시각 검토

판정: **PASS WITH LIMITS — 실제 준비 장면에서 새 봄3의 설치 시각 관문을 막는 결함을 발견하지 못했다.** 자연 플레이나 모든 위치/occlusion의 승인으로 확장하지 않는다. 장부 승격은 부모의 별도 작업이다.

## 원본과 독립 검증

- BEFORE `output/art-architecture/field-main-core-a392694c`, commit `a392694c3056b93812a0bcc3de767a387f2f3f3b`.
- AFTER `output/art-architecture/field-main-spring3-cd399e4a`, commit `cd399e4abb26fc04b37dc27b5c61bec270934a7d`.
- AFTER20 native PNG와 봄 BEFORE8 native PNG를 각각 개별 열람했다. DPR2 두 축의 원본은2560×1600이며 전체 표시가 축소되므로 양쪽 commit의 `[1150,750,1406,1006]` 256×256 부분4개를 리샘플링 없이 추가 열람했다. 나머지 native는1280×800이다.
- summary만 읽지 않고 원본 captures.json 전체 identity와 source request/decode/draw 배열, 원본 PNG 및 repeat PNG를 직접 확인했다. Pillow RGBA 디코딩과 Numpy 비교 결과를 동반 `.omo/drafts/field-main-spring3-visual-review.json`에 기록했다.

독립 결과: 20/20 identity는 승인된 봄 expectedRequests 4→3 변경 외 완전히 같다. 비봄12 전체 RGBA는 동일(픽셀차0), AFTER A/A20 전체 RGBA 동일, 직접 계산 AFTER RGBA SHA20/20 receipt와 일치, first/repeat errors0. 봄8 모두 실제 픽셀 변화가 있다. 새3 source 모두 봄8 각각에서 request, decoded512×64, actual paint lineage를 확인했다. createPattern 생성만으로 draw라 주장한 것이 아니라 현재 capture harness의 actual paint lineage 목록이다. 다만 이는 최종 모든 픽셀의 가시성 증명은 아니다.

## 개별 원본 판정

| AFTER 원본 이름(.png) | 판정 | BEFORE 대비 다른 픽셀 | 관찰 |
|---|---|---:|---|
| field-x-spring-z1 | PASS | 53257 | 어두운 흙/작은 밝은 싹이 기존 밴드 위치에서 보임. 줄 방향과 외곽 접촉 유지. |
| field-x-spring-z06 | PASS | 19489 | 축소에서도 새 어두운 밴드 식별 가능. 개별 싹·접합 세부 판독 제한. |
| field-x-spring-z14-dpr1 | PASS | 103736 | 근접에서 흙 덩어리/작은 싹 확인. 외곽 bleed·새 잘림·반쪽 누락 없음. |
| field-x-spring-z1-dpr2 | PASS | 211296 | 1:1 추가 부분에서 고대비 흙 줄/작은 싹 확인. 새 직각 접합 틈 없음. |
| field-x-summer-z1 | PASS | 0 | 비봄 기존 표현 보존. 마른 풀 겹침은 기존 모습. |
| field-x-summer-z06 | PASS | 0 | 비봄 기존 표현 보존. 마른 풀 겹침은 기존 모습. |
| field-x-autumn-z1 | PASS | 0 | 비봄 기존 표현 보존. 낙엽 겹침/지면 patchiness 기존 모습. |
| field-x-autumn-z06 | PASS | 0 | 비봄 기존 표현 보존. 낙엽 겹침/지면 patchiness 기존 모습. |
| field-x-winter-z1 | PASS | 0 | 비봄 기존 표현 보존. 눈 이랑/눈·웅덩이 겹침은 기존 모습. |
| field-x-winter-z06 | PASS | 0 | 비봄 기존 표현 보존. 눈 이랑/눈·웅덩이 겹침은 기존 모습. |
| field-y-spring-z1 | PASS | 53329 | 어두운 흙/작은 밝은 싹이 기존 밴드 위치에서 보임. 줄 방향과 외곽 접촉 유지. |
| field-y-spring-z06 | PASS | 19298 | 축소에서도 새 어두운 밴드 식별 가능. 개별 싹·접합 세부 판독 제한. |
| field-y-spring-z14-dpr1 | PASS | 104599 | 근접에서 흙 덩어리/작은 싹 확인. 외곽 bleed·새 잘림·반쪽 누락 없음. |
| field-y-spring-z1-dpr2 | PASS | 211230 | 1:1 추가 부분에서 고대비 흙 줄/작은 싹 확인. 새 직각 접합 틈 없음. |
| field-y-summer-z1 | PASS | 0 | 비봄 기존 표현 보존. 마른 풀 겹침은 기존 모습. |
| field-y-summer-z06 | PASS | 0 | 비봄 기존 표현 보존. 마른 풀 겹침은 기존 모습. |
| field-y-autumn-z1 | PASS | 0 | 비봄 기존 표현 보존. 낙엽 겹침/지면 patchiness 기존 모습. |
| field-y-autumn-z06 | PASS | 0 | 비봄 기존 표현 보존. 낙엽 겹침/지면 patchiness 기존 모습. |
| field-y-winter-z1 | PASS | 0 | 비봄 기존 표현 보존. 눈 이랑/눈·웅덩이 겹침은 기존 모습. |
| field-y-winter-z06 | PASS | 0 | 비봄 기존 표현 보존. 눈 이랑/눈·웅덩이 겹침은 기존 모습. |


## 시각 판단과 한계

새 ploughed는 기존보다 더 어둡고 흙 덩어리 대비가 높고, seedling은 기존 길쭉한 녹색 표현보다 작은 밝은 잎 점으로 읽힌다. 두 변화가 지정된 밴드 안에 들어가며 x/y 이랑 방향·폭·지면 외곽을 유지한다. 봄3의 상세 질감 밀도는 옆 기존 성장/그루터기 밴드보다 높다. 이는 실제 보이는 SOURCE 특성으로 기록하지만 이 장면에서 형태 파괴나 설치 blocker로 판단하지 않았다. 작은 배율에서는 새 seedling A/B 개별 변형을 눈만으로 분리 식별할 수 없다. source3별 소비 증거와 합성 결과 관찰을 구분한다.

밭 위 흰 꽃/풀 덩어리, 계절별 낙엽/눈 패치 및 가는 주변 격자선은 BEFORE에도 있던 기존 표현이다. 이번 변화가 새로 만든 terrain leak이라고 분류하지 않는다. y 장면의 주변 숲 가림과 x 장면의 물/지도 가장자리 관계도 유지된다. 1.4와 DPR2 부분에서 새로운 단절·검은 투명도 사각형·틀어진 줄·클립 누락은 보이지 않았다.

repeat request/draw 배열은 captures schema에 저장되어 있지 않다. A/A20은 반복 이미지 안정성만 증명하며 반복 시 source의 request/paint 부재를 주장하지 않는다. first-open source 기록은 동반 JSON에 별도로 남겼다. 비봄12 RGBA0 역시 모든 preload가 없었다는 뜻이 아니다.

검토 범위는 안정화된 준비 상태20뷰와 동일 봄 baseline8이다. 자연 플레이·장시간 이동·load 실패 중간 프레임·모든 field shape/occlusion을 검증하지 않았다. 원격 실행/추가 캡처/제품/원본/공식 문서 편집 없이 이 보고서와 수치 JSON만 작성했다.
