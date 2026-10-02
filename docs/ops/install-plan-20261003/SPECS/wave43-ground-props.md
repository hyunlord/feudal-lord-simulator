# wave43-ground-props

분류 나; 15장; 예상 5–9h.

ground8: archetypeGroundModel.ts:104 wave22Season은 봄을 summer로 돌린다. :113 fillArtKey와 :130 landArtKeys에 spring fill 선택+준비키를 연결한다. 각 땅 봄 fill A 한장뿐이므로 variant A/B를 모두 같은 A로 명시 매핑하고 중복파일 생성하지 않는다. riverside grass는 seasonGround.ts:37 drawSeasonGrass가 전역으로 사용하므로 바로 bases=[grass]로 등록하면 다른 땅까지 변경된다. drawTerrainBoundaryV2.ts:203 호출부에서 땅 종류를 전달하고 강가만 선택하는 guard를 추가한다. 여름·겨울 기존 전역 grass 선택은 유지한다. 밭3은 drawArableFields.ts:251가 현재 fallow만 seasonVariant하므로 ploughed/seedling 선택에 봄키를 연결하고512×64 X반복을 유지.

벚나무는 plum_j의 기하만 상속한 것으로 새 cherry cosmetic key/원형별 선택규칙을 분리하여 기존 자두 과실데이터와 섞지 않는다. props6: ewe+lamb2는 farmProps.ts:128의 pasture 양무리 주변, nest는 숲가 가장자리, swollenbank는 engine weather와 water edge, hawthorn strip은 기존 hedge boundary, laundry는 집마당 free footprint에 둔다. 봄 외 숨김(여름/겨울짝 없음). stable hash로 위치/변형 유지. ground256×128 pivot0,0; strip512×64 CSVpivot; 소품은metadata pivot 그대로 scale0.15부터 시작하고 sheep 높이≤성인허리/세탁줄높이≤성인키. 줌0.6에서는 nest/작은꽃 생략, 강둑과 양 가족 큰실루엣 유지. 다섯 땅 봄/여름, 밭3상태, 양있는목초지/물가/생울타리/주택마당을 찍는다.
공통 설치 계약: inbox 원본 바이트는 보존한다. 런타임 파일은 C2PA 메타데이터만 제거하고 픽셀·알파·캔버스는 유지한다. 카탈로그 URL이 assets/로 시작하면 실제 파일은 public/assets/ 아래다. 설치 대장 docs/provenance/assets.csv에는 실제 산출물 SHA와 원본 경로를 남긴다. installed_by는 성공 캡처 후 작업 ID(NAT-3/NAT-5/LM-R1 등)를 넣는다. 설치 커밋 SHA는 provenance와 설치 보고서에 별도 기록한다(지금 미리 확정하지 않는다). 제안값은 ../INVENTORY.csv 참조. 좌우 반전 금지. 계절은 0봄/1여름/2가을/3겨울. 원본 metadata에는 수령 당시 candidate가 남아 있으나 승인 판정은 INBOX_LEDGER의 confirmed가 우선한다.

검증: 신규 게임 다섯 땅과 큰 도시 ch4-1380 저장에서 대상이 있는 카메라를 고정하여 줌0.6/1.0/1.4 전후, 여름·겨울 및 해당 계절을 캡처한다. 카메라 좌표/seed/틱/HEAD를 기록한다. 본 문서는 설치 계획이며 런타임 캡처 합격을 주장하지 않는다. 파일 규격·피벗·연결 포트 원문은 ../METADATA/nature.json, 그림별 매핑은 ../INVENTORY.csv에 있다. 예상 작업량은 렌더 1명 엔지니어 시간 추정이며 그림 재작업 시간 제외.


| inbox 경로 | public 대상 | 규격 | 피벗 | 계절 |
|---|---|---|---|---|
| `wave43/candidates-20261002/assets/ground/chalk_down_spring_a-v1.png` | `public/assets/wave43/ground/chalk_down_spring_a-v1.png` | 256×128 | [0,0] | spring |
| `wave43/candidates-20261002/assets/ground/coastal_grass_spring_a-v1.png` | `public/assets/wave43/ground/coastal_grass_spring_a-v1.png` | 256×128 | [0,0] | spring |
| `wave43/candidates-20261002/assets/ground/fen_spring_a-v1.png` | `public/assets/wave43/ground/fen_spring_a-v1.png` | 256×128 | [0,0] | spring |
| `wave43/candidates-20261002/assets/ground/ridge_ploughed_spring_a-v1.png` | `public/assets/wave43/ground/ridge_ploughed_spring_a-v1.png` | 512×64 | [0,0] | spring |
| `wave43/candidates-20261002/assets/ground/ridge_seedling_spring_a-v1.png` | `public/assets/wave43/ground/ridge_seedling_spring_a-v1.png` | 512×64 | [0,0] | spring |
| `wave43/candidates-20261002/assets/ground/ridge_seedling_spring_b-v1.png` | `public/assets/wave43/ground/ridge_seedling_spring_b-v1.png` | 512×64 | [0,0] | spring |
| `wave43/candidates-20261002/assets/ground/riverside_grass_spring_a-v1.png` | `public/assets/wave43/ground/riverside_grass_spring_a-v1.png` | 256×128 | [0,0] | spring |
| `wave43/candidates-20261002/assets/ground/woodland_floor_spring_a-v1.png` | `public/assets/wave43/ground/woodland_floor_spring_a-v1.png` | 256×128 | [0,0] | spring |
| `wave43/candidates-20261002/assets/orchard/orchard_cherry_spring.png` | `public/assets/wave43/orchard/orchard_cherry_spring.png` | 256×256 | [128,242] | spring |
| `wave43/candidates-20261002/assets/props/ewe_lamb_a_spring.png` | `public/assets/wave43/props/ewe_lamb_a_spring.png` | 128×96 | [67,69] | spring |
| `wave43/candidates-20261002/assets/props/ewe_lamb_b_spring.png` | `public/assets/wave43/props/ewe_lamb_b_spring.png` | 128×96 | [65,77] | spring |
| `wave43/candidates-20261002/assets/props/hawthorn_blossom_strip_spring.png` | `public/assets/wave43/props/hawthorn_blossom_strip_spring.png` | 512×64 | [256,53] | spring |
| `wave43/candidates-20261002/assets/props/laundry_yard_spring.png` | `public/assets/wave43/props/laundry_yard_spring.png` | 256×192 | [132,176] | spring |
| `wave43/candidates-20261002/assets/props/nest_bird_spring.png` | `public/assets/wave43/props/nest_bird_spring.png` | 128×96 | [65,79] | spring |
| `wave43/candidates-20261002/assets/props/swollen_stream_bank_spring.png` | `public/assets/wave43/props/swollen_stream_bank_spring.png` | 256×128 | [130,117] | spring |


## 용량과 공통 처리

이 실행 묶음 15장: 메타데이터 제거 후 원본 합계 0.89 MiB, 원본 RGBA 한 벌 산술 합계 1.83 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
