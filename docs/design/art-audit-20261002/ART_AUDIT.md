# ART_AUDIT — 설치 미술 일관성 전수 감사

> 원본: Astra ART_AUDIT.md(sha256 22f3673bbbd7c1c524f039cd61e7fdd101191d842f31dbe7b7acfc75f10d2d5c), 링크 경로만 저장소에 맞게 고침(ART_BIBLE_v2.md → ../art-bible.md).

2026-10-02 · 검토만 · 그림 생성/설치/삭제·게임 코드 수정 없음

## 결과와 우선순위

설치 대장의 **2,216개 이미지 전부를 종류별로 나란히 놓고 시각 검토**했다. 가장 먼저 고칠 것은 **실제 영주관의 임시 도형 표시**, **상태 오버레이의 본체 정합**, **기존 기본 집 문과 성인 표시 키의 비율**이다. 이후 재료·질감·UI 행동 위계와 시대 규약 충돌을 정리한다.

이슈/기준 정리 **27개 묶음**: P1 2, P2 15, P3 10. 고유 설치 이미지 **91개**가 목록에 연결된다. **이는 전부 불량 이미지라는 뜻이 아니다.** 여기에는 승인 Pool3 9장의 예외 기록, 나무 반전 코드 위험, 계절 원인 미확정 자산이 포함된다. 그림별 전체 경로는 아래 각 항목과 `findings.csv`, 전수 규격·검토 방식은 `inventory.csv`·`coverage.json`에 있다.

- **P1:** 현재 화면에서 이질감이 크거나 레이어의 본체 등록이 깨지는 문제. 우선 처리.
- **P2:** 재료·비율·행동 위계·규약의 분명한 차이, 또는 근거 있는 코드 위험. 원본/표시/승인 문제를 나누어 해결.
- **P3:** 국소적인 묘사 편차·보수적인 개선 권고·승인 예외 정리. 자동 폐기하지 않음.

## 감사 기준점과 실제 설치 범위

- 실제 감사 소스: `/Users/rexxa/github/fls-landui`, branch `claude/landui`, HEAD `10678bb94b85be2bbec9e705e9d1eb0a007f34af`.
- 처음 열린 `galeocerdo`는 오래된 아트 브랜치이며 최신 설치 대장이 없어 기준에서 제외했다. 기존53692 preview는 삭제된 임시 build 디렉터리를 가리켜 소스 계보를 입증할 수 없었다. 별도 **동일 HEAD 소스 서버53791**을 띄워 실제 Chrome에서 감사했다. 기존 실행 서버의 배포물을 확인했다는 주장은 하지 않는다.
- 대장 `docs/provenance/assets.csv`: 전체2,245행 중 runtime2,216행, retired29행 제외. public 이미지1,454개와 빌드 때 JPEG 등으로 변환되는 assets-inbox 원본762개를 포함한다. inbox라는 폴더 이름만으로 미설치 후보로 제외하지 않았다. `usedIn`을 각 행에 보존했다.
- 전체2,216개 파일 존재·디코딩·원본 SHA256과 ledger 해시 일치. 파일 이미지 원본 합계303,951,040bytes. 완전 투명 이미지0. 이 수치는 미술 품질 통과가 아니라 범위·무결성 증거다.
- 의뢰 예시의 **영주관 B는 현재 runtime 대장에 없음**. `assets-inbox/endings-manors/.../manors/manor_house_b_empty-v1.png` 및 `manor-b-rework-20260930/.../manor_house_b_empty-v2.png`는 후보이므로 설치 그림 결함 목록에 억지로 넣지 않았다. 실제 영주관 도형 문제는 RUN-01로 별도 기록한다. 이전 Wave38/40 후보도 미설치여서 이번 설치 전수에 포함하지 않는다.

## 검토 방식과 증거의 한계

| 구역 | 개수 | 시각 검토 |
|---|---:|---|
| 건물·합필·곡창·시설 |437|400px셀22개 비교판 전부, 의심35장 개별 원본, 상태6조합 원좌표 합성, 문2개 측정|
| 환경·워커·동물·수레·지면·물·날씨 |758|320px셀32개 비교판 전부, 의심17장 개별, Wave29 물14시트 모든 프레임 합성, 기존집+상태18개 추가 합성|
| UI·문장·삽화 |391|400px셀20개 비교판 전부, 의심10장 원본, 버튼9-slice 비교·RGB측정|
| 초상·계보 |630|256px셀21개 비교판 전부, 실제 서버96×96JPEG630개 전수 HTTP/치수·시각 검토7판|

각 비교판의 각 셀을 검토했으며 **2,216장 모두 원본1:1 확대·모든 애니메이션·게임 내 모든 상태를 개별 재현한 감사는 아니다.** 원본 추가 확인과 비교판 검토를 coverage에서 구별한다. 기존집 Wave7 boarded/snow 및 Wave9 fire/plague18개는 해당 기본 집에서 대체로 정합했다. Wave26/30/32의 정합 문제를 모든 overlay에 일반화하지 않는다.

실제 저장 한 장면을 세 줌으로 확인했다. 초상·UI는 월드 줌이 아니라 실제 표시 크기로 판정한다. 비 없는 겨울 장면이라 **빗방울/사람 비율의 실화면 실측은 미검증**이다. 강수는 screen-space라는 코드만 확인했다. 전 계절·건물·사건 UI의 모든 런타임 조합, 성능·전체 회귀는 감사 범위에서 실행하지 않았다. 미술적 시대 검토는 전문가 고증 인증이 아니다.

경량 ZIP에는 요청한 축별 JPEG7장, 원본 게임 캡처3장과 전수 경로/검토 기록을 넣고 원본304MB와 중간 비교판102장을 중복 넣지 않았다. 원본별 판독판·확대 증거는 로컬 `/tmp/astra-art-audit-20261002/review/`에 보존했다. 패키지 JPEG는 대표 문제를 보여 주며 단독으로 전수 판독을 대체하지 않는다.

## 일곱 축 요약

| 축 | 결론 | JPEG |
|---|---|---|
|1 크기 비율|L0/L1 문 약12.5/12.0world px 대 명목 성인17.6; 상태6조합 등록 불일치|[axis01](evidence/axis01-proportion.jpg)|
|2 빛 방향|명확한 반대 주광 원본은 확정0; tree_oak_large flipX는 조명도 반전시키는 코드 위험. 실내 삽화/평면UI는 별도 규칙|[axis02](evidence/axis02-light.jpg)|
|3 재료 색|목재 교대 청록 가장자리, 물 베이스 차이, 주/보조 버튼 바탕 동일; 실측5색표|[axis03](evidence/axis03-material-color.jpg)|
|4 외곽선|legacy 시설, 닭A·군중·길드홀 연기와 회화 자산 경계 밀도 차이|[axis04](evidence/axis04-outline.jpg)|
|5 질감·해상도|건초·과수·울타리의 매끈한 면과 후속 섬유/잎결 차이; 일부 과밀 질감. 업스케일 원인 단정 없음|[axis05](evidence/axis05-texture.jpg)|
|6 시대 고증|일반 주택 굴뚝/통·담비는 프로젝트 규약 충돌. 옷 색만으로 시대 오류 판정하지 않음|[axis06](evidence/axis06-period.jpg)|
|7 세 줌|동일 실제 상태/중심의0.5·1.0·1.4. 영주관 도형·겨울 눈 차이, 저줌의 상대 인물 확대 확인|[axis07](evidence/axis07-three-zooms.jpg)|

## 실제 게임 세 줌

Mac 실제 headed Chrome154.0.8037.58,1440×960,DPR1. `fixtures/saves/v41/population-176.save.json`을 격리 브라우저 저장소에 넣고 제품의 **이어하기**로 로드했다.1306년 겨울, 인구176,tick27471,일시정지. 건물·날씨·인구를 조작하지 않았다. 카메라만 브라우저 응답에 임시 진단 setter를 넣어 정확히0.5/1.0/1.4로 바꿨고 저장소 소스 수정은 없다. 중심 `(128,1413.5)` 고정.

세 캡처의 전체 게임 상태 SHA256은 모두 `ce256ccdae5ff886603c4566657b70f73fe1cacb5e9dc3ea6acc0f7feaa65b5a`. 벽시계 기반 바람/연기/물결의 프레젠테이션 애니메이션은 정지하지 않았다. HTTP public 이미지864개는 디스크와 바이트 일치, 가상 파생본9개는 실제 빌더 출력과 일치했다. 초상96px630개도 별도실화면규격으로 검토했다. 상세는 `evidence/runtime.json`, `evidence/runtime-observations.md`, `evidence/render-contracts.md`.

사람 키는 코드상 줌0.5/1.0/1.4에서14.08/17.6/24.64px.0.5에서는0.8 최소 읽기 배율로 상대적으로1.6배 커진다. 숲 가장자리도 코드0.72/0.8 및0.80–1.15변이 영향을 받으므로 원본 PNG 크기 차이만으로 나무 불량을 선언하지 않는다. 지붕 위 경고핀/링의 저줌 우세는 그림 파일 오류와 UI표시 규칙을 분리해 본다.

## 어긋난 그림과 해결 방법

경로는 위 소스 루트 기준이다. 동일 파일에 여러 축 문제가 있으면 항목이 중복될 수 있다. 원본에 손대기 전에 연결/파생/승인 문제인지 구분한다.

### BLD-06 · P1 · 상태 레이어와 본체 정합 불일치

**축:** 크기 비율 · 질감·해상도 · **방법:** 코드·표시/메타데이터 보정

동일 캔버스 원좌표 합성에서 fresh는 축소된 별도 건물의 목골·처마가 본체 중앙에 이중으로 생기고, snow의 지붕 선과 granary 마모 구조도 본체와 맞지 않는다. Wave26/30은 본체와 같은 crop/target, Wave32는 같은160×144 canvas/rect를 사용하며 레이어별 bbox 자동 정렬이 없음을 코드로 확인했다. 작은 알파 면적 자체가 아니라 실제 구조선 불일치를 판정했다. 6개 상태를 실제 게임에서 각각 발동한 증거는 아니며 합성과 렌더 계약을 결합한 발견이다.

**고칠 방법:** 코드/파생 파이프라인에서 base와 overlay의 crop·scale·pivot을 공동 변환해 다시 산출한다. 원본 레이어 형상이 이미 다르면 해당 레이어만 다시 그림. 독립 bbox-fit으로 강제 확대하지 않는다.

**확실성:** 높음: 합성+렌더 계약; 실제 6상태 발동 미재현.

**대상 경로:**

- `public/assets/wave26/house/house_l0_c_fresh.png`
- `public/assets/wave26/house/house_l3_c_fresh.png`
- `public/assets/wave26/house/house_l4_c_fresh.png`
- `public/assets/wave30/house_pair/house_pair_l2_horizontal_c_snow.png`
- `public/assets/wave30/house_pair/house_pair_l4_horizontal_e_snow.png`
- `public/assets/wave32/granary/granary_b_weathered.png`

### RUN-01 · P1 · 실제 영주관의 임시 도형 표시

**축:** 외곽선 · 질감·해상도 · 세 줌 · **방법:** 코드·표시/메타데이터 보정

실제 동일 저장의 세 줌 모두 manor-house-34-41-0(영주관)이 크림색 다각형+짙은 선의 임시 도형으로 표시된다. 주변 회화 건물과 화풍이 극단적으로 다르다. runtime 대장에 manor 그림은 없고 inbox 후보만 있다. catalog의 설치 예정 주석을 설치 완료 증거로 취급하지 않았다.

**고칠 방법:** 승인된 영주관 자산의 실제 sprite 연결·등록·fallback 경로를 보정한다. 미승인 inbox 후보를 감사 중 자동 설치하지 않는다.

**확실성:** 높음: 실제 세 줌; 연결 누락 원인 세부는 후속 구현에서 확인.

**대상 경로:**

- `src/render/buildingSprites.ts`
- `src/content/buildingCatalog.ts`

### BLD-01 · P2 · 옛 평면 시설과 완성 회화 시설 혼재

**축:** 외곽선 · 질감·해상도 · 색 · **방법:** 버림(참조 확인 후)

7개 legacy 시설은 큰 단색 면, 날카로운 검은 계단형 경계, 단순한 도형으로 구성된다. church-v2/keep-v2 등 석재·목재 질감이 있는 완성 자산과 나란히 놓으면 그래픽 언어가 명확히 다르다. 설치 파일의 차이이며 현재 정상 렌더에서 모두 보인다는 뜻은 아니다.

**고칠 방법:** 실제 참조·fallback 경로를 확인한 뒤 사용하지 않는 legacy는 런타임 패키지에서 제외. fallback이 필요하면 승인된 완성 자산으로 매핑한다. 이번 감사는 삭제/코드변경하지 않았다.

**확실성:** high.

**대상 경로:**

- `public/assets/buildings/church.png`
- `public/assets/buildings/keep.png`
- `public/assets/buildings/market.png`
- `public/assets/buildings/masonry.png`
- `public/assets/buildings/mill.png`
- `public/assets/buildings/quarry.png`
- `public/assets/buildings/stone_wall_segment.png`

### BLD-02 · P2 · 교대의 청록 가장자리

**축:** 색 · 외곽선 · **방법:** 다시 그림

NE_A 교대의 앞쪽 긴 판재 하단, NW_A의 우측 긴 하단에 목재·돌 팔레트와 분리되는 청록색 가장자리 선이 보인다. 각 원본256×192에서 관측했으며 어두운 목재 그림자와 색상이 다르다.

**고칠 방법:** 원본의 청록 가장자리 오염을 제거하고 주위 목재 그림자색으로 재작업. 반사광 의도라면 네 방향 전체에 같은 팔레트·강도로 정의해야 한다.

**확실성:** high.

**대상 경로:**

- `public/assets/module/bridge_abutment_ne_a-v1.png`
- `public/assets/module/bridge_abutment_nw_a-v1.png`

### BLD-03 · P2 · 교대 방향별 목재 질감 차이

**축:** 질감·해상도 · 색 · **방법:** 다시 그림

같은 bridge_abutment 계열인데 NE_A/NW_A/SE_A는 넓고 매끈한 베이지 판재와 뭉개진 흙 덩어리이고 SW_A/NW_B는 판재 결·못·모서리 마모가 명확하다. 방향이 바뀌면서 같은 목재의 묘사 밀도가 바뀐다.

**고칠 방법:** 승인 기준 하나를 선택해 판재 결 밀도·암부 대비·가장자리 마모를 방향별로 맞춘다. 전역 sharpen만으로 서로 다른 묘사 방식은 복구되지 않는다.

**확실성:** high.

**대상 경로:**

- `public/assets/module/bridge_abutment_ne_a-v1.png`
- `public/assets/module/bridge_abutment_nw_a-v1.png`
- `public/assets/module/bridge_abutment_se_a-v1.png`

### BLD-04 · P2 · 길드홀 연기의 닫힌 만화 외곽선

**축:** 외곽선 · 질감·해상도 · **방법:** 다시 그림

길드홀 active의 상단 연기는 검은 회색 윤곽선으로 닫힌 소용돌이 구름이다. 같은 게임의 effect_smoke-v1은 경계가 퍼지는 가는 반투명 연기이므로 효과만 만화식으로 튄다. 바닥/작업대만 남은 나머지 투명 부분은 overlay 의미여서 결함으로 세지 않았다.

**고칠 방법:** active 연기를 기존 얇은 연기 계열의 알파·형태·농도에 맞춘다. 효과만 교체하고 건물·작업대 피벗을 보존한다.

**확실성:** high.

**대상 경로:**

- `public/assets/wave12/bld/guildhall-active-v1.png`

### BLD-07 · P2 · 성인 표시 키보다 낮은 문

**축:** 크기 비율 · **방법:** 코드·표시/메타데이터 보정

L0 문 약25±2px, L1 약24±2px를 파생 PNG에서 수동 측정했다. 실제 alpha crop 폭112.73684/112.95136px에 world폭56.32px를 적용하면 문 높이는12.490±0.999 /11.967±0.997world px다. walkerComposer가 세로 figureHeight를 명목17.6world px로 정규화하므로 문/성인 비는0.710/0.680이다. 성인 전원의 알파 실루엣을 실화면에서 실측했다는 뜻은 아니며 Wave26 변형에 이 수치를 일반화하지 않는다.

**고칠 방법:** 코드의 사람/문 크기 기준을 함께 검토한다. 저줌 사람 최소 크기 보정과 기본 집 문 비율을 별도 해결한다. 전체 집 확대가 필지와 충돌하면 문·층고를 그림에서 재작업한다.

**확실성:** 높음: 수동측정±2원본px+코드 환산.

**대상 경로:**

- `public/assets/buildings/historical-houses/house_l0-v3.png`
- `public/assets/buildings/historical-houses/house_l1-v2.png`

### ENV-01 · P2 · 매끈한 건초 더미

**축:** 질감 · 재료 색 · **방법:** 다시 그림

건초 더미 여섯 장의 표면이 큰 황금색 그라데이션 덩어리이고 풀줄기/엉킨 섬유/불규칙한 끝이 없다. Wave28 haystack의 줄기 질감과 직접 충돌한다.

**고칠 방법:** 실루엣과 크기 계약을 유지하고 건초 섬유 및 끊긴 가장자리만 재작업. 균일한 매끈한 음영을 풀 다발 중간 덩어리로 바꾼다.

**확실성:** high.

**대상 경로:**

- `public/assets/zones/haycock_a-v1.png`
- `public/assets/zones/haycock_b-v1.png`
- `public/assets/zones/haycock_c-v1.png`
- `public/assets/zones/haycock_d-v1.png`
- `public/assets/zones/haycock_e-v1.png`
- `public/assets/zones/haycock_f-v1.png`

### ENV-02 · P2 · 구름 모양 과수 수관

**축:** 질감 · 외곽선 · **방법:** 다시 그림

기존 과수 네 장은 둥근 구름 모양 수관의 매끈한 면이 크게 남는다. 비교 기준인 Wave28 oak_solitary_summer의 작은 잎덩어리와 불규칙한 가장자리보다 질감 밀도가 낮다. 후속 orchard g/h도 같은 둥근 수관 계열이므로 그것을 통일 기준이나 명확한 반례로 삼지 않는다.

**고칠 방법:** 수관 실루엣/피벗은 유지하되 Wave28 oak의 잎덩어리 크기와 가장자리 질감 밀도를 참고하여 조정한다. 과수 종의 차이는 보존한다.

**확실성:** high.

**대상 경로:**

- `public/assets/zones/orchard_apple_c-v1.png`
- `public/assets/zones/orchard_apple_d-v1.png`
- `public/assets/zones/orchard_pear_e-v1.png`
- `public/assets/zones/orchard_plum_f-v1.png`

### ENV-03 · P2 · 구형 물의 높은 대비와 청록색

**축:** 재료 색 · 질감 · 외곽선 · **방법:** 코드·표시/메타데이터 보정

밝은 청록 바탕 위에 거의 일정 굵기의 흰색·진청색 물결 선이 빽빽하다. shore/shallow 및 water/deep는 낮은 대비의 흐린 청회색 면, Wave29는 저알파 파문이라 동일 물 재질의 묘사 밀도가 다르다.

**고칠 방법:** 사용처에서 신형 저대비 물 베이스로 매핑을 통일하고 구형 fallback 필요 여부를 확인한다. 원본 유지가 필요하면 단독 재작업. 실행 경로마다 실제로 보이는 빈도는 미확인.

**확실성:** high.

**대상 경로:**

- `public/assets/terrain/water.png`

### ENV-04 · P2 · 울타리 모듈의 다른 목재 표현

**축:** 질감 · 재료 색 · **방법:** 다시 그림

hurdle_straight와 end_corner는 나무결/기둥 접합이 없는 큰 황토색 평면과 날카로운 사각 끝이다. 같은 hurdle 계열 gate/half/corner는 밝은 나무결과 둥글게 마모된 기둥이라 연결 부위 재질이 서로 다르다.

**고칠 방법:** 동일 울타리 세트의 기둥 단면, 목재 중간값, 나무결 밀도에 맞춰 두 모듈을 재작업한다.

**확실성:** high.

**대상 경로:**

- `public/assets/yards/hurdle_straight-v1.png`
- `public/assets/yards/hurdle_end_corner-v1.png`

### ILL-01 · P2 · 엔딩 주택 굴뚝 통과 재료 규약 충돌

**축:** 재료 색 · 시대·규약 · **방법:** 다시 그림

엔딩 family_city와 pilgrims_city에는 일반 주택에 벽돌 굴뚝과 여러 굴뚝 통이 반복된다. self_governing_city도 오른쪽 지붕에 굴뚝 통이 있다. family_city의 큰 가정용 유리창과 회색 지붕 반복도 기준 재료와 다르다. 프로젝트 기본형 규약 위반이며 모든 중세 굴뚝이 시대착오라는 주장이 아니다.

**고칠 방법:** 인물·구도 보존하고 주택 지붕의 굴뚝통을 제거. 일반 가옥은 무굴뚝, 소수 후기 고급 예외는 별도 명세. 장대한 유리창/회색 지붕의 반복을 작은 덧창/평기와로 통일.

**확실성:** high.

**대상 경로:**

- `assets-inbox/endings-manors/candidates-20260930/assets/endings/campaign_ending_family_city-v1.jpg`
- `assets-inbox/endings-manors/candidates-20260930/assets/endings/campaign_ending_pilgrims_city-v1.jpg`
- `assets-inbox/endings-manors/candidates-20260930/assets/endings/campaign_ending_self_governing_city-v1.jpg`

### ILL-02 · P2 · 타이틀 일반 주택 외부 굴뚝

**축:** 시대·규약 · **방법:** 다시 그림

초기 타이틀의 보통 초가·기와 주택에 밝은 외부 굴뚝이 반복된다. 일반 주택 무굴뚝이라는 프로젝트 기본형과 충돌한다. 당시 굴뚝 자체가 없었다는 의미는 아니다.

**고칠 방법:** 원래 마을 구성 유지하고 일반 주택의 굴뚝만 제거. 교회/실제 기능 시설 예외는 별도 판정.

**확실성:** high.

**대상 경로:**

- `assets-inbox/wave8/candidates-20260925/assets/keyart/keyart_title_bg.png`

### POR-01 · P2 · L6 담비와 현재 금지 기준 충돌

**축:** 시대 고증 / 기준 충돌 · **방법:** 기준·메타데이터 보정 우선

L6 계보 30장에 검은 꼬리 반점이 있는 흰 담비 모피가 명백하다. 현재 AGENTS.md:12의 담비 금지와 설치 자산이 충돌한다. 역사적으로 불가능하다는 판정은 아니다.

**고칠 방법:** 원본 재작업에 앞서 명시적 허용 신분·시대·역할 메타데이터 및 예외 대장을 정리한다. 금지를 유지하는 신규 자산에는 회갈색 무늬 없는 모피 사용. 이번 감사에서 교체·삭제하지 않는다.

**확실성:** high.

**대상 경로:**

- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_201_baby.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_201_child.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_202_baby.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_202_child.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_202_mature.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_202_young.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_203_baby.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_203_child.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_203_mature.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_203_young.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_204_baby.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_204_child.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_204_mature.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_204_young.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_205_mature.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_205_young.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_206_mature.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_206_young.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_301_baby.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_301_child.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_301_young.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_302_baby.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_302_child.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_302_young.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_303_baby.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_303_child.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_303_young.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_304_baby.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_304_child.png`
- `assets-inbox/lineage/prod2-20260928/assets/L6/L6_304_young.png`

### RUN-02 · P2 · 겨울 창고와 주거지의 눈 적용 차이

**축:** 재료 색 · 세 줌 · **방법:** 코드·표시/메타데이터 보정

1306년 겨울 같은 장면에서 주거지·곡창은 눈이 강하게 쌓였는데 두 붉은 기와 창고 지붕은 전면 노출된다. 장면의 계절 표현 차이는 실화면에서 확인했다. storehouse.png는 설치 기본 자산이며 실제 선택 변형별 픽셀 추적까지 하지 않아 이 파일 자체의 결함으로 확정하지 않는다.

**고칠 방법:** 창고 계절 변형·overlay 적용 조건을 점검한다. 의도된 녹음 차이이면 규칙을 문서화; 누락이면 해당 연결 수정. 현재 증거만으로 원본 재작업을 요구하지 않는다.

**확실성:** 중간: 화면 차이 확정, 원인 미확정.

**대상 경로:**

- `public/assets/buildings/storehouse.png`
- `src/render/buildingOverlays.ts`

### RUN-03 · P2 · 나무 좌우 반전의 광원 반전 위험

**축:** 빛 방향 · **방법:** 코드·표시/메타데이터 보정

tree_oak_large 등록이 숲 배치에서 flipX를 받고 worldSprite의 X축 반전으로 그려지는 코드 경로를 확인했다. 구워진 조명도 함께 뒤집힐 수 있다. 전수 원본 검토에서 명백히 반대인 주광/투사 그림자를 확정한 파일은 없으며 이 항목은 렌더 계약 위험이다.

**고칠 방법:** 방향성 채색이 있는 나무의 무조건 flipX를 피하고, 반전 허용 자산/방향별 원본/별도 그림자를 구분한다. 실제 주광 위반으로 보이는 개체를 재현한 뒤 보정한다.

**확실성:** 높음: 코드 경로; 시각적 영향은 미확정.

**대상 경로:**

- `public/assets/foliage/tree_oak_large.png`
- `src/render/treeLayout.ts`
- `src/render/drawTrees.ts`
- `src/render/worldSprite.ts`

### UI-01 · P2 · 주·보조 버튼 바탕색 동일

**축:** 재료 색 · 외곽선 · **방법:** 다시 그림

주/보조 버튼의 중앙80×24px가 모두 RGB(225,209,174), 표준편차0으로 같다. 모서리 장식만 다르고 바탕은 같은 밝은 양피지여서 행동 우선순위가 한눈에 갈리지 않는다. 현재 frameTokens.generated.css282/285가 해당 파일을 참조한다.

**고칠 방법:** 주 버튼 바탕을 dark oak로 교체하고 보조는 parchment 유지. 양쪽 12px source slice 계약 유지. 밝은 주 버튼 글자색은 후속 코드 적용에서 함께 검토.

**확실성:** high.

**대상 경로:**

- `public/assets/ui-p0/button_primary_base.png`
- `public/assets/ui-p0/button_secondary_base.png`

### BLD-05 · P3 · 농가의 고밀도 점상 질감

**축:** 질감·해상도 · **방법:** 다시 그림

농가 네 상태의 초가·벽·수레는 같은160×136급 주변 건물보다 미세한 명암점과 1픽셀 질감이 촘촘하다. 일반 historical-house의 넓은 초가 단과 매끈한 석회면과 비교 시 거칠고 잔점이 많은 계열로 읽힌다. 해상도 업스케일 흔적이나 런타임 깜박임까지 증명한 것은 아니다.

**고칠 방법:** 저해상도 런타임용으로 초가와 목재의 큰 명암 덩어리를 우선하고 점상 대비를 줄인 파생본 제작. 0.5줌에서 실제화면 비교 후 우선순위 결정.

**확실성:** medium.

**대상 경로:**

- `public/assets/buildings/farmstead/farmstead_a-v1.png`
- `public/assets/buildings/farmstead/farmstead_b-v1.png`
- `public/assets/buildings/farmstead/farmstead_working-v1.png`
- `public/assets/buildings/farmstead/farmstead_winter-v1.png`

### ENV-05 · P3 · 닭 무리 A의 굵은 선

**축:** 외곽선 · **방법:** 다시 그림

chicken_flock_a의 닭은 두꺼운 짙은 외곽선이 몸 전체를 연속해서 감싸며 같은 세트 b/c보다 만화 윤곽이 강하다. 원본 닭 크기도 다르지만 displayScale A0.04887 B0.08543 C0.08047로 보정되어 있으므로 원본 크기 자체는 실행 결함으로 분류하지 않는다.

**고칠 방법:** 다음 재작업 때 외곽선을 끊고 털색 음영으로 바꾼다. 현행 실행상 크기 재조정은 하지 않는다.

**확실성:** high.

**대상 경로:**

- `public/assets/wave23/life_ground/chicken_flock_a.png`

### ENV-06 · P3 · 굶주린 군중의 굵은 선

**축:** 외곽선 · 질감 · **방법:** 다시 그림

hungry_queue 여섯 인물이 굵은 검은 외곽선과 큰 얼굴/몸통 색 덩어리로 묶여 있다. 개별 walkers-v2 및 crowd_manor_gate와 비교하면 외곽선이 더 강하고 군중 내 인물 구분이 거칠다.

**고칠 방법:** 동일 워커 색/인체비율/경계 밀도로 군중 묶음을 재작업하고 작은 최종 표시에서 줄 서기 뜻을 유지한다.

**확실성:** high.

**대상 경로:**

- `public/assets/wave9/signifier/hungry_queue-v1.png`

### ENV-07 · P3 · 바위 타일의 과밀 질감

**축:** 질감 · **방법:** 다시 그림

rock.png은 화면을 채우는 큰 돌 단면, 매우 깊은 검은 틈, 균일한 미세 이끼 잡음으로 묘사된다. 뒤에 도입된 작은 chalk_outcrop 및 stone-wall 소품과 비교하면 사진 질감에 가까운 대비/표면 밀도다. 타일 크기를 모르는 원본 비교만으로 바위의 인체 비율은 판정하지 않는다.

**고칠 방법:** 다음 지면 통일 작업에서 미세 잡음/틈 대비를 줄이고 같은 노출 암석 팔레트에 맞춘다.

**확실성:** medium.

**대상 경로:**

- `public/assets/terrain/rock.png`

### ENV-08 · P3 · 현대 밑창처럼 읽히는 발자국

**축:** 시대 고증 · **방법:** 다시 그림

발자국 표식 안에 일정 간격의 굵은 가로 홈이 반복되어 현대 운동화/작업화 트레드를 연상시킨다. 저해상도 표식이고 역사적으로 불가능함은 이 시각 증거만으로 단정하지 않는다. 별도 뒤꿈치나 봉합 자국 자체는 현대성의 근거로 삼지 않는다.

**고칠 방법:** 경로 안내 기능은 유지하고 가로 홈을 없앤 단순 가죽 밑창/맨발 실루엣으로 변경하는 보수적 시각 수정 권고. 역사 사실 확정 판정은 별도 출처와 결합.

**확실성:** medium.

**대상 경로:**

- `public/assets/wave7/signifier/footprints_dotted_ne-v1.png`
- `public/assets/wave7/signifier/footprints_dotted_nw-v1.png`

### ILL-03 · P3 · 초기 타이틀과 후기 삽화의 질감 차이

**축:** 외곽선 · 질감·해상도 · **방법:** 다시 그림

초기 타이틀은 둥근 수목 덩어리와 간략한 장난감 같은 집, 후속 Wave21/33·엔딩은 더 세밀한 회화 재료 표현이다. 표면 묘사의 일관성 차이며 잘못된 업스케일이라는 증거는 없다.

**고칠 방법:** 향후 타이틀 재작업 때 최신 사건 삽화의 재료/수목 붓질과 맞추기. 현재 구성·수평선 보존.

**확실성:** medium.

**대상 경로:**

- `assets-inbox/wave8/candidates-20260925/assets/keyart/keyart_title_bg.png`

### POR-02 · P3 · 승인 Pool3 예외의 명문화 필요

**축:** 시대 고증 / 승인 예외 누락 · **방법:** 승인 예외 기록 · 재작업 제외

사용자 승인된 Pool3 I101/I102/I103 각 3연령 9장에 검은 반점의 흰 담비 모피. 포괄 금지와 승인된 산출물이 불일치한다.

**고칠 방법:** 기존 승인 예외를 ART_BIBLE_v2와 자산 메타데이터에 명시해 자동 재작업 대상에서 제외한다. 승인된 Pool3를 재개방하거나 다시 그리지 않는다.

**확실성:** high.

**대상 경로:**

- `assets-inbox/portrait-pool/pool3-20260927/assets/portraits/I101_young.png`
- `assets-inbox/portrait-pool/pool3-20260927/assets/portraits/I101_mature.png`
- `assets-inbox/portrait-pool/pool3-20260927/assets/portraits/I101_old.png`
- `assets-inbox/portrait-pool/pool3-20260927/assets/portraits/I102_young.png`
- `assets-inbox/portrait-pool/pool3-20260927/assets/portraits/I102_mature.png`
- `assets-inbox/portrait-pool/pool3-20260927/assets/portraits/I102_old.png`
- `assets-inbox/portrait-pool/pool3-20260927/assets/portraits/I103_young.png`
- `assets-inbox/portrait-pool/pool3-20260927/assets/portraits/I103_mature.png`
- `assets-inbox/portrait-pool/pool3-20260927/assets/portraits/I103_old.png`

### UI-02 · P3 · 옛 인장 슬롯의 원색·픽셀 장식

**축:** 재료 색 · 외곽선 · 질감·해상도 · **방법:** 다시 그림

64px seal_slot은 붉고 푸른 고리·조밀한 픽셀 장식이 강하다. 후기 밀랍·갈색 잉크 UI와 색·선·질감이 다르다. global.css760에서 참조한다.

**고칠 방법:** 64px용 저채도 얇은 잉크선/밀랍 계열로 재작업하거나 동일 역할 기존 문양으로 교체. 단순 확대 금지.

**확실성:** high.

**대상 경로:**

- `public/assets/ui/seal_slot.png`

### UI-03 · P3 · 결과 아이콘의 현대 밑창 단서

**축:** 시대·규약 · **방법:** 다시 그림

96px 실제 결과 아이콘의 부츠 밑창에 굵고 규칙적인 돌출 트레드가 보인다. 현대 작업화처럼 읽히는 시각 단서이며 중세 물체의 실화면 등장이나 발명 연대를 입증하는 발견은 아니다.

**고칠 방법:** 실제 결과 아이콘은 평평한 가죽 밑창 발자국 또는 기존 확인 표식으로 재작업.

**확실성:** high.

**대상 경로:**

- `public/assets/wave19/timeline/icon_actual.png`

### UI-04 · P3 · 통행세 아이콘의 현대 차단봉 단서

**축:** 시대·규약 · **방법:** 다시 그림

통행세 아이콘의 빨강/흰 줄무늬 상승 차단봉이 현대 도로 설비처럼 읽힌다. UI 비유이므로 심각도는 낮고 역사적으로 불가능하다는 단정은 하지 않는다.

**고칠 방법:** 줄무늬를 지운 거친 oak 통행 막대+동전으로 바꾸어 의미 유지.

**확실성:** medium.

**대상 경로:**

- `public/assets/wave14/ui-icons/icon_right_toll-v1.png`

## 색 견본과 고증 기준의 해석

[ART_BIBLE_v2.md](../art-bible.md)의5개 색은 승인 계열 설치 그림의 선택1픽셀 RGB다. 좌표·소스는 `palette.csv`. 이미지 전체 평균이 아니며 젖음/그늘/노후를 같은 재료의 오류로 오인하지 않는다. 초가#C78D45, 평기와#B86E44, 석회칠#F7E8CD, oak#825C3D, 잡석#93806D. 다음 제작의 비교 시작점이며 역사적 재료의 물리 표준색이라는 뜻이 아니다.

약1290년 Old Soar Manor의 벽난로와 유리창, 후기14세기 madder 염색 실크가 확인된다. 따라서 굴뚝·유리·빨강 옷 자체를 시대 오류로 기록하지 않았다. 프로젝트의 일반 주택·재료·옷채도 금지는 별도 미술 규약으로 유지한다. [English Heritage](https://www.english-heritage.org.uk/visit/places/old-soar-manor/history/), [London Museum](https://www.londonmuseum.org.uk/collections/v/object-731999/fragment/)

금지/예외·post mill·문장·에일·매장에 대한 출처와 연대 한계는 `evidence/history-notes.md`에 남겼다. 승인된 Pool3는 재개방하지 않는다. L6도 역사적으로 불가능해서 지우라는 결론이 아니라 현재 포괄 규약과 설치 내용의 충돌을 명시적으로 해소하라는 권고다.

## 적용 순서

1. RUN-01 영주관 연결과 BLD-06 레이어 파생 정합을 먼저 해결하고 해당 실제 상태를 재캡처한다.
2. BLD-07의 문/인물 관계와0.5줌 읽기 보정을 함께 검토한다. 집 전체 크기를 늘려 필지를 침범하는 단순 수정은 피한다.
3. 주/보조 버튼 위계, 방향별 교대·울타리·건초·과수 등 같은 재료 세트를 통일한다.
4. 엔딩/타이틀의 주택 규약과 담비 승인 예외를 정리한다. 모호한 고증은 폐기보다 메타데이터·출처 검토가 먼저다.
5. legacy 시설 폐기는 실제 참조와 fallback을 확인한 뒤 수행한다. 이번 감사에서는 어떠한 설치·폐기·보정도 하지 않았다.

비교판은 실제 파일의 축소·확대·알파 합성·진단용 도식 및 실제 게임 캡처만 사용했다. 새 미술 그림을 생성하지 않았다.
