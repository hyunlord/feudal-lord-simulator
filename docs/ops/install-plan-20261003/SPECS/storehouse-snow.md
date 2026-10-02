# storehouse-snow

분류 나; 3장; 예상 2–4h.

src/render/buildingOverlays.ts:50 drawBuildingOverlays에 storehouse branch를 추가하고 buildingVariantManifest.ts:332 building:storehouse pool의 실제 선택 A/B/C와 눈층을1:1로 묶는다. :59 seasonForObject(seasonBlend(state), building.tx*31+building.ty*17)===3 규칙을 house와 동일하게 재사용한다. state.buildings/kind=storehouse, frameBuildingVariant 결과가 연결데이터.160×136 원본과 동일canvas, installoffset(0,0), 베이스 buildingSpriteFit/alphaBounds/rect에 눈층을 같은crop으로 겹침. 피벗을 눈alpha의중앙으로 재계산하지 않는다. 다른시설/농가/창고B에 A눈을 공용하지 않는다. zoom0.6도 눈은 큰계절표시이므로 유지. A/B/C를 각자 여름→겨울→봄, 0.6/1.0/1.4 캡처, 지붕실루엣밖 눈/부유/수레눈 확인. 목표지붕피복60–80%는 제작검증값이며 런타임출력 재검증한다.
공통 설치 계약: inbox 원본 바이트는 보존한다. 런타임 파일은 C2PA 메타데이터만 제거하고 픽셀·알파·캔버스는 유지한다. 카탈로그 URL이 assets/로 시작하면 실제 파일은 public/assets/ 아래다. 설치 대장 docs/provenance/assets.csv에는 실제 산출물 SHA와 원본 경로를 남긴다. installed_by는 성공 캡처 후 작업 ID(NAT-3/NAT-5/LM-R1 등)를 넣는다. 설치 커밋 SHA는 provenance와 설치 보고서에 별도 기록한다(지금 미리 확정하지 않는다). 제안값은 ../INVENTORY.csv 참조. 좌우 반전 금지. 계절은 0봄/1여름/2가을/3겨울. 원본 metadata에는 수령 당시 candidate가 남아 있으나 승인 판정은 INBOX_LEDGER의 confirmed가 우선한다.

검증: 신규 게임 다섯 땅과 큰 도시 ch4-1380 저장에서 대상이 있는 카메라를 고정하여 줌0.6/1.0/1.4 전후, 여름·겨울 및 해당 계절을 캡처한다. 카메라 좌표/seed/틱/HEAD를 기록한다. 본 문서는 설치 계획이며 런타임 캡처 합격을 주장하지 않는다. 파일 규격·피벗·연결 포트 원문은 ../METADATA/nature.json, 그림별 매핑은 ../INVENTORY.csv에 있다. 예상 작업량은 렌더 1명 엔지니어 시간 추정이며 그림 재작업 시간 제외.


| inbox 경로 | public 대상 | 규격 | 피벗 | 계절 |
|---|---|---|---|---|
| `storehouse-corner/candidates-20261003/assets/storehouse_a_snow-v1.png` | `public/assets/storehouse-corner/storehouse_a_snow-v1.png` | 160×136 | [80,120] (inherit base canvas registration) | winter |
| `storehouse-corner/candidates-20261003/assets/storehouse_b_snow-v1.png` | `public/assets/storehouse-corner/storehouse_b_snow-v1.png` | 160×136 | [80,120] (inherit base canvas registration) | winter |
| `storehouse-corner/candidates-20261003/assets/storehouse_c_snow-v1.png` | `public/assets/storehouse-corner/storehouse_c_snow-v1.png` | 160×136 | [80,120] (inherit base canvas registration) | winter |


## 용량과 공통 처리

이 실행 묶음 3장: 메타데이터 제거 후 원본 합계 0.03 MiB, 원본 RGBA 한 벌 산술 합계 0.25 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
