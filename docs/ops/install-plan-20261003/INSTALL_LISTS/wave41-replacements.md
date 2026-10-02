# wave41-replacements

분류 가; 26장; 예상 3–5h.

26장은 기존 이름·캔버스 그대로의 교체이며 새 선택 함수가 필요 없다. INSTALL_LISTS/wave41-replacements.mapping.json과 fragments.ts의 각 catalogue_file/line을 따른다. keyart PNG는 public/assets/wave41/keyart_title_bg.png에 놓고 wave8ArtManifest의 URL만 바꾼다(확장자가 JPG인 경로에 PNG 바이트를 놓지 않는다). 나머지는 기존 public 경로의 런타임 그림 교체이다. 원본 소실 방지를 위해 inbox는 건드리지 않는다.

도달 근거와 선택 규칙:
- 교대3: terrainVariantManifest TERRAIN_VARIANTS.bridgeAbutment → terrainVariantAssets.ts:20 preloadShoreAssets → drawShoreline.ts:286 방향/앞뒤/좌표해시 선택. 256×192, 표시폭64. 기존 캔버스 등록 유지.
- 길드홀: wave12ArtManifest → reorgWorldProps.ts:117 guildhallArt.draw(guildhall_active). 기관 상태·위치 그대로.
- 건초6/과수4: zoneAssetManifest.ts:37–46/103–104 ZONE_VARIANTS → zoneLayer.ts:209 위치해시와 이웃반복 회피 → zonePropSprites.ts:22 실제 그리기. 건초 표시폭26–30, 과수43world. 기존 pivot 그대로. 과수 겨울은 seasonArt의 기존 짝을 보존하고 변경 전후 여름·봄·겨울 등록이 어긋나지 않는지 확인.
- 농가4: buildingVariantManifest farmstead pool → farmsteadArt.ts:64 farmsteadImageUrl: 수확 working 우선, 겨울 winter, 나머지 기존 변형 A/B. 160×136, buildingSpriteFit으로 필지 맞춤.
- 닭: villageLife.ts:206 기존 flock A/B/C/걷기 위치 선택, wave23ArtManifest.ts:12 A만 교체. 136×104, pivot(68,100), displayScale0.04886843249051477. 단독 닭 성체 비율을 사람17.6world 대비 확인.
- 바위: worldAssetManifest.generated.ts:412 rock → terrainPatterns.ts:65 terrainTextureKeyFor/85 getTerrainPattern → drawTerrain.ts:193 지면그림. 512×512 반복 fill, pivot(0,0). 바이트 교체는 즉시 가능하나 QA-039의 직선 clip은 별도 NAT-5 geometry 작업이다. 그림 교체만으로 QA-039 해결을 선언하지 않는다.
- 발자국2: wave7ArtManifest.ts:26–27 → worldSigns.ts:179 drawDottedTrack, 길방향으로 ne/nw, 배율0.5 피벗(64,62).
- seal_slot: styles/global.css:760 직접 URL, UI64×64; icon_actual: ui/chronicle/DecisionCompareFrame.tsx:43,18px; icon_right_toll: ui/lordshipModel.ts:27 권리 icon. WelcomeScreen.tsx:55 표제 배경 선택. UI는 세계 줌과 무관하며 실제 해당 화면을 연다.

캡처: 길드홀/농가수확/겨울/교량양축/건초·과수/닭/길없는건물 발자국/백악바위 + 권리창/선택결과비교/환영화면을 빠짐없이 확인. 배경종이/그림자/스케일은 기존 표시를 유지한다.
공통 설치 계약: inbox 원본 바이트는 보존한다. 런타임 파일은 C2PA 메타데이터만 제거하고 픽셀·알파·캔버스는 유지한다. 카탈로그 URL이 assets/로 시작하면 실제 파일은 public/assets/ 아래다. 설치 대장 docs/provenance/assets.csv에는 실제 산출물 SHA와 원본 경로를 남긴다. installed_by는 성공 캡처 후 작업 ID(NAT-3/NAT-5/LM-R1 등)를 넣는다. 설치 커밋 SHA는 provenance와 설치 보고서에 별도 기록한다(지금 미리 확정하지 않는다). 제안값은 ../INVENTORY.csv 참조. 좌우 반전 금지. 계절은 0봄/1여름/2가을/3겨울. 원본 metadata에는 수령 당시 candidate가 남아 있으나 승인 판정은 INBOX_LEDGER의 confirmed가 우선한다.

검증: 신규 게임 다섯 땅과 큰 도시 ch4-1380 저장에서 대상이 있는 카메라를 고정하여 줌0.6/1.0/1.4 전후, 여름·겨울 및 해당 계절을 캡처한다. 카메라 좌표/seed/틱/HEAD를 기록한다. 본 문서는 설치 계획이며 런타임 캡처 합격을 주장하지 않는다. 파일 규격·피벗·연결 포트 원문은 ../METADATA/nature.json, 그림별 매핑은 ../INVENTORY.csv에 있다. 예상 작업량은 렌더 1명 엔지니어 시간 추정이며 그림 재작업 시간 제외.


| inbox 경로 | public 대상 | 규격 | 피벗 | 계절 |
|---|---|---|---|---|
| `wave41/candidates-20261002/assets/01-bridge_abutment_ne_a-v1-wave41-v1.png` | `public/assets/module/bridge_abutment_ne_a-v1.png` | 256×192 | existing module registration; drawShoreline.ts:281-298 | all |
| `wave41/candidates-20261002/assets/02-bridge_abutment_nw_a-v1-wave41-v1.png` | `public/assets/module/bridge_abutment_nw_a-v1.png` | 256×192 | existing module registration; drawShoreline.ts:281-298 | all |
| `wave41/candidates-20261002/assets/03-bridge_abutment_se_a-v1-wave41-v1.png` | `public/assets/module/bridge_abutment_se_a-v1.png` | 256×192 | existing module registration; drawShoreline.ts:281-298 | all |
| `wave41/candidates-20261002/assets/04-guildhall-active-v1-wave41-v1.png` | `public/assets/wave12/bld/guildhall-active-v1.png` | 352×300 | {"x": 107, "y": 291} | all |
| `wave41/candidates-20261002/assets/05-haycock_a-v1-wave41-v1.png` | `public/assets/zones/haycock_a-v1.png` | 128×128 | [64, 120] | all |
| `wave41/candidates-20261002/assets/06-haycock_b-v1-wave41-v1.png` | `public/assets/zones/haycock_b-v1.png` | 128×128 | [64, 120] | all |
| `wave41/candidates-20261002/assets/07-haycock_c-v1-wave41-v1.png` | `public/assets/zones/haycock_c-v1.png` | 128×128 | [64, 120] | all |
| `wave41/candidates-20261002/assets/08-haycock_d-v1-wave41-v1.png` | `public/assets/zones/haycock_d-v1.png` | 128×128 | [64, 120] | all |
| `wave41/candidates-20261002/assets/09-haycock_e-v1-wave41-v1.png` | `public/assets/zones/haycock_e-v1.png` | 128×128 | [64, 120] | all |
| `wave41/candidates-20261002/assets/10-haycock_f-v1-wave41-v1.png` | `public/assets/zones/haycock_f-v1.png` | 128×128 | [64, 120] | all |
| `wave41/candidates-20261002/assets/11-orchard_apple_c-v1-wave41-v1.png` | `public/assets/zones/orchard_apple_c-v1.png` | 256×256 | [128, 246] | all |
| `wave41/candidates-20261002/assets/12-orchard_apple_d-v1-wave41-v1.png` | `public/assets/zones/orchard_apple_d-v1.png` | 256×256 | [123, 246] | all |
| `wave41/candidates-20261002/assets/13-orchard_pear_e-v1-wave41-v1.png` | `public/assets/zones/orchard_pear_e-v1.png` | 256×256 | [123, 246] | all |
| `wave41/candidates-20261002/assets/14-orchard_plum_f-v1-wave41-v1.png` | `public/assets/zones/orchard_plum_f-v1.png` | 256×256 | [141, 246] | all |
| `wave41/candidates-20261002/assets/17-keyart_title_bg-wave41-v1.png` | `public/assets/wave41/keyart_title_bg.png` | 1920×1080 | UI top-left / existing CSS rectangle | all |
| `wave41/candidates-20261002/assets/18-farmstead_a-v1-wave41-v1.png` | `public/assets/buildings/farmstead/farmstead_a-v1.png` | 160×136 | existing fitted building rect, 160x136; do not re-anchor | all |
| `wave41/candidates-20261002/assets/19-farmstead_b-v1-wave41-v1.png` | `public/assets/buildings/farmstead/farmstead_b-v1.png` | 160×136 | existing fitted building rect, 160x136; do not re-anchor | all |
| `wave41/candidates-20261002/assets/20-farmstead_working-v1-wave41-v1.png` | `public/assets/buildings/farmstead/farmstead_working-v1.png` | 160×136 | existing fitted building rect, 160x136; do not re-anchor | all |
| `wave41/candidates-20261002/assets/21-farmstead_winter-v1-wave41-v1.png` | `public/assets/buildings/farmstead/farmstead_winter-v1.png` | 160×136 | existing fitted building rect, 160x136; do not re-anchor | winter |
| `wave41/candidates-20261002/assets/22-chicken_flock_a-wave41-v1.png` | `public/assets/wave23/life_ground/chicken_flock_a.png` | 136×104 | {"x": 68, "y": 100} | all |
| `wave41/candidates-20261002/assets/24-rock-wave41-v1.png` | `public/assets/terrain/rock.png` | 512×512 | [0,0] | all |
| `wave41/candidates-20261002/assets/25-footprints_dotted_ne-v1-wave41-v1.png` | `public/assets/wave7/signifier/footprints_dotted_ne-v1.png` | 128×64 | {"x": 64, "y": 62} | all |
| `wave41/candidates-20261002/assets/26-footprints_dotted_nw-v1-wave41-v1.png` | `public/assets/wave7/signifier/footprints_dotted_nw-v1.png` | 128×64 | {"x": 64, "y": 62} | all |
| `wave41/candidates-20261002/assets/27-seal_slot-wave41-v1.png` | `public/assets/ui/seal_slot.png` | 64×64 | UI top-left / existing CSS rectangle | all |
| `wave41/candidates-20261002/assets/28-icon_actual-wave41-v1.png` | `public/assets/wave19/timeline/icon_actual.png` | 96×96 | UI top-left / existing CSS rectangle | all |
| `wave41/candidates-20261002/assets/29-icon_right_toll-v1-wave41-v1.png` | `public/assets/wave14/ui-icons/icon_right_toll-v1.png` | 96×96 | UI top-left / existing CSS rectangle | all |


## 용량과 공통 처리

이 실행 묶음 26장: 메타데이터 제거 후 원본 합계 6.60 MiB, 원본 RGBA 한 벌 산술 합계 11.78 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.

기존 여름 base에 연결된 봄·가을·겨울 key/URL/크기는 [계절 짝 목록](existing-season-pairs.json)의 byBase에서 확인한다. Wave43은 해당 base의 spring만 이 묶음 조각으로 바꾸고 autumn/winter를 보존한다. 계절 짝이 없는 그림은 반전·색조 변경으로 임의 생성하지 않는다.
