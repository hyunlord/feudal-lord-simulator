# strip-corners

분류 나; 16장; 예상 6–10h.

src/render/gateCornerModules.ts:22 cornerGateModules의 wall node/arms와 src/render/drawWallFaces.ts:241 drawWallModules를 연결. 4방향×stone/palisade×여름겨울 선택; 엔진 wall graph는 이미 있음. gateEnd terminal은 passage를 막지 않는 장식이어야 하며 모든90도 node에 무작정 fullcorner를 중복하지 않는다. 기존 stoneWallRenderer.ts:36의 앞뒤 순서를 유지.1024×768 pivot(512,544), worldscale0.125 즉128×96world, armLength1tile wallClearance0.65tile endpointOverlap0.35tile joinU224. metadata원문 우선. 같은 기준점/배율 계절짝, 좌우반전/회전재사용 금지. 겹친 벽띠는 모듈 접속 범위만 잘라 이중흉벽을 막는다. 먼 줌0.6에도 벽 연결실루엣은 유지.8재료방향×2계절×3줌, 통행워커가 문앞/뒤 지나가는10초 연속캡처. 확정그림의 잔여 흉벽간격/말뚝밀집은 실제1.0에서 재확인한다. 과거 storehouse-corner 기둥 대체본은 superseded/rejected이므로 사용금지.
공통 설치 계약: inbox 원본 바이트는 보존한다. 런타임 파일은 C2PA 메타데이터만 제거하고 픽셀·알파·캔버스는 유지한다. 카탈로그 URL이 assets/로 시작하면 실제 파일은 public/assets/ 아래다. 설치 대장 docs/provenance/assets.csv에는 실제 산출물 SHA와 원본 경로를 남긴다. installed_by는 성공 캡처 후 작업 ID(NAT-3/NAT-5/LM-R1 등)를 넣는다. 설치 커밋 SHA는 provenance와 설치 보고서에 별도 기록한다(지금 미리 확정하지 않는다). 제안값은 ../INVENTORY.csv 참조. 좌우 반전 금지. 계절은 0봄/1여름/2가을/3겨울. 원본 metadata에는 수령 당시 candidate가 남아 있으나 승인 판정은 INBOX_LEDGER의 confirmed가 우선한다.

검증: 신규 게임 다섯 땅과 큰 도시 ch4-1380 저장에서 대상이 있는 카메라를 고정하여 줌0.6/1.0/1.4 전후, 여름·겨울 및 해당 계절을 캡처한다. 카메라 좌표/seed/틱/HEAD를 기록한다. 본 문서는 설치 계획이며 런타임 캡처 합격을 주장하지 않는다. 파일 규격·피벗·연결 포트 원문은 ../METADATA/nature.json, 그림별 매핑은 ../INVENTORY.csv에 있다. 예상 작업량은 렌더 1명 엔지니어 시간 추정이며 그림 재작업 시간 제외.


| inbox 경로 | public 대상 | 규격 | 피벗 | 계절 |
|---|---|---|---|---|
| `strip-corners/candidates-20261003/assets/corner_palisade_east_summer-v3.png` | `public/assets/strip-corners/corner_palisade_east_summer-v3.png` | 1024×768 | [512, 544] | summer |
| `strip-corners/candidates-20261003/assets/corner_palisade_east_winter-v3.png` | `public/assets/strip-corners/corner_palisade_east_winter-v3.png` | 1024×768 | [512, 544] | winter |
| `strip-corners/candidates-20261003/assets/corner_palisade_north_summer-v3.png` | `public/assets/strip-corners/corner_palisade_north_summer-v3.png` | 1024×768 | [512, 544] | summer |
| `strip-corners/candidates-20261003/assets/corner_palisade_north_winter-v3.png` | `public/assets/strip-corners/corner_palisade_north_winter-v3.png` | 1024×768 | [512, 544] | winter |
| `strip-corners/candidates-20261003/assets/corner_palisade_south_summer-v3.png` | `public/assets/strip-corners/corner_palisade_south_summer-v3.png` | 1024×768 | [512, 544] | summer |
| `strip-corners/candidates-20261003/assets/corner_palisade_south_winter-v3.png` | `public/assets/strip-corners/corner_palisade_south_winter-v3.png` | 1024×768 | [512, 544] | winter |
| `strip-corners/candidates-20261003/assets/corner_palisade_west_summer-v3.png` | `public/assets/strip-corners/corner_palisade_west_summer-v3.png` | 1024×768 | [512, 544] | summer |
| `strip-corners/candidates-20261003/assets/corner_palisade_west_winter-v3.png` | `public/assets/strip-corners/corner_palisade_west_winter-v3.png` | 1024×768 | [512, 544] | winter |
| `strip-corners/candidates-20261003/assets/corner_stone_east_summer-v3.png` | `public/assets/strip-corners/corner_stone_east_summer-v3.png` | 1024×768 | [512, 544] | summer |
| `strip-corners/candidates-20261003/assets/corner_stone_east_winter-v3.png` | `public/assets/strip-corners/corner_stone_east_winter-v3.png` | 1024×768 | [512, 544] | winter |
| `strip-corners/candidates-20261003/assets/corner_stone_north_summer-v3.png` | `public/assets/strip-corners/corner_stone_north_summer-v3.png` | 1024×768 | [512, 544] | summer |
| `strip-corners/candidates-20261003/assets/corner_stone_north_winter-v3.png` | `public/assets/strip-corners/corner_stone_north_winter-v3.png` | 1024×768 | [512, 544] | winter |
| `strip-corners/candidates-20261003/assets/corner_stone_south_summer-v3.png` | `public/assets/strip-corners/corner_stone_south_summer-v3.png` | 1024×768 | [512, 544] | summer |
| `strip-corners/candidates-20261003/assets/corner_stone_south_winter-v3.png` | `public/assets/strip-corners/corner_stone_south_winter-v3.png` | 1024×768 | [512, 544] | winter |
| `strip-corners/candidates-20261003/assets/corner_stone_west_summer-v3.png` | `public/assets/strip-corners/corner_stone_west_summer-v3.png` | 1024×768 | [512, 544] | summer |
| `strip-corners/candidates-20261003/assets/corner_stone_west_winter-v3.png` | `public/assets/strip-corners/corner_stone_west_winter-v3.png` | 1024×768 | [512, 544] | winter |


## 용량과 공통 처리

이 실행 묶음 16장: 메타데이터 제거 후 원본 합계 4.20 MiB, 원본 RGBA 한 벌 산술 합계 48.00 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
