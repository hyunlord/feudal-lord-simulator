# wave22-heath

분류 가; 2장; 예상 0.5–1.0h.

src/render/wave22GroundManifest.generated.ts:24의 decals/heath_patch_a와 같은 객체 형식으로 B/C 두 행 추가. src/content/scenario/archetypes.ts:54 chalk downs ground.decals에 두 key 추가(데이터 배열 변경). src/render/archetypeGroundModel.ts:130 landArtKeys가 선택된 decal을 preload하고 src/render/archetypeGroundDraw.ts:262 drawLandDecals가 그대로 그린다. 고정 seed의 decal 선택 해시를 유지하며 목록 추가에 따른 배치 변경은 승인 캡처로 확인한다. 배율 DECAL_SCALE=0.5(src/render/archetypeGroundDraw.ts:44); 크기는 B96×64→48×32world, C128×96→64×48world. 피벗 B(48,56), C(64,88). 계절 짝 없음, 기존 A처럼 모든 계절 사용. 땅 위, 도로/건물 있는 칸 제외. 먼 줌은 기존 지면 chunk 렌더를 유지. INSTALL_LISTS/wave22-heath.fragments.ts를 지정 배열에 붙여 넣는다. 백악 땅 heath patch 지역을 여름/겨울 캡처하고 밝은 경계와 반복 덩어리가 없는지 확인.
공통 설치 계약: inbox 원본 바이트는 보존한다. 런타임 파일은 C2PA 메타데이터만 제거하고 픽셀·알파·캔버스는 유지한다. 카탈로그 URL이 assets/로 시작하면 실제 파일은 public/assets/ 아래다. 설치 대장 docs/provenance/assets.csv에는 실제 산출물 SHA와 원본 경로를 남긴다. installed_by는 성공 캡처 후 작업 ID(NAT-3/NAT-5/LM-R1 등)를 넣는다. 설치 커밋 SHA는 provenance와 설치 보고서에 별도 기록한다(지금 미리 확정하지 않는다). 제안값은 ../INVENTORY.csv 참조. 좌우 반전 금지. 계절은 0봄/1여름/2가을/3겨울. 원본 metadata에는 수령 당시 candidate가 남아 있으나 승인 판정은 INBOX_LEDGER의 confirmed가 우선한다.

검증: 신규 게임 다섯 땅과 큰 도시 ch4-1380 저장에서 대상이 있는 카메라를 고정하여 줌0.6/1.0/1.4 전후, 여름·겨울 및 해당 계절을 캡처한다. 카메라 좌표/seed/틱/HEAD를 기록한다. 본 문서는 설치 계획이며 런타임 캡처 합격을 주장하지 않는다. 파일 규격·피벗·연결 포트 원문은 ../METADATA/nature.json, 그림별 매핑은 ../INVENTORY.csv에 있다. 예상 작업량은 렌더 1명 엔지니어 시간 추정이며 그림 재작업 시간 제외.


| inbox 경로 | public 대상 | 규격 | 피벗 | 계절 |
|---|---|---|---|---|
| `wave22/rework-20260927/assets/decals/heath_patch_b-v1.png` | `public/assets/wave22/decals/heath_patch_b.png` | 96×64 | [48, 56] | all |
| `wave22/rework-20260927/assets/decals/heath_patch_c-v1.png` | `public/assets/wave22/decals/heath_patch_c.png` | 128×96 | [64, 88] | all |


## 용량과 공통 처리

이 실행 묶음 2장: 메타데이터 제거 후 원본 합계 0.02 MiB, 원본 RGBA 한 벌 산술 합계 0.07 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
