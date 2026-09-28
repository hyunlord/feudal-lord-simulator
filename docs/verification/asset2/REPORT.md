# ASSET-2 runtime 정리 — ASSET-1 판정 반영 — 보고서

관문: ① ASSET-1 스크립트 재실행 "장부·대장 어디에도 없음" 0 · "옛 버전 등록" 0 · caBX 0 · 같은 이름 다른 내용 0(본선 10 · 7 · 6 · 4) · ② 배율 시험(이야기 워커 = 일반 워커 ±10 %, Wave 13 동물 기준) · ③ C25 판 그대로(재기록 없음) · ④ 스킨 감사 0 / 909 · 면적 5.9 % / 6 % · 튜토리얼 22 = 22 · B9·TOUCH 14/14 · ⑤ DGX 전체 회귀 3,288/3,288 · 병합 전 검사 · 클론(7절)

새 그림 재작업은 없다. 모두 코드·등록 정리다.

## 1. 안 쓰는 runtime 파일 10개 삭제
- `buildings/historical-palisade-reserved/*` 5, `runtime-reserved-v1/market_bread_basket-v2.png` — 장부·설치 대장 어디에도 없고 코드가 읽지 않으며 caBX가 남은 6개 전부.
- `ui/illumination_corner·parchment_texture·scroll_frame·wood_console.png` — UI-KIT-1 이후 어느 화면도 그리지 않는다. Phase 13 생성기(`scripts/generateUiAssets.py`)·점검기(`verifyUiAssets.ts`·`uiAssetManifest.ts`)와 그 시험은 임시 폴더의 고정값으로 도구 자체를 시험해서, 파일을 지워도 통과한다(시험 41 + 파이썬 35). 도구는 Phase 13 기록으로 남기고 머리말에 넷이 퇴역했다고 적었다. `seal_slot.png`는 쓰인다.

## 2. 옛 판 등록 해제 — 퇴역
- 도로 `earth_strip_{a,b}-v2`: `BOUNDARY_ASSETS` 두 줄과 `ROAD_STRIP_SETS.earth.v2` 삭제. 기본은 v3(RS1), 비교용 `road-strip=`는 v1·v3. 시험 `roadRibbon`의 v2 비교를 v1로(결정 ASSET2-D2).
- 성벽 면 `palisade_face_{a,b}-v1`·`stone_face_{a,b,c}-v1`: `palisadeFaceV1`·`stoneFaceV1` 묶음과 매니페스트 줄 삭제(D3b-2 이후 그리지 않음). 같은 v1 묶음의 `palisade_face_c-v1`도 함께 퇴역(더 큰 번호는 없지만 그 묶음은 그려지지 않는다).
- 퇴역 규칙(C1f와 같음): 파일은 `assets-inbox/retired/<옛 경로>`로 옮기고, 설치 대장 행은 `status=retired`·`runtimePath`를 그 경로로, INBOX 장부에 `retired` 행(`installed_by=ASSET-2`). 8개.

## 3. 초기 에셋(장부 밖) — 쓰이는 것이 남아 목록으로 보고
- 메뉴 썸네일 폴백은 BLD-REG가 이미 목록의 `thumbnail` 키로 바꿨다(`{ file: "well" }` 등).
- `worldAssetManifest.generated.ts`의 초기 건물 17개는 **모두 아직 쓰인다** — 지우면 그림이 달라진다.

| 파일 | 쓰이는 곳 |
|---|---|
| `buildings/well.png`·`storehouse.png`·`barn.png`(곡창)·`logging_camp.png` | 지도의 그 건물 그림(새 그림 없음), 메뉴 썸네일 |
| `buildings/house_l0~l4.png` | 역사 주택 그림이 준비되기 전의 대체 그림, 가림(occlusion)·지형 그리기·계절 그림이 읽는 크기, 첫 화면 카메라(`house_l0`·`well`의 크기) |
| `buildings/mill·masonry·sawmill·church·keep·market·quarry.png` | 시설 그림(Wave 12)이 준비되기 전의 대체 그림, 가림·계절 그림이 읽는 크기 |
| `buildings/stone_wall_segment.png` | 월드 매니페스트에 등록(그리는 경로는 확인하지 못했다 — 다음 후보) |

- 이 목록을 줄이려면 가림·계절·카메라가 읽는 크기를 역사·시설 그림 쪽으로 옮기는 작업이 먼저다(규칙·렌더 차이가 나므로 따로).

## 4. 자원 아이콘
- `ResourceArtwork`가 `runtime-icons-v1/<키>.png`를 경로 조립으로 읽던 것을 없앴다. UX-2 자원 시트(`icon_resource_sheet`)에 칸이 있는 것(인구·빵·목재·석재·돈)은 두 크기 모두 그 칸(작은 크기 16 px = 24 px 칸의 2/3), 칸이 없는 것(밀·통나무·원석)은 큰 크기에서 RES-REG의 범용 자루·상자와 이름, 작은 크기(자원 막대 둘째 줄, 글로 이름을 적는 곳)에는 그림 없음.
- 자원 막대가 실제로 보이던 옛 아이콘은 원석(석재 칸 둘째 줄) 하나였다. 이제 "원석 N"만 보인다. [전](captures/a2-resource-bar-before.jpg) · [후](captures/a2-resource-bar-after.jpg)
- 목록의 `iconKey` 칸을 지우고 `runtime-icons-v1` 8장을 퇴역(2절 규칙). Wave 18·UI P0에 밀·통나무·원석 칸은 없다 — Astra에 세 칸을 요청할 후보.

## 5. 배율
- **Wave 9 이야기 워커**(`storyWorldProps`): 고정 × 0.5(그림 높이 약 31~34 px, 일반 워커의 약 1.8배) → 워커 합성기와 같은 규칙: 그림 높이 `WALKER_FIGURE_PX` = 32 × `VILLAGER_WORLD_SCALE`(0.55) = 17.6 px. 시트마다 그림 높이(칸의 알파 > 32 중앙값, 시트에서 잰 값: 장례 65·떠나는 가족 62·청원 남 65·여 62·전령 68)로 나눈다. 아이는 가족의 비율을 그대로 써서 아이 크기로 남는다. 상수는 합성기(`walkerComposer.ts`)로 옮겨 한 곳이다. [전](captures/a1-story-walkers-before.jpg) · [후](captures/a1-story-walkers-after.jpg)
- **Wave 13 동물(설치 기준, MOVE-2용)**: `src/render/animalScale.ts`의 `WAVE13_ANIMAL_SCALE` — 한 묶음 한 배율(양·돼지·거위·개는 Astra가 그린 비율 그대로), 큰 동물(소 64·황소 71·짐말 72.5 px, 가장 넓은 분리된 그림의 불투명 폭)의 평균 몸길이가 목초지에 설치된 소(`cattle_pair` 128 px를 30 px로: 소 61 px → 14.3 px)와 같게.
- 시험 `tests/asset2Scales.test.ts`: 이야기 워커 다섯의 그림 높이를 시트에서 다시 재서(기록값 ±1 px) 그린 높이가 17.6 px ±10 %, Wave 13 소·황소·짐말이 설치된 소 ±10 %, 양은 소의 0.35~0.65, 거위는 0.35 미만.

## 6. 같은 이름 다른 내용·사소한 것
- `wave11/kit_stone|kit_timber/stage_*_medium-v1.png` 4쌍 → 킷 파일에 계열 접두(`stone_stage_*`, `timber_stage_*`, `public_…`, `defense_…`): `installWave11.py`에 규칙을 넣고 다시 돌렸다(33개 이름, 매니페스트 키는 그대로, 설치 대장 행 갱신).
- 말뚝 면 v2(`palisade_face_a·b-v2`): 양 끝 말뚝 끝(6~8행)의 색 띠 29·44 px — 같은 열 아래 나무색으로(알파 그대로). 1 px 가장자리 트림이 아니라 띠 픽셀만 고쳤다.
- 반투명 잔여 점: 11개 중 6개는 1절에서 지운 파일, 남은 5개(다리 둘·석주·겨울 사과나무·전령)의 점(ASSET-1 규칙: ≤ 6 px, 128 미만, 몸체에서 2 px 밖) 176·80·66·136·76 px를 알파 0으로. ASSET-1 표와 같은 수.
- 이 둘은 `scripts/asset2PixelFixes.py`(두 번째 실행은 0개 바꿈): 설치 대장의 `runtimeSha256`·`manualEdits`, 파생 대장(`runtimeAssetDerivatives.generated.ts`)과 증거(`evidence.json`)의 해시를 함께 고친다. 이 일곱은 받은 바이트와 runtime 바이트가 이제 다르다(기록에 적음). 원래 설치 스크립트를 다시 돌리면 점이 돌아오니, 그때는 이 스크립트를 뒤에 돌린다.

## 7. 검증
- 로컬: typecheck, lint, 관련 시험(도로·성벽·매니페스트 75, 자원 목록·자원 막대·RES-REG 확장성 12, Wave 11 킷 12, 설치 대장·좌표 74, 해시·설치 대장 287+3 → 고친 뒤 통과, 배율 2, C25 1, Phase 13 도구 41 + 파이썬 35).
- 관문 ① `method/gate.json`(ASSET-1 스크립트 재실행, [방법](method/README.md)).
- DGX 전체 회귀 `c2a5a3c`: 3,288/3,288(C25 판 포함, 고정값 재기록 없음).
- DGX UI 관문 `c2a5a3c`, 본선 `a33390d9` 대비([gates.json](gates/gates.json)): 스킨 감사 0 / 909(26개 상태), 본선 0 / 788([audit.json](audit/audit.json)); 면적 1280 5.9 % / 6 %, 태블릿 6.4 % / 8 %; 튜토리얼 22 = 22, B9·TOUCH 14/14, 게임패드·초점 복귀, 터치 대상·글자 위반 0.
- 전후 캡처(DGX, UI-5 `petition-open` seed 2, 확대 2): 이야기 워커가 둘레의 일반 워커와 같은 키로, 자원 막대 원석 줄은 글만.
- 깨끗한 클론: 아래에 적는다.
- 증거 0.3 MB.

## 8. 결정
ASSET2-D1~D5([결정 목록](../../decisions/README.md)).
