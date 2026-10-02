# L6 담비 판정: 백작 가문 허용 예외

**결론: L6는 백작(earl) 가문이다. 새 사용자 기준에 따라 담비 허용 예외로 처리하며 L6 30장을 재작업 목록에서 제외한다.** `L6`라는 이름이나 그림만으로 추측하지 않고 제작 기록과 실행 코드의 신분 연결을 모두 확인했다. 앞선 감사 POR-01은 포괄 금지 규정과 설치 자산의 충돌을 지적한 항목이었으나, 이번 신분 확인 및 사용자 예외 기준으로 해소된다.

기준 작업 트리: `/Users/rexxa/github/fls-landui`. 아래 경로는 모두 이 루트 기준이며 2026-10-02 확인했다.

## 직접 근거

| 근거 파일·행 | 확인 내용 |
|---|---|
| `assets-inbox/lineage/prod2-20260928/records/scripts/L6-work.mjs:23` | 제작 공통 프롬프트가 `Earl household highest nobility costume`이라고 명시하고 흰 담비의 검은 꼬리 무늬를 지정한다. |
| `assets-inbox/lineage/prod2-20260928/records/scripts/L6-work.mjs:32` | 아기 복식도 `Earl fine crimson/deep blue swaddle with small ermine trim`, 성인도 `Earl ... ermine mantle`로 기록한다. |
| `assets-inbox/lineage/prod2-20260928/records/TRAITS.md:10` | L6_202의 복식이 `Earl fine crimson/deep blue wool, ermine mantle`이다. 같은 가문 L6_203~304도 행11~18에서 같은 신분을 명시한다. |
| `assets-inbox/lineage/prod2-20260928/records/REPORT.md:27` | 담비는 L6에만 사용하고 L7은 여우·다람쥐 계열 젠트리로 구분했다고 명시한다. |
| `src/content/portraitPool.ts:566` | L6_201_baby의 실제 런타임 초상 메타데이터가 `occupation:"earl"`, `classBand:"gentry"`, `lineage:"L6"`다. 행566~595의 L6 전체30개 JSON 행을 파싱해 **모두 occupation=earl**임을 확인했다. `gentry`는 코드의 넓은 클래스 밴드이므로 이를 근거로 백작이 아닌 소영주라고 판정하면 안 된다. |
| `src/content/factionConfig.ts:58` | `overlord`의 초상 풀은 `earl_house`다. |
| `src/content/factionConfig.ts:65` | 실제 가문 연결은 `overlord:"L6"`, `neighbour_1:"L7"`다. |
| `src/content/factionConfig.ts:44` | overlord의 `earldom`을 시드로 선택한다고 주석으로 명시한다. 행47은 EARLDOM_TITLES/EARL_SURNAMES를 사용한다. |
| `src/engine/factions.ts:76` | 실행 시 `FACTION_LINEAGE_SETS[fields.factionId]`를 읽는다. 행78~83은 이전 수장 아들의 다음 세대 초상을 해당 가문에서 고른다. 단순 미사용 상수만 확인한 것이 아니다. |

## 최종 적용

- 대상: `assets-inbox/lineage/prod2-20260928/assets/L6/`의 설치된30장.
- 판정: **earl/comital household → ermine allowed exception**.
- 조치: ART_BIBLE_v2의 백작 가문 예외로 명시, POR-01의 재작업 필요 판정은 해제. 향후 L6 자산을 기사·소영주·일반인 역할에 재사용하지 않도록 신분 메타데이터 계약을 유지한다.
- 승인된 Pool3 I101/I102/I103의 기존 승인 상태는 그대로 유지한다. 본 확인으로 재제작하지 않는다.
- 확인 범위: 제작 의도 및 현재 코드 매핑을 읽어서 검증했다. 새 게임을 실행해 모든 상속 세대를 재현한 것은 아니다.
- 이번 조사에서 게임 코드·그림·기존 감사 산출물은 변경하지 않았다.

Graft: 이번 추가 조사3회, 도구 보고 절감 합계109,743토큰(8,702 + 90,248 + 10,793). 가격 수치 미제공.
