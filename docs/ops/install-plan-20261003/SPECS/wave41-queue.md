# wave41-queue

분류 나; 1장; 예상 2–4h.

src/render/wave9ArtManifest.generated.ts:39 signifier_hungry_queue는 등록만 있고 해당key의 소비함수는 source검색에서 발견되지 않음. src/engine/foodShortage.ts:25 foodShortHouseIds와 GameState.houses foodShortSinceTick/residents, 식량서비스 건물 도로접근을 읽어 render queue item을 만든다. 엔진 shortage 상태가 있어서 B.128×64 pivot(64,32). 문앞에서 도로를막지않는 ground anchor; 그림속사람을기존walker17.6world와맞춰scale0.25부터 확인. 경제적실제배급행렬/사람수를주장하지 않는 위기표현. 줌0.6은숨기고1.0/1.4만. 기근발생전/발생/회복, 건물지붕뒤·앞 깊이순서와 중복정지사람 오해 확인.
공통 설치 계약: inbox 원본 바이트는 보존한다. 런타임 파일은 C2PA 메타데이터만 제거하고 픽셀·알파·캔버스는 유지한다. 카탈로그 URL이 assets/로 시작하면 실제 파일은 public/assets/ 아래다. 설치 대장 docs/provenance/assets.csv에는 실제 산출물 SHA와 원본 경로를 남긴다. installed_by는 성공 캡처 후 작업 ID(NAT-3/NAT-5/LM-R1 등)를 넣는다. 설치 커밋 SHA는 provenance와 설치 보고서에 별도 기록한다(지금 미리 확정하지 않는다). 제안값은 ../INVENTORY.csv 참조. 좌우 반전 금지. 계절은 0봄/1여름/2가을/3겨울. 원본 metadata에는 수령 당시 candidate가 남아 있으나 승인 판정은 INBOX_LEDGER의 confirmed가 우선한다.

검증: 신규 게임 다섯 땅과 큰 도시 ch4-1380 저장에서 대상이 있는 카메라를 고정하여 줌0.6/1.0/1.4 전후, 여름·겨울 및 해당 계절을 캡처한다. 카메라 좌표/seed/틱/HEAD를 기록한다. 본 문서는 설치 계획이며 런타임 캡처 합격을 주장하지 않는다. 파일 규격·피벗·연결 포트 원문은 ../METADATA/nature.json, 그림별 매핑은 ../INVENTORY.csv에 있다. 예상 작업량은 렌더 1명 엔지니어 시간 추정이며 그림 재작업 시간 제외.


| inbox 경로 | public 대상 | 규격 | 피벗 | 계절 |
|---|---|---|---|---|
| `wave41/candidates-20261002/assets/23-hungry_queue-v1-wave41-v1.png` | `public/assets/wave9/signifier/hungry_queue-v1.png` | 128×64 | inherit existing registration; see per-asset metadata | all |


## 용량과 공통 처리

이 실행 묶음 1장: 메타데이터 제거 후 원본 합계 0.01 MiB, 원본 RGBA 한 벌 산술 합계 0.03 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
