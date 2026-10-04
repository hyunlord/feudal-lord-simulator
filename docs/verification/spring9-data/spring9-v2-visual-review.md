# Spring9 v2 독립 시각검토

판정: **PASS — 아래 10쌍에서 새 차단 결함을 관찰하지 못함.** 기존 반복 배치·계절 배경 차이는 NOTE로 남긴다. 이는 detached spring9 데이터 적용 캡처의 시각 판정이며 main 설치나 장부 완료 판정이 아니다.

## 검토 증거와 범위

- BEFORE 루트: `/Users/rexxa/fls-astra-renderB-season-prep/output/art-architecture/season-core-notify-v3`
- AFTER 루트: `/Users/rexxa/fls-astra-renderB-season-data/output/art-architecture/season-spring9-v2`
- 아래 파일명마다 두 루트의 원본 PNG를 `view_image`로 각각 직접 열었다. 합계 **20개 원본, 10쌍**이다. 접촉시트나 메타데이터만으로 눈 검토를 대신하지 않았다. 이미지 원본은 1280×800이며 파일에 기록된 각 zoom의 장면을 비교했다.
- 기계 근거: `.omo/evidence/spring9-v2-summary.json` (`astra-season-spring9-v2-ab67dcb`). 이 보고서의 오류/누락 없음, 재촬영 RGBA 동일, 9개 target 도달 결과를 참조한다. 새 브라우저 실행이나 테스트는 하지 않았다.
- 비교 identity는 **expectedRequests를 제외하고 동일**하다. 요청 목록까지 같은 full identity라고 표현하지 않는다. 공유 provenance 감사 스크립트의 수정과 product 1075개 불변은 해당 요약의 실행 경계다.

## 개별 원본 전후 검토

표의 파일명은 두 루트 모두에 존재하는 정확한 상대 경로다. 모든 행에서 BEFORE와 AFTER를 직접 열었다.

| 원본 파일명 | 판정 | 직접 본 결과 |
|---|---|---|
| `prepared-season-spring-z1.png` | PASS | 흰 꽃이 핀 작은 과수들이 같은 위치를 유지하며 AFTER 일부 수관에 녹색이 더 보인다. 큰 주변 나무와 과수의 상대 크기가 자연스럽고 뚜렷한 줄기 부유·검은 캔버스·필드 경계 이동은 보이지 않는다. |
| `prepared-season-spring-z06.png` | PASS / NOTE | 넓은 숲이 BEFORE의 올리브빛보다 밝은 연두색으로 바뀌어 봄 느낌이 강해진다. 숲의 배치·윤곽과 작은 과수원의 흰 꽃 덩어리는 유지된다. 규칙적인 숲 줄무늬/반복은 양쪽에 이미 있으며 밝은 수관 때문에 더 눈에 띄는 부분이 있다. 새 직사각형 chunk 절단선은 관찰하지 못했다. |
| `prepared-season-spring-z14.png` | PASS / NOTE | 꽃과 잎의 조합을 가까이 볼 수 있으며 눈에 띄는 pivot 이동이나 크기 불연속은 없다. 과수원 아래쪽은 양쪽 모두 화면 끝에서 잘린 동일 구도이고 수관의 경계 밖 돌출도 있다. 이 화면 밖 영역의 완전한 클립 검증은 할 수 없다. |
| `prepared-season-summer-z1.png` | PASS | 녹색 과수와 주변 나무, 지면 배치가 시각적으로 동일하다. 봄의 흰 꽃/밝은 수관 변화가 여름으로 새로 새어나온 흔적은 없다. |
| `prepared-season-summer-z06.png` | PASS / NOTE | 넓은 숲·작은 과수원·지면이 동일하게 보인다. 저배율의 촘촘한 숲 반복은 기존 상태다. 개별 수종의 세부 판독은 이 배율에서 제한된다. |
| `prepared-season-autumn-z1.png` | PASS / NOTE | 붉고 주황색인 주변 큰 나무와 노란 지면 흔적이 동일하다. 과수원의 녹색과 주변 가을 수관의 차이는 BEFORE에도 있다. 이번 데이터 변경의 새 회귀로 보지 않는다. |
| `prepared-season-autumn-z06.png` | PASS / NOTE | 넓은 가을 숲의 색·실루엣과 과수원 위치가 동일하다. 지면의 다이아몬드 격자/대각선 패턴과 규칙적 숲 배치는 양쪽에서 보이는 기존 표현이다. |
| `prepared-season-winter-z1.png` | PASS / NOTE | 잎 없는 과수와 주변 나무, 눈 및 푸른 지면 패치가 동일하다. 과수원 바탕의 녹색과 일부 초록 풀은 기존에도 존재한다. 새 봄 잎이 겨울에 유입된 모습은 없다. |
| `prepared-season-winter-z06.png` | PASS / NOTE | 겨울의 낮은 채도·앙상한 나무·눈 패치와 숲 배치가 동일하다. 작은 상록 요소는 기존 장면에 있다. 개별 나무를 모두 식별할 정도의 크기는 아니다. |
| `prepared-season-winter-z14.png` | PASS / NOTE | 가까운 겨울 과수의 맨가지와 줄기 위치가 동일하다. 아래 화면 끝의 과수원 잘림도 양쪽에서 동일하며 새 클립/스케일 문제를 보지 못했다. |

## 의도된 변화와 보존

기계 비교상 봄 3뷰는 각각 z1 **18,642**, z0.6 **100,186**, z1.4 **17,766**픽셀이 변했다. 이는 동일 화상 요구의 실패로 해석하지 않는다. 봄 나무/과수 교체라는 목적에 부합하는 변화가 직접 보였다. 여름 2·가을 2·겨울 3, 합계 **비봄 7뷰는 RGBA 차이 0**이라는 기존 보고서와 눈 비교가 일치한다. 10뷰 모두 반복 캡처 차이는 0이고 errors/missing은 빈 목록이다.

9 target URL은 아래와 같다. 이 목록의 실제 draw 도달은 실행 근거에서 확인된 범위이고, 육안으로 촘촘한 숲 속 9종을 각각 분리해 식별했다는 뜻은 아니다.

- `/assets/wave43/orchard/orchard_apple_spring.png`
- `/assets/wave43/orchard/orchard_pear_spring.png`
- `/assets/wave43/orchard/orchard_plum_spring.png`
- `/assets/wave43/trees_broadleaf/tree_birch_spring.png`
- `/assets/wave43/trees_broadleaf/tree_oak_large_spring.png`
- `/assets/wave43/trees_broadleaf/tree_oak_small_spring.png`
- `/assets/wave43/trees_other/tree_dead_spring.png`
- `/assets/wave43/trees_other/tree_pine_short_spring.png`
- `/assets/wave43/trees_other/tree_pine_tall_spring.png`

보이는 범위에서 기존 isometric 배치와 나무/과수의 상대 크기가 유지되고, 새 축 뒤집힘·수관 직사각형 잘림·지면과 분리된 줄기·뚜렷한 새 경계선은 관찰하지 못했다. 밝은 봄 수관과 흰 과수 꽃은 계절 교체로 읽힌다. 이를 엔진의 성장 단계 또는 새로운 수목 생장 사실의 증거로 사용하지 않는다.

## 판정 한계와 잔여 NOTE

- 정지 화면의 사람 눈 비교는 모든 픽셀, 정확한 pivot 수치, no-flip 계약, 모든 가림 관계를 증명하지 않는다. 특히 저배율에서 소나무/고사목 등의 개별 식별과 줄기 접지 판독은 제한된다.
- 봄·겨울만 z1.4가 포함된다. 별도 DPR2, 다른 지도/카메라/장면, 계절 전환 애니메이션, 로딩 과도 상태, 성능을 이 검토에서 시험하지 않았다.
- 숲의 정렬 반복, 가을에도 녹색인 과수원, 겨울 과수원 녹색 바탕, 화면 아래 잘림은 기존 화면과 함께 남긴 NOTE다. 승인 원본 재설계나 제품 수정 요청으로 확장하지 않는다.
- 변경 파일은 이 초안 한 개뿐이다. src/public/catalog/ledger/provenance/공식 문서 수정, 설치, 원격 실행은 하지 않았다.

기계 요약 파일 SHA-256: `347a30056be85248e0ce0b476f725c2f8b76e56b92863c9455b26fe3759b9398`.
