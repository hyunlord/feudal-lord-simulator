# 문장 레이어 합성 계약

- 후보22장: 방패3 + 분할10 + ordinary8 + 표면1. charge12는 별도 제작 묶음.
- 방패PNG 한 장에 흰 채움/검은 외곽선/투명 외부를 함께 보존한다. `silhouette = alpha`, `fill = alpha × luminance`, `outline = silhouette − fill`로 분리한다. RGB를 알파로 착각하지 않는다.
- 일반 분할·ordinary의 RGB는 흰색이고 alpha가 coverage다. 분할 양면은 같은 마스크로 `m`, `1−m`을 계산한다. 두 번째 경계를 별도 래스터화하거나 두 반투명 면을 source-over 하지 않는다.
- 원하는 RGB를 먼저 입힌 뒤 합성한다. 전체 내부를 채우고 외곽 알파는 방패 원본과 동일하게 남긴다. 투명 흰색 RGB 자체를 색으로 섞지 않는다.
- **bordure만 정규화된 방패UV 좌표**다. 네모 테두리 모양의 마스크를 그대로 겹치면 안 된다. `heraldry-bordure.cjs:mapBordure`가 각 방패 채움의 행별 좌우 범위를U, 전체 높이를V로 삼아 bilinear sampling한다. 3방패 모두 측면 끊김0. 이 방식은 형태가 바뀌어도 하나의 테두리 마스크로 둘레를 이어 준다. 테두리 폭은 광학적 고정px이 아닌 형상비례다.
- 표면은 실제imagegen 결과를256px, grayscale, alpha×0.13으로 줄인 별도 투명 오버레이다. 채움에만 clip한다.
- 확인 그림1은 seed140926 셔플24개이며 두 색계열 바탕 위 금/은 도형을 쓴다. 선택된 chief도 납품마스크 alpha를 실제 읽는다. 8개ordinary 전종×3방패 합성은 `ordinary-three-shield-matrix.png`에 추가 검수했다.
- 실존 문장 이미지는 참조하지 않았다. 조합은 새로 생성했으며 전 역사 문장 데이터베이스와의 우연한 일치까지 전수 검사했다는 뜻은 아니다.
- 제품 렌더러 설치·런타임 검증은 하지 않았다.
