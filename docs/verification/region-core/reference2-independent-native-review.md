# REGION reference2 독립 native 검토

**PASS — chalk_downs 여름/겨울 zoom.6의 안정화 BEFORE/CORE 화면 동등성 수락.** 기존18뷰와 그 검토 문서는 변경하지 않았다. 이번 추가2뷰는 DATA4 적용이나 미래20뷰 수락이 아니다.

BEFORE `fd68f124cf6f8f0b60e6c05049cd03cfc6b817b5`, CORE `442b71822c189a245877cc1da1af86831e19448a`. 카메라(37,19), DPR1,1280×800의 각 여름·겨울 BEFORE/CORE 원본 **4장을 각각 개별 열람**했다. 경로·PNG/RGBA SHA와 개별열람 표시를 JSON에 기록했다.

- 여름 BEFORE 및 CORE: 비·물웅덩이 아래 올리브 fill, 강굽이, 갈색 heath 섬, 암반 및 지도 모서리가 동일하다. 새 빈 영역, 사각 이미지 누출, 반복 이음의 이동은 보이지 않는다.
- 겨울 BEFORE 및 CORE: 밝은 겨울 입자, 갈색 섬 대비, 눈·나목과 지도 끝의 모습이 동일하다. baseline의 선명한 지형 경계와 grain은 남지만 신규 회귀로 분류하지 않는다.

직접 원본4+각 repeat4의 **PNG8장을 RGBA decode**하여 fullRGBA2쌍 및 A/A4쌍 완전동일을 확인했다. raw captures.json의 fullidentity2 동일, errors/repeatErrors0, stable/AA PASS와 receipt RGBA SHA도 대조했다. 예상 source URL-뷰8쌍의 first-open request/decode/paint lineage를 raw 배열에서 확인했다. count8은 BEFORE/CORE 양쪽을 합한 수이며 서로 다른 PNG8개가 아니다.

실행 영수증은 BEFORE 입력26928/export26929, CORE 입력26949/export26950, 양쪽 remote pre/post guard 및 localpost 불변 PASS를 기록한다. 이번 별도 검토에서는 전수 입력 재해시나 원격 명령을 반복하지 않았다. 보존된 run/guard 증거를 인정한 범위와 직접 수행한 PNG/raw capture 검산을 구분한다.

수락은 이 고정 source·실제2뷰의 안정화 출력에 한정한다. cold-loading 타이밍, DATA4 설치/선택/성공 optional paint, future HEAD/본선 적용은 미검증이다. 향후 DATA20의 spring8 expected URL은 실제 DATA selector에 맞춰 별도 검증해야 한다. 이 비봄2뷰는 기존 A/B 유지 비교 기준선이다. paint lineage는 개별 texel 귀속을 증명하지 않으며 repeat 상세 source 배열은 미보관이므로 repeat lineage를 독립 확인했다는 주장을 하지 않는다.

산출은 본 MD/JSON뿐. 기존18 검토·제품·fixture·공식 문서 변경, remote·commit 실행 없음.
