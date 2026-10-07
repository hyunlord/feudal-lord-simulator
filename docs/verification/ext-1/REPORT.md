# EXT-1 보고서 — 닫힌 종류 목록 → 데이터 레지스트리·열린 id

관문: 통과 — 동작 불변. 가드레일 1회차 seed 1~5의 최종 상태 해시 다섯이 모두 기준선 `baseline-11205c9`와 같다(RR16에 따라 2회차 생략). 저장 지문도 그대로이고, 고정 저장 504개가 모두 불러와진다.

- **지시**: 사용자 지시(2026-10-06). 확장성 설계 [extensibility.md](../../design/extensibility.md) 3절 EXT-1, 결정 EXT-D2의 순서. 계획은 [ext-1-plan.md](../../design/ext-1-plan.md).
- **결정**: EXT1-1~3. **저장**: 모양을 바꾸지 않았다(v51 그대로, 지문 그대로).

## 실행 위치
- **DGX**:
  - 가드레일 1회차(`engine-EXT1-guard-d3a1d7b`, `d3a1d7b`): seed 1~5 통과, 해시 다섯이 기준선과 같다. 사람 경로 12/12.
  - 바뀐 것에 걸린 시험(`npm run test:changed`, RR16): 1회차 `engine-EXT1-changed-d3a1d7b`는 4,280/4,286. 1회차 실패 6건의 원인은 하나였다. 정의를 통째로 맞춰 보던 시험이 새 칸 `builderTicks`를 몰랐고, 확장성 시험 둘이 그 실패를 넘겨받았다. 고친 뒤 2회차 `engine-EXT1-changed2-fa513b6-fa513b6`는 4,286/4,286.
- **Mac**:
  - 시험: `contentRegistry` 4/4, `stoneTownBuildings` 5/5, `phase9Config` 5/5, `phase3Config` 7/7.
  - 확장성 시험: `buildingCatalogExtensibility` 1/1(사본에 새 건물을 넣고 tsc와 렌더 시험 17개), `resourceCatalogExtensibility` 1/1.
  - typecheck.

| seed | 멈춘 틱 | 가드레일 | 최종 상태 해시(앞 16자) | 기준선과 같음 |
|---|---|---|---|---|
| 1 | 372,667 | 통과 | `9b630fec6cf85de5` | 예 |
| 2 | 281,540 | 통과 | `b2a14294ff70b33b` | 예 |
| 3 | 299,186 | 통과 | `d93f5bee75295082` | 예 |
| 4 | 281,572 | 통과 | `52114274ff626021` | 예 |
| 5 | 599,642 | 통과 | `abebbf9529dc3f06` | 예 |

## 무엇을 바꿨나
- **타입은 데이터에서**(EXT1-1):
  - 건물 종류는 `BUILDING_KINDS`, 세력은 `FACTION_IDS`·`FACTION_KINDS`라는 `as const` id 목록에서 타입을 뽑는다.
  - 물자(`RESOURCE_CATALOG`)와 직업(`TRADE_IDS`)은 원래 그랬다.
  - 손으로 쓴 유니온은 없어졌다. core 팩이 컴파일할 때 받는 안전은 그대로다.
- **실행 시 레지스트리** `CONTENT_REGISTRY`(`src/content/contentRegistry.ts`):
  - 다섯 갈래(건물·물자·직업·세력·세력 종류)마다 `ids`·`has`·`get`이 있다. `get`은 모르는 id면 갈래와 id를 밝힌 오류를 낸다.
  - EXT-3b의 팩 불러오기가 여기에 팩의 종류를 더한다.
- **빠짐없는 표 → 정의의 칸**(EXT1-2):
  - 건물 정의에 `builderTicks`를 넣었다. `REQUIRED_BUILDER_TICKS`는 그 칸을 모은 보기다.
  - 세력 정의에 `portraitPools`·`leaderMinAge`를 넣었다. `FACTION_PORTRAIT_POOLS`·`FACTION_LEADER_MIN_AGE`도 보기다.
  - 새 종류는 정의 한 곳만 쓰면 된다. 확장성 시험의 가짜 건물도 공사 표 줄이 없어지고 정의 칸으로 바뀌었다.
- **불러올 때 검사**(EXT1-3):
  - `assertGameStateSnapshot`이 `contentStateProblem`을 부른다.
  - 검사 대상: 건물·공사 종류(성벽 구간은 제외), 재고·예약·창고 예약의 물자 키, 가구의 직업 id, 세력 id·종류.
  - 모르는 id가 있으면 어느 경로의 어느 값인지 밝혀 거부한다. 지금까지는 통과했다가 설정을 읽는 순간 깨졌다.
  - 콘텐츠 정의 검사(`contentDefinitionProblems`: 직업 조건의 건물, 직업 입력의 물자)와 등록기 조건의 세력, 시나리오 건물 검사도 같은 레지스트리로 한다.

## 하지 않은 것(계획대로)
- `kind === "mill"` 같은 행동 분기(약 131곳)는 EXT-4 모듈화 때 역할 태그로 바꾼다.
- 화면·그림 코드의 직접 색인(`BUILDING_CONFIG_BY_KIND[...]` 중 렌더 몫)은 렌더 세션이 넘겨받을 것이다.
- 시대·필지·지형·청원 종류 같은 다른 닫힌 목록은 EXT-2·EXT-3에서, 또는 그 체계를 고칠 때 바꾼다.
- 문구 표(`*.ko.ts`)는 EXT-5(문구 키)까지 그대로 둔다.

## 필수 조건
- 바뀐 것에 걸린 시험: 4,286/4,286 — DGX(`engine-EXT1-changed2-fa513b6-fa513b6`, 가벼운 칸, `fa513b6`)
- typecheck — Mac.
- ui-geometry: LM-R2-E와 본선을 합친 머리에서 바뀐 줄 10줄, 200/200칸, 실패 0 — DGX(`engine-EXTLMR-geo5-9a70d70`, 관문 줄). 그 뒤 합친 본선은 화면 입력을 바꾸지 않았다(입력 해시 같음). 앞선 `engine-EXTLMR-geo4-89819eb`도 같은 결과였다.
  - 앞선 시도: `engine-EXTLMR-geo2-0469810`은 DGX가 가득 찬 때라 `modal.lord.registry` 16칸이 클릭 시간 초과였다. `engine-EXTLMR-geo3-0469810`에서 그 줄을 다시 재 20/20을 얻었다.

## 다음 후보
- 로드맵 `TASKS`에 EXT-1~3b 줄이 두 벌 있다(EXT-0이 넣은 S 단계 줄과 엔진 줄 LM 단계). 이번에는 둘 다 갱신했다. 하나로 합칠지는 REMOTE 문서 세션이 정한다.
- EXT-2: 달력·화폐·시작과 끝 연도·시대(장) 구분을 팩 설정으로 옮기고, 코어에 박힌 연도 목록을 만든다.
- 렌더: 화면 코드의 건물 정의 직접 색인을 `CONTENT_REGISTRY.building.get`으로(렌더 몫).
