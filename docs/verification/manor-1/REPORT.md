# MANOR-1 보고서 — 영주관 3×3과 가문 하나로

관문: 통과 — 영주관 3×3(새 지도 다섯 땅·시작 배치, v49 고정 저장 13개 모두 제자리 3×3), 가문 하나(영주 모드·캠페인 첫 가문 = 고른 가문, 옛 저장 이행에서 옛 이름 0곳). 가드레일 5/5, 새 기준선 `baseline-11205c9`(이유: 3×3 배치, 가솔의 성). RECOVER-1과 함께 병합(사용자 판정 2026-10-06).

- **지시**: 사용자 지시(2026-10-05), 렌더 요청 [LR1-D](../../requests/engine-lr1d-manor-house.md).
  - ① 영주관 2×2 → 3×3. 지도 생성과 옛 저장 이행에서 3×3이 들어갈 곳을 고른다.
  - ② 가문 하나로: 새 게임에서 고른 가문(기본 드 해버럴)이 영주 가문이고, 문장도 같다. 옛 저장은 이행에서 지금 영주 가문을 고른 가문으로 바꾼다. 캠페인도 같은 규칙인지 확인한다.
  - 가드레일이 바뀌면 이유와 새 기준선을 둔다.
- **명세**: [영주관](../../design/manor-house.md) MH-1·MH-2·MH-5, [등록기](../../design/registry.md) ER-9. **결정**: MNR-1~5. **저장**: v50.

## 실행 위치
- **DGX**: 전체 회귀, 가드레일, 깨끗한 클론, ui-geometry(해당하면).
- **Mac**: 시나리오 시험(`manorHouse` 5/5, `playerHouse` 3/3, `registry` 9/9, `failureLadder` 12/12, `factionChronicleTab` 6/6, `zones` 11/11, `saveSystem` 14/14, `saveSchemaMigration` 3/3, `ledger` 10/10, `routingRoadBuildingCache` 8/8, `manorHouseArt` 5/5), typecheck, 저장 고정본·지문 생성.

## 무엇을 깔았나
- **영주관 3×3**(MH-1, MNR-1): `BUILDING_CONFIG_BY_KIND.manor_house`가 3×3이다.
  - 새 지도는 같은 자리 규칙으로 3×3을 놓는다. 자리는 한 칸 서쪽이다(강가 (33,41), 그 밖의 땅 (33,36)).
  - v35 이행은 그때 크기 2×2를 그대로 쓴다(지난 단계의 결과를 바꾸지 않는다).
- **옛 저장의 3×3**(MH-5, MNR-2, `growManorHouse`):
  - 옛 2×2를 품는 3×3 가운데 새 칸이 빈 것을 고른다(옛 모서리 → 서 → 북 → 북서).
  - 안 되면 새 지도 규칙의 자리, 그다음 가장 가까운 빈 3×3을 쓴다. 끝내 없으면 영주관 없이 남는다.
  - 다른 건물의 칸은 빼앗지 않는다.
  - v49 고정 저장 13개는 모두 제자리였다(그대로 8, 북쪽 한 칸 4, 서쪽 한 칸 1).
- **가문 하나**(MNR-3, HOUSE-1): 플레이어 가문 = 영주의 첫 가문(`lordship.house`, order 1).
  - 새 게임의 `house`(기본 `{ name: "de Haverel", arms: "haverel" }`)가 그것이 된다.
  - 문장은 고른 id에서 그린다: `heraldrySeed = armsHeraldrySeed(arms)`.
  - 뒤 가문(FL-7)은 seed로 정하되 바로 앞 가문의 이름은 피한다.
  - `registry.house`와 등록기의 `lordHouse`·`withLordHouse`는 없앴다.
- **캠페인**(확인 결과): 같은 규칙으로 맞췄다. 결정 HOUSE-1이 캠페인의 드 포콩발도 하나로 묶으라고 했다. 그래서 LM9-6의 "캠페인은 그대로"를 MNR-3이 바꾼다. 캠페인 새 게임도 기본 드 해버럴이다.
- **옛 저장의 가문**(MNR-4):
  - 영주 모드 v49 저장: 고른 가문이 첫 가문이 된다. 저장에 적힌 옛 이름(가솔의 성·기록 원장·장부)이 모두 고른 이름으로 바뀐다. 시험은 옛 이름이 저장 어디에도 남지 않음을 본다.
  - 고른 가문이 없는 저장(캠페인·샌드박스): 가진 가문을 그대로 둔다.
  - 영주권이 안 적힌 저장에는 v49의 seed 가문을 적어 둔다.
- **저장 v50**: `RegistryState.house` 없앰, `LordHouse.arms` 추가, 영주관 3×3. 고정 저장 `fixtures/saves/v50`(v49에서 13개), 지문 `schemaFingerprint.v50.json`.

## 관문 결과
- 영주관 3×3: 새 지도 다섯 땅 × 시작 배치 다섯, 그리고 v49 고정 저장 13개 모두 3×3, 풀밭, 길 없음, 자기 칸(MH-1·MH-5 시험).
- 가문 하나: 영주 모드·캠페인 seed 1~3 새 게임의 첫 가문이 드 해버럴·`haverel`·같은 문장 씨앗. 고른 가문 `de Wyke`도 두 모드에서 같다(ER-9 시험). 영주 모드 v49 저장 이행 뒤 옛 이름 0곳(HOUSE-1 시험).
- **가드레일**(DGX `11205c9`, 1회차): 5/5, `baseline-eb18454` 대비 모두 통과(L4 24/24, 서비스 공백·교착·밀 0 방앗간 회귀 없음). 사람 경로 12/12.
  - 끝 상태 해시 다섯이 바뀌어 새 기준선 [`seeds/baseline-11205c9.json`](../../../seeds/baseline-11205c9.json)을 둔다.
  - 까닭 하나: 3×3 영주관과 그 둘레 다섯 칸 여유가 한 칸 넓어 마을이 짓는 자리가 달라진다. seed 1·3·4·5의 끝 틱이 +6,265·+19,624·+61·+24,480이고, 헛간 수가 ±1~2다.
  - 까닭 둘: 영주 가솔의 성이 드 해버럴이 된다. seed 2는 지표·끝 틱이 같고 해시만 다르다.
- **고정값 재기록**(MNR-5): `fixtures/ledger/world-baseline-person0.json`(두 경우), `tests/autoplayBotRecovery.test.ts`(B4), `tests/routingRoadBuildingCache.test.ts`(둘). 영주관을 2×2로 돌려도 해시가 움직여, 이름·영주권 몫이 있음을 확인했다.

## 필수 조건
- 전체 회귀 4,933/4,933 — DGX `11205c9`.
- 깨끗한 클론: 5,054/5,054·build — DGX(RECOVER-1과 함께, 깨끗한 클론 `ee5ae2a`, `engine-RECOVER1-clone-ee5ae2a`). MANOR-1만의 회귀: 4,933/4,933 — DGX `11205c9`(`engine-MANOR1-test2-11205c9`).
- ui-geometry: UI 입력 해시가 본선과 같다 — 재지 않음.
- typecheck — Mac.

## 렌더에 넘길 것
- 영주관 그림은 발자국에서 배율을 계산하므로 코드 변경 없이 3×3으로 그려진다(마름모 128 → 192 px). 같은 카메라 전후 캡처만 하면 된다. 옮겨진 영주관은 id가 새 자리를 따른다(a/b 그림이 바뀔 수 있음).
- 가문 고르기(LM-R3): 후보 id마다 `armsRecipe(armsHeraldrySeed(id), MANOR_HOUSEHOLD)`로 그리고, 고른 `{ name, arms }`를 `newGameState({ ..., house })`에 넘긴다. 이름 후보는 `LORD_HOUSE_NAMES`이고, 읽기는 `LORD_HOUSE_NAMES_KO`다.
- 연대기 `houseArms`: order 1은 이제 기본 가문의 문장이다. 고른 가문이 기본과 다르면 `lordHouseByOrder(state, order)?.heraldrySeed`를 먼저 읽어야 맞다.

## 다음 후보
- 도시 성장 멈춤 진단([보고서](../city-growth/REPORT.md)): seed 3의 붕괴는 3×3 배치가 연 다른 길이 얇은 빵 비축의 덫에 든 것이고(가문 통일은 이름만 바꿈), 덫은 RECOVER-1이 고쳤다.

## 소요 시간
- 시작: 10-05 13시 무렵 KST(첫 커밋 13:24).
- 가드레일 통과: 10-05 저녁(`engine-MANOR1-guard-11205c9`).
- 병합: 10-06 14시 무렵 KST — 도시 붕괴 진단과 RECOVER-1을 기다렸다(사용자 판정 "덫을 고친 뒤 그 위에 병합").
