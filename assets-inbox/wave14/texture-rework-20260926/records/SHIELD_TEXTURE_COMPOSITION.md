# 방패 표면 재작업 합성 계약

## 납품 2장
- shield_surface_texture_multiply.png: 256×256 RGBA, 흰색 중립점. 아래쪽 그늘·붓질·표면 결·가장자리 마모.
- shield_surface_texture_screen.png: 256×256 RGBA, 검정 중립점. 위·좌상단 광택·긁힌 결·마모의 밝은 면.
- 두 장은 **불투명 blend 데이터**다. 투명도가 강도를 결정하는 source-over 장식이 아니다. RGB는 무채색이며 기존 코드 색을 덮어쓴 새 팔레트가 아니다.

## 순서와 수식
1. 기존 방패 채움/분할/ordinary/charge를 기존 색으로 합성한다. 구형 shield_surface_texture.png는 쓰지 않는다.
2. 방패 채움 영역의 행별 좌·우 경계를 l(y), r(y), 전체 위·아래를 ymin/ymax로 구한다. u=(x−l)/(r−l), v=(y−ymin)/(ymax−ymin). 256² 질감을 u/v로 bilinear sampling한다. 세 방패 형태 모두 같은 두 자산만 쓴다. 아래 끝의 수렴은 기하 형태를 따라간다.
3. RGB를 0~1로 두고 M=multiply gray, S=screen gray:
   - dark = C × (0.20 + 0.80 × M)
   - result = 1 − (1−dark) × (1−0.48 × S)
4. 결과는 기존 fill coverage에만 적용한다. 검은 원본 outline과 원본 silhouette alpha는 보존한다. 질감 RGB를 바깥에 source-over 하지 않는다.
5. 위 합성은 sRGB 수치 공간에서 수행했다. 다른 색공간에서 그대로 같은 외관이라고 가정하지 않는다.

## 측정과 검수
- 동일 seed140926, 동일 24조합·색·charge·ordinary. 조합 명세는 references/original-wave14/heraldry-combinations.json 원본.
- 실제 시각 차이: 채움 RGB 평균 절대 차이 13.56~18.97/255. 기존 거의 투명한 레이어처럼 alpha만으로 효과를 주장하지 않는다.
- 모든 조합 외곽 alpha 차이 0픽셀. 질감에 의해 배경이 하얗게 새는 fringe 없음.
- proofs/01-heraldry-textured.png: 24개 모두 256px와96px, 어둡고 밝은 배경 번갈아 확인.
- records/shield-before-after.png: 앞6개 원본/수정본을 각각256px·96px로 나란히 표시.
- 내부 시각 판정: 24조합의 식별 유지, 96px에서도 위쪽 빛과 아래쪽 그늘 및 페인트 결이 읽힘. 256px에서 분할선 이음·외곽 밝은 halo 없음. 매우 미세한 붓털 결은96px에서 합쳐지지만 넓은 붓질은 남음.
- 후보 납품이며 제품 설치·게임 내 검증 없음. 표현 승인은 사용자 검수 대상.

## 재현
records/shield-rework.cjs가 PNG 변환, 실제 blend, 조합 증빙, 수치 측정을 재생성한다. 프로젝트 참조 집 1장만 imagegen 입력으로 사용했고 실존 문장은 입력하지 않았다. 각 자산별 실제 프롬프트와 생성 원본을 보존했다.
