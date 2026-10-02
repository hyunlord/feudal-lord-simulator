# 독립 눈가림 판독

**최종 16/28 = 57.1%, 목표80% 미달.** 전체 장면 첫 추측과 실제 픽셀 크롭 뒤 추측을 분리했다. 최종 회차는 두 지표가 모두16/28이지만 일부 문항의 정오가 서로 바뀌었다.

사건명·파일명을 가린 장면을 서로 독립된 새 모델 검수자에게 배정했다. 매 회차 줌1.0 담당과0.6 담당 각1명, 각14문항. 사건별 두 줌을 모두 포함하며 각 검수자에게 여름7/겨울7을 배정했다. 같은 사건의 같은 계절 두 줌을 한 사람이 비교한 시험은 아니다. 허용된14개 분류명과 unknown을 제공하되 답 중복을 허용했고, 한 종류씩 나온다고 추론하지 말라고 지시했다. 목표 점수는 검수자에게 주지 않았다.

전체 도시1600×1000을 먼저 보고, 그 뒤 확대하지 않은1:1 상세 크롭을 확인했다. 크롭 후 수치는 위치 찾기 부담을 줄인 보조 판독이다. 사람을 크게 그린 확대판으로 점수를 얻지 않았다. AI 검수자 소표본이며 실제 플레이어 사용성 통계가 아니다.

| 회차 | 줌 | 첫 추측 | 상세 후 | 비고 |
|---|---:|---:|---:|---|
| initial/A | 1 | 9/14 (64.3%) | 9/14 (64.3%) | 수정 전, 이전 그림 보존 |
| initial/B | 0.6 | 4/14 (28.6%) | 7/14 (50.0%) | 수정 전, 이전 그림 보존 |
| final/C | 1 | 11/14 (78.6%) | 11/14 (78.6%) | 최종 그림, 새 검수자 |
| final/D | 0.6 | 5/14 (35.7%) | 5/14 (35.7%) | 최종 그림, 새 검수자 |

## 수정과 해석

첫 상세 후16/28(57.1%)에서 마지막도16/28이다. 첫 전체 장면13/28(46.4%)에서 최종16/28(57.1%)로 달라졌지만, 검수자도 달라져 이를 수정의 인과 효과라고 단정할 수 없다. 장례·순례는 간격과 이동 문맥을 바꿨고, 구휼 줄과 징집 수레는 접지 문제를 고쳤다. 유리한 문항만 골라 재시험한 합산 점수가 아니라 매번14종 모두 시험했다.

- 줌0.6에서 세례·혼인·장례의 작은 소품과 의례 구별이 약하다. 무리가 보이는 것과 무슨 사건인지 아는 것은 다르다.
- 구휼 줄이 다른 대기/법정 무리로, 정기시 천막이 구휼 천막으로 혼동된다.
- 실제 이동 방향·행렬 간격·배급 동작·조종 소리·목적지 반응은 추후 엔진 연결에서 필요하며 이번 정지 합성으로 검증되지 않았다.
- SCENE_VERDICT의82/100은 명칭을 알고 본 미술·배치 정성 점수다. 맞힘률이 아니다.

## 문항별 원자료

| ID | 회차 | 정답 | 첫 추측 | 상세 후 | 정오 | 원본 장면 ID |
|---|---|---|---|---|---|---|
| A01 | initial | funeral | unknown | unknown | 틀림 | funeral-winter-z1.0 |
| A02 | initial | revolt | pilgrimage | revolt | 맞음 | revolt-summer-z1.0 |
| A03 | initial | wedding | wedding | wedding | 맞음 | wedding-summer-z1.0 |
| A04 | initial | famine | funeral | funeral | 틀림 | famine-winter-z1.0 |
| A05 | initial | flood | flood | flood | 맞음 | flood-summer-z1.0 |
| A06 | initial | levy | levy | levy | 맞음 | levy-winter-z1.0 |
| A07 | initial | market | market | market | 맞음 | market-winter-z1.0 |
| A08 | initial | fire | fire | fire | 맞음 | fire-winter-z1.0 |
| A09 | initial | royal_envoy | royal_envoy | royal_envoy | 맞음 | royal_envoy-summer-z1.0 |
| A10 | initial | pilgrimage | unknown | unknown | 틀림 | pilgrimage-winter-z1.0 |
| A11 | initial | fair | fair | unknown | 틀림 | fair-summer-z1.0 |
| A12 | initial | baptism | baptism | baptism | 맞음 | baptism-summer-z1.0 |
| A13 | initial | judgment | judgment | judgment | 맞음 | judgment-winter-z1.0 |
| A14 | initial | plague | market | market | 틀림 | plague-summer-z1.0 |
| B01 | initial | baptism | unknown | funeral | 틀림 | baptism-winter-z0.6 |
| B02 | initial | levy | levy | levy | 맞음 | levy-summer-z0.6 |
| B03 | initial | revolt | unknown | unknown | 틀림 | revolt-winter-z0.6 |
| B04 | initial | pilgrimage | unknown | unknown | 틀림 | pilgrimage-summer-z0.6 |
| B05 | initial | fair | plague | famine | 틀림 | fair-winter-z0.6 |
| B06 | initial | funeral | unknown | unknown | 틀림 | funeral-summer-z0.6 |
| B07 | initial | plague | market | plague | 맞음 | plague-winter-z0.6 |
| B08 | initial | famine | pilgrimage | pilgrimage | 틀림 | famine-summer-z0.6 |
| B09 | initial | wedding | unknown | wedding | 맞음 | wedding-winter-z0.6 |
| B10 | initial | judgment | revolt | revolt | 틀림 | judgment-summer-z0.6 |
| B11 | initial | royal_envoy | unknown | royal_envoy | 맞음 | royal_envoy-winter-z0.6 |
| B12 | initial | market | market | market | 맞음 | market-summer-z0.6 |
| B13 | initial | fire | fire | fire | 맞음 | fire-summer-z0.6 |
| B14 | initial | flood | flood | flood | 맞음 | flood-winter-z0.6 |
| C01 | final | funeral | funeral | funeral | 맞음 | funeral-winter-z1.0 |
| C02 | final | wedding | market | pilgrimage | 틀림 | wedding-summer-z1.0 |
| C03 | final | baptism | unknown | baptism | 맞음 | baptism-summer-z1.0 |
| C04 | final | levy | levy | levy | 맞음 | levy-winter-z1.0 |
| C05 | final | judgment | judgment | judgment | 맞음 | judgment-winter-z1.0 |
| C06 | final | famine | judgment | judgment | 틀림 | famine-winter-z1.0 |
| C07 | final | fire | fire | fire | 맞음 | fire-winter-z1.0 |
| C08 | final | market | market | market | 맞음 | market-winter-z1.0 |
| C09 | final | pilgrimage | pilgrimage | pilgrimage | 맞음 | pilgrimage-winter-z1.0 |
| C10 | final | royal_envoy | royal_envoy | royal_envoy | 맞음 | royal_envoy-summer-z1.0 |
| C11 | final | fair | fair | unknown | 틀림 | fair-summer-z1.0 |
| C12 | final | revolt | revolt | revolt | 맞음 | revolt-summer-z1.0 |
| C13 | final | flood | flood | flood | 맞음 | flood-summer-z1.0 |
| C14 | final | plague | plague | plague | 맞음 | plague-summer-z1.0 |
| D01 | final | funeral | unknown | unknown | 틀림 | funeral-summer-z0.6 |
| D02 | final | plague | unknown | funeral | 틀림 | plague-winter-z0.6 |
| D03 | final | levy | levy | levy | 맞음 | levy-summer-z0.6 |
| D04 | final | wedding | unknown | unknown | 틀림 | wedding-winter-z0.6 |
| D05 | final | market | market | market | 맞음 | market-summer-z0.6 |
| D06 | final | famine | royal_envoy | royal_envoy | 틀림 | famine-summer-z0.6 |
| D07 | final | judgment | revolt | revolt | 틀림 | judgment-summer-z0.6 |
| D08 | final | fair | famine | famine | 틀림 | fair-winter-z0.6 |
| D09 | final | baptism | unknown | unknown | 틀림 | baptism-winter-z0.6 |
| D10 | final | royal_envoy | unknown | unknown | 틀림 | royal_envoy-winter-z0.6 |
| D11 | final | pilgrimage | pilgrimage | pilgrimage | 맞음 | pilgrimage-summer-z0.6 |
| D12 | final | flood | flood | flood | 맞음 | flood-winter-z0.6 |
| D13 | final | revolt | unknown | plague | 틀림 | revolt-winter-z0.6 |
| D14 | final | fire | fire | fire | 맞음 | fire-summer-z0.6 |

정확한 검수 발언은 proofs/blind/*/RESULTS.json, 익명 제공 문항은 TRIALS.json, 해시는 proofs/blind/SCORES.json에 있다. 경량 ZIP의 중복 이미지 대응은 ARCHIVE_MAP.json으로 확인한다. 최초 전달 때는 익명 파일만 열도록 제한했으며, 정답 키는 채점 때 공개했다.
