# R04 보충 실험 분석
검증: 정확한 파일 집합·스케줄·ID·소스/작업/결과 해시·gzip 읽기. 전체 시뮬레이션 재실행을 뜻하지 않는다.

## growth

625개 원자료 확인. 소스 해시: 4d2b139cc08ea0618e64442abd6d782dbc71e25b27d9a2e309d1ef208082762a. 결과는 growth-analysis.json.

1,875시점, 각 전략/지형/시점5seed. 정책0 대비 시설구성 차이가 있는 행 1800. 50/50 이름 무관 일치: true. 구성·경제·공간의 원자료와 함께 판단한다.

## challenge

2160개 원자료 확인. 소스 해시: 4d2b139cc08ea0618e64442abd6d782dbc71e25b27d9a2e309d1ef208082762a. 결과는 challenge-analysis.json.

| 도전자 | 경기 | 승점률 | 탐색95%구간 | 분류 |
|---|---:|---:|---|---|
| adaptive-shortage | 720 | 82.78% | 80.56–84.58% | risk |
| continuous-1 | 720 | 67.78% | 65.00–70.56% | risk |
| continuous-2 | 720 | 82.01% | 80.69–83.47% | risk |

6개 seed 군집의 탐색 구간이다. 지배전략 부재 증명이 아니다. BASE-only 리그와 상대 모집단이 다르다.

## diplomacy

400개 원자료 확인. 소스 해시: 4d2b139cc08ea0618e64442abd6d782dbc71e25b27d9a2e309d1ef208082762a. 결과는 diplomacy-analysis.json.

ON/OFF 200짝. 제안 27, 수락 27, 거부 0, 실제 피한 출정 101. ON−OFF 총 약탈 -105, 평균 종료가치 차이 3.45. 명시 사절/운송 비용 150. 명목 순흐름은 후생/ROI가 아니다.

## geometry

5개 원자료 확인. 소스 해시: 4d2b139cc08ea0618e64442abd6d782dbc71e25b27d9a2e309d1ef208082762a. 결과는 geometry-analysis.json.

5개 통제 묶음 전체 인과 조건: true. 합성 평지 시험이며 자연 도시의 평균 효과가 아니다.
