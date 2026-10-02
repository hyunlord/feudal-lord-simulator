# 독립 익명 판독 결과

제작 참여 이력이 없는 별도 AI 검수자 두 명이 각 32개 그림을 봤다. 정답·파일명을 숨긴 접촉판의 원본 규격 그림만 사용했다. 사람 플레이어 조사도, 실제 도시 화면에서의 직업 판독률도 아니다. 정답과 익명 순서는 답안을 받기 전에 고정했다.

| 유형 | 맞힘/대상 | 맞힘률 |
|---|---:|---:|
| 직업 마당 (여름) | 19/21 | 90.5% |
| 새 집 앞 표지 | 19/20 | 95.0% |
| 거리 그림 표지 | 19/20 | 95.0% |
| 합계 | 57/61 | 93.4% |

목표 80%를 모든 유형에서 넘었다. 중립 지원 3개는 계획대로 위 분모에서 제외했으며, 별도 정확 분류는 **1/3**이었다. 서기 설비는 기관 지원으로, 구휼 탁자는 상인으로, 순회 수선함은 목수로 판정됐다. 64개 전체 의미 분류는 58/64=90.6%다. 중립 설비만으로 기관·순회 구분을 확정해서는 안 된다.

## 틀린 네 그림

| 익명 ID | 자산 | 정답 → 판정 | 관찰된 혼동 |
|---|---|---|---|
| R001 | street_brewer | 양조 → 직조 | 통·교차 패들이 직물/빗처럼 보임 |
| R003 | yard_warehouse_shop_b_summer | 포도주 → 양조 | 술통만으로 술 종류 구분 어려움 |
| R012 | yard_large_yard_a_summer | 여관 → 무두 | 안장을 가죽, 여물통을 처리 통으로 읽음 |
| R021 | front_shoemaker_b | 구두장이 → 무두 | 걸린 신발·골을 펼친 가죽처럼 읽음 |

사후 정답에 맞춰 점수를 고치지 않았다. 판독 원문은 review/answers-a.json, review/answers-b.json이며 전체 표는 recognition.csv다.

## 지붕 수정 후 별도 재판독

첫 판독 뒤 대장간 A/B의 천 지붕을 단단한 기와 지붕으로 수정했다. 첫 입력판 8장과 SHA, 수정 전 여름 대장간 PNG 두 장을 보존했다. 새 검수자는 바뀐 여름 두 장만 별도 익명 판독했고 **2/2 대장**으로 맞혔다. 이를 최초 61개 판독에 추가해 분모를 부풀리지 않는다. 최신 겨울판은 계절·형태 보존 검수 대상이며 별도 직업 점수에 넣지 않는다.

최초 점수·그림 해시는 review/SCORED_RESULTS.json, review/BLIND_INPUT_HASHES.json, review/BLIND_INPUT_ASSETS.json에 있다. 지붕 수정 입력·정답·응답은 review/blind/roof-revision.jpg, review/ROOF_REVISION_KEY.json, review/roof-revision-answers.json이다.

겨울 B의 상단 조각 제거 후 공통 계절 경계상자가 달라져 여름 B의 정규화 픽셀도 소폭 바뀌었다. 최종 등록 이미지 한 장을 새 익명 검수자에게 다시 제시해 **1/1 대장**으로 확인했다. 이 확인은 새 표본으로 합산하지 않는다. 입력은 review/blind/final-registration.jpg, 정답과 답안은 review/FINAL_REGISTRATION_KEY.json 및 review/final-registration-answer.json이다.
