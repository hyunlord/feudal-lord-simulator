# RB-HEIGHT-WAVE2-L1ARTISAN 후보 7장

**후보 제작·정적 합성까지만 완료. 설치·실게임·DGX 검증 아님.** 제품 코드/공용장부/게임그림/커밋/게시를 바꾸지 않았다.

긴 박공 초가, 왼쪽 작업 차양과 낮은 작업대, 앞 출입문과 오른쪽 덧창을 유지했다. 총12회 생성(본체5, 상태층7), 본체1~4와 눈1차의 실패/부족 결과를 보존했다. 5차본체는 앞선 성공 historic 집을 전체 기하 참고로 사용해 완성집으로 다시 생성한 것이며 부품을 잘라 조립하지 않았다. 실제 artisan 원본은runtime/inbox 모두139²로 같은SHA다.

## 최종 7파일

HANDOFF7/만 최종 후보 집합이다. 전부 RGBA139×175, pivot=(71.66148325358851,161.92025518341308), worldScale=.498621726759907, footprint1×1. 위쪽 여백36과 pivot y+36을 함께 적용해 기존 세계 바닥 앵커를 유지한다.

|역할|최종파일|SHA256|
|---|---|---|
|body|HANDOFF7/house_l1_artisan-body-v2.png|c67c775712ccca9f84acc6a9b199d7b0f871437615342f744f5b6d0d5de04816|
|snow|HANDOFF7/house_l1_artisan-snow-v2.png|280f94a0b1cfa20df7147fb43e8f43f52ed56dbe7cb19413e1019708deb8d6d1|
|boarded|HANDOFF7/house_l1_artisan-boarded-v2.png|1f6b29d7a89e232aee58a690a80a7731fb2cfa191dfec2f9827d38dbfe25cd82|
|strained|HANDOFF7/house_l1_artisan-strained-v2.png|d6e957016726489736c5c1a3b9db7102069cb224615f78f74d07d99872a6f092|
|neglected|HANDOFF7/house_l1_artisan-neglected-v2.png|ef27b29473e5daf8660981c1a2db591f47878d53fac0b9bf28930950d4f5f50d|
|vacant|HANDOFF7/house_l1_artisan-vacant-v2.png|e9718e31837142dbfcf132d1cf2accc8a405208c6eb91e2c78e3c16f300894a9|
|plague-shut|HANDOFF7/house_l1_artisan-plague-shut-v2.png|6cd036db1acdc28d2b31374bea62abc4f76b25bcd9b5a2d803a0c0c4af744f1f|

## 문잎·개구부·차양을 따로 측정

문잎은 원시 나무패널 양쪽 수직 끝점을 기준으로 한다. 두 높이46.548/46.440native, 투영폭18.360native → world23.210/23.156×9.155. 어른17.6 대비 높이1.319/1.316, 폭.520으로 바이블 높이1.15~1.40·폭.45~.65 중앙값을 충족한다. 문틀/차양기둥을 문 높이에 넣지 않았다. 수동 끝점 오차±1.2native는 별도다. `proofs/door-source-grid.png`와 `MEASUREMENTS.json`에 끝점을 보존했다.

개구부 추정은 문잎과 구분했다. 틀 안쪽 개구부 높이47.304native, 폭20.304native → world23.587×10.124. 검은 안쪽 틈과 문잎 가장자리 구별에 수동 오차가 있다. 두꺼운 문틀 바깥은 판정에 쓰지 않았다.

차양 기둥 안쪽 수직 높이는 왼쪽44.172/오른쪽48.492native이며, 작업대가 막는 작업 공간이므로 통과 가능한 출입문으로 세지 않는다. 차양 프레임 높이를 이용해 문 기준을 통과시킨 것이 아니다.

## 등록과 바닥 잔차

본체 whole uniform scale .108, translation(9.5,8). 일반층은 s=139/rawWidth, translation(0,0). 역병셔터만 원시 전체에 s=(139/rawWidth)*.55, translation(46.35,55.35)를 적용해 과대한 첫 등록을 창 크기에 맞췄다. BICUBIC inverse affine=(1/s,0,-tx/s,0,1/s,-ty/s), output139×175. 부위별리사이즈·회전·워프·클립·마스크절단·수작업화필 수정은 없다. 기존 condition inset .95,dx5,dy6는 **body scale도 새층 등록도 아니므로 적용하지 않았다.**

원본+위패딩36과 비교한 주요 기초 모서리 최대 좌표잔차2.376native. 문턱 오른쪽은 넓어진 문 때문에 x+4.432native, y−.440native로 별도 기록한다. 작업대/차양 발은 왼쪽기둥(−.672,−.828), 앞 작업대다리(−1.668,+1.400), 오른쪽기둥(−1.788,+3.292)native. 발판과 작업대가 픽셀단위로 완전히 같다고 주장하지 않는다. 원본이작아 바닥 수동판독오차±2native를 별도로 둔다.

전체 등록의 유효 alpha offcanvas소실은7파일 모두0. 원시경계의 미약한 alpha는 snow20픽셀/vacant33픽셀이고 >32/≥128 경계픽셀은모두0. 나머지5원시는 alpha>0경계도0. 경계 alpha와 등록중 소실을 `manifest.json`에 따로 측정했다.

## 일곱 역할과 상태 구분

- body: artisan원본 선택 경로용. 차양·작업대는 그림 속 소품이며 독립 직업/생산 actor를 뜻하지 않는다.

- snow: 주지붕+작업 차양 전용, 겨울/봄해빙 alpha용.

- boarded: abandonedTick 상태에서 문과 오른쪽 창에 X판자. 왼쪽 작업공간은 창/문으로 오인해 막지 않았다.

- strained: 거주중 경미한 유지부족, 문 오른쪽 작은 훼손. 저줌에서 매우 약하게 읽힐 수 있다. 이 가독성 한계를 기록하고 상태를 다른 역할과 합치지 않았다.

- neglected: 거주중 심한 유지부족, 지붕 작은 훼손과 문 오른쪽 벽손상.

- vacant: residents<=0인 빈집, 손상+오른쪽 창 한 줄 판자. abandoned와 구분한다.

- plague-shut: 역병 빈집이면서abandoned인 경우의 오른쪽 창 닫힌셔터. 일반X판자와 구별하고 작업대를 창으로 보지 않는다.

condition→ordinary/plagueboards→snow 순서이며 현재 필요한층 모두 준비 후 사용해야 한다. fire/burnt는 기존fallback을 유지한다. 엔진 조건/consumer/설치는 담당자의 후속 범위다.

## 눈과 실제 검증의 한계

주지붕+차양 합산 가중71.518%, alpha>32이진75.884%, alpha≥128이진72.168%. **주지붕만69.927%, 작은차양만82.168%**로, 차양은 권장상한80%보다2.168%p 높다. 합산으로 이 초과를 숨기지 않는다. 수동지붕마스크±2native 오차가 있고 마스크는 측정에만 쓰며 그림을 자르지 않았다.

마스크밖 alpha>32 286픽셀, 가중261.012픽셀, 최대Chebyshev거리3native. 처마 가장자리와 능선의 작은 돌출 포함. 밝음/어두움 합성에서 별도로 떠 있는 눈조각은 발견하지 않았지만 실제게임1.0/.6 줌의 투영·가림·붙어보임은 미검증이다. 차양82.17%와 저줌미세훼손 가독성을 실제장면에서 확인하도록 남긴다.

root가 본체 및 snow02밝음/어두움, boarded, plague-shut-adjusted, strained, neglected, vacant 합성을 직접 확인했다. 이 확인은게임판정이 아니다. `proofs/dark-contact-sheet.png`가 최종6층 합성이고 원시·초기실패등록도 별도 보존한다.

## 근거와 재현

`SOURCES.json`:원본·기하참고경로/치수/SHA. `GENERATIONS.json`:12개 생성의 원시/정확프롬프트/참조; model/seed미반환. `manifest.json`:최종7파일/원시SHA/전체등록/알파경계. `MEASUREMENTS.json`:문잎/개구부/차양/발판/작업대발/눈면적. `SHA256SUMS`:자기자신 제외 전체 파일. 준비문서 기준HEAD c76127f470818973378db51975bbda4f111452b0, 인계중 읽기checkout7251069277abbd8a48dbaab91479f1eaeb5b95a8. 출처원본SHA를 다시 확인했다.
