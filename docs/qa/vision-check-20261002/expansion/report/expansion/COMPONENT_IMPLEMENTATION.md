# 복합 그림 부분 계측 구현 기록

범위: 보조 도구만 변경. 게임 PNG·코드·동결 정답은 변경하지 않았다.

## 방법

- 원본 PNG를 직접 보고 의미 다각형을 주석했다. 자산 URL·SHA256·원본 크기로 결합하며 화면 좌표·장면 ID는 포함하지 않는다.
- source atlas crop 안에 물건 전체가 있을 때만 투영한다. 전체 부모 그림의 실제 RGB 오차로 원본/좌우반전 중 방향을 선택한다.
- 선택한 부분 다각형 내부의 실제 화면 픽셀 일치율을 다시 검사한다. 배경이나 옆 물건이 보인다는 이유만으로 가려진 물건을 측정하지 않는다.
- 같은 draw order/source에서 semantic component가 생성되면 부모 복합 그림은 크기 검사에서 제외한다. 수레 전체 높이, 빗물통의 배수홈통 높이를 물건 키로 중복 계산하지 않는다.
- 식별자에 연결되지 않은 /walkers-v2/ 성인도 source-crop 불투명 실루엣 높이로 기준에 포함한다. 전체 atlas 크기를 쓰지 않는다.

## 원본 목록

카탈로그 SHA256: `6ff50a160178839b6fb57acb4acfc6450f2d69cf8d9f0effe1a6957a7c1ed3ca`

6개 원본, 12개 부분: upright barrel 2 / sack 6 / cart-wheel 4.

| 원본 | 부분 수 | PNG SHA256 |
|---|---:|---|
| /assets/wave27/yards/yard_brewer_a.png | 2 | `f941617bd513ec9cef3cb502464e2fc2376ffb059b0c6d9fac859ac8a7318a3f` |
| /assets/wave27/yards/yard_miller_a.png | 2 | `c26a78aa8a9b18a3a8b219012ddb7466f4f7bea3edc77469cc6b592519b61386` |
| /assets/wave27/yards/yard_miller_b.png | 2 | `73cde80cfa36a17f2c826bd967d5d983f44cce5f4ce8968257364e49231cb248` |
| /assets/wave27/yards/yard_merchant_b.png | 1 | `695e80cdc7b175c2d1c33bb0dab34629100938a3dd282e89275d8060ea75d007` |
| /assets/runtime-actors-v1/cart_hand-v4.png | 4 | `e32522862491eb85317c089c61c291189837fd92042b8329b840d20e0e62f2e2` |
| /assets/wave27/yards/yard_rain_barrel.png | 1 | `fa4af6e584c9399beeaadde7e89e0e245f515e701ad74c964dca2fb96d0efca1` |

## 실제 캡처 확인

| 장면 | 부분 | 화면 상자 x,y,w,h | 판독 |
|---|---|---|---|
| exp-prenat1-city | upright brewer barrel | 853,455,27,34 | 반전된 복합 그림에서 세로 보관통만 추출 |
| exp-prenat1-city | open grain sack | 870,474,21,23 | 옆 곡물 포대 분리 |
| exp-seed4-middle | rain barrel body | 544,570,26,33 | 배수홈통 제외. human median 23.716px, ratio 1.3915 |
| exp-prenat1-city | 정상 손수레 wheel-3, draw order 881 | 707,753,6,10 | catalog 실제 추출. 기존 heuristic 0개. ratio 0.422로 정상범위 |

위 통·포대는 실제 runtime PNG의 frame 0과 source-crop·RGB를 비교했다. 정상 수레는 코드 지원만으로 간주하지 않고 추출과 비율 검사까지 실행했다. 여섯 검출기 최종 합산 점수는 전체 실행 METRICS 문서를 기준으로 한다.

## 한계와 기권

- 소스 의미 카탈로그를 가진 자산만 지원한다. PNG revision이 달라지면 SHA가 일치하지 않아 기권한다. 원본 의미 주석을 새로 검토해야 한다.
- mash tub, 젓는 막대가 있는 작업용 통, 옆으로 누운 통은 일반 upright cask 키 기준을 적용하지 않는다.
- source 자체에서 가려진 물건, atlas 경계에 잘린 물건, 화면 밖 또는 6px 미만 부분은 기권한다.
- 닫힌 갈색 목재 문은 현재 범용 dark-opening 추론의 대상이 아니다. exp-seed4-middle cottage-door FN을 남긴다. 무리한 색상 문턱 완화나 정답 수정은 하지 않았다.
- 정상 수레 표본은 손수레 한 종류의 실제 측정 검증이다. 모든 수레/소품의 재현율을 보장하지 않는다.

## 검증

pytest tests/test_scale.py tests/test_component_parts.py: 9 passed. 변경 Python 파일 Ruff, Basedpyright 오류 0. Mirror/crop/SHA/가림/unknown asset/opaque human height/부모 중복계측을 검증한다.
