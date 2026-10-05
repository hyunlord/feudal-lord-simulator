# 엔진 요청 — 영주관 발자국 3×3과 영주 가문 하나로 (렌더 A, LR1-D 2026-10-05)

사용자 판정(2026-10-05)에서 나온 엔진 몫 둘. 렌더는 엔진 파일을 고치지 않는다.

## 1. 영주관 발자국 3×3 (LR1-D4, 사용자 결정)
- 지금: 엔진의 영주관(`manor_house`, 미리 놓이는 건물)은 2×2 발자국이다. Astra의 영주관 그림(Wave 12 manor_house_a/b, 빈 영주관 a_empty·b_empty-v2, 416×328 캔버스, 피벗 (249|251, 319))은 3×3으로 그려져, 렌더가 2×2에 채움 0.87로 줄여 그린다(`src/render/manorHouseArt.ts`, LM-R1 LR1-D4).
- 요청: 영주관 발자국을 3×3으로. 영주관 자리를 고르는 여는 마을(openingVillage)·저장 이주(옛 저장의 2×2 영주관)·길 접근·집 자리와의 겹침을 함께.
- 렌더가 이어서 할 일: 발자국이 3×3이 되면 `manorHouseArt.ts`의 채움을 원래 크기로 되돌리고 같은 카메라 전후 캡처.

## 2. 새 게임에서 고른 가문 = 영주권의 가문 (LR1-D5에서 드러남)
- 지금 가문이 둘이다: 등록기의 플레이어 가문(ER-9 `registry.house`, 새 게임 선택값, 기본 `{ name: "de Haverel", arms: "haverel" }` — 문장은 이름표뿐, 그림 조합 없음)과 영주권의 가문(`lordshipOf(state).house`, seed 1 영주 모드에서 "de Fauconval", heraldrySeed로 문장을 만든다).
- 화면(영주권 화면·연대기·홈 청원 카드의 문장 원)은 영주권의 가문을 그린다. 사용자 판정 D5는 "새 게임에서 바꾼 문장"이다 — 둘이 같아야 그 말이 참이 된다.
- 요청: 영주 모드 새 게임에서 고른 가문(이름·문장)이 영주권의 가문(이름, 문장 씨앗 또는 문장 조합)이 되게. 문장 id(`arms`)가 무엇으로 그려지는지(조합 표, 또는 heraldrySeed)도 정해 주면 LM-R3의 가문 고르기 화면이 그것을 쓴다.

## 엔진 답 (MANOR-1, 저장 v50)
- **1. 영주관 3×3**: `BUILDING_CONFIG_BY_KIND.manor_house`가 3×3이다. 새 지도는 같은 자리 규칙으로 3×3을 놓고(새 게임 자리가 한 칸 서쪽, 예: 강가 (33,41)), v49 저장은 2×2를 제자리 3×3으로 넓힌다(안 되면 가장 가까운 빈 3×3). 길 접근은 필요 없고(`requiresRoad: false`), 다른 건물 칸은 빼앗지 않는다. 명세 [영주관](../design/manor-house.md) MH-1·MH-5, 결정 MNR-1·MNR-2.
  - 렌더 몫: `src/render/manorHouseArt.ts`는 발자국에서 배율을 계산하므로(채움 0.87 × 발자국 마름모 너비) 코드 변경 없이 3×3 크기로 그려진다(마름모 128 → 192 px). 같은 카메라 전후 캡처만 하면 된다. 엔진이 `tests/manorHouseArt.test.ts`의 2×2 고정 숫자를 발자국에서 읽게 고쳤다. 옮겨진 영주관은 id가 새 자리를 따른다(`manorHouseVariant`의 a/b가 바뀔 수 있다).
- **2. 가문 하나로**: 새 게임에서 고른 가문(`NewGameOptions.house`, 기본 `{ name: "de Haverel", arms: "haverel" }`)이 영주권의 첫 가문(`lordshipOf(state).house`, order 1)이다. 영주 모드·캠페인·샌드박스가 같다. `registry.house`와 등록기의 `lordHouse`는 없어졌다. 결정 MNR-3·MNR-4.
  - **문장 id가 그려지는 법**: `heraldrySeed = armsHeraldrySeed(arms)`(`src/engine/lordshipState.ts`). 화면은 지금처럼 `armsRecipe(lordHouse(state).heraldrySeed, MANOR_HOUSEHOLD)`로 그리면 된다. LM-R3의 가문 고르기 화면은 후보 id마다 `armsRecipe(armsHeraldrySeed(id), MANOR_HOUSEHOLD)`로 그리고, 고른 `{ name, arms }`를 `newGameState({ ..., house })`에 넘긴다. 이름 후보는 `LORD_HOUSE_NAMES`(이웃·백작·주교 이름과 겹치지 않는 목록), 한국어 읽기는 `LORD_HOUSE_NAMES_KO`.
  - 렌더 몫: 연대기의 `houseArms`(`src/ui/chronicle/chronicleScreenModel.ts`)는 order가 있으면 `lordHouseHeraldrySeed(seed, order)`를 쓴다. order 1은 이제 기본 가문의 문장이다. 고른 가문이 기본과 다르면 `lordHouseByOrder(state, order)?.heraldrySeed`를 먼저 읽어야 맞다.
