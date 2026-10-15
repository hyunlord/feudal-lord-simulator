# EB-WEIGHT: 9f769ee 입력 확보 뒤 남은 실제 제안

판정: **실제 제안 미확보 28건. 화면 관문 통과 판정은 별도다.** 이 기록은 로컬 보존 JSON/gzip와 소스 읽기만으로 작성했다. 게임·브라우저·DGX 실행, 상태 변경, inventory 변경은 하지 않았다.

기준은 [inventory](inventory.json), [미관측 조건표](missing-inputs.md), [7개 실행 결과](acquisition-results.md), [원본 출처](authentic-input-sources.md), [다음 제한 생산 계획](authentic-input-next.md)이다. 제품은 `0eddc146c7d57b4cae091bff62295a1fc16e1f97`, 7개 완료 실행의 도구는 `9f769ee5b51f356ef0a1f9f61db1adb3e7a2cd84`다. 후속 대기열 결과는 이 판정에 포함하지 않는다.

## 확보된 입력과 분모

7개 실행의 총 **14개 ID는 대상6개와 부수8개를 포함한 수**다. 기존 결과표도 이 분모를 사용한다.

- 대상6개: **010·038·051·052·059·209**. 현재 별도 UI 검증 준비 대상이다.
- 부수8개: **005·032·042·046·083·092·201·211**. 005·046은 기존 실패 사례의 다른 실제 입력이며, 나머지는 inventory에서 한 선택 통과로 기록되어 있다. 이 부수 입력으로 추가 해소되는 `pending` ID는 없다.
- 실제124 입력은 [별도 archive에서 확보](authentic-input-sources.md)한 것이며 위14개와 합쳐 세지 않는다. 하네스 b 재시험은 별도 대기열이다.
- `034·058·144·163`은 inventory의 `steward_route_only`다. 새 저장에서도 영주 미답 제안은 발견되지 않았으며 아래28개 pending과 섞지 않는다.

각 실제 저장 경로·관측 tick·선택 ID는 [acquisition-results의 Genuine offered-state inputs retained 표](acquisition-results.md)에 있다. 이 감사에서는 새7개 폴더의 `*.save.json.gz`를 읽고 실제 `registry.occurrences` 중 `status=offered`이고 저장 tick이 deadline 이내인 항목도 대조했다. 단순한 파일명이나 과거 answered occurrence를 미답 입력으로 세지 않았다.

## 실제 제안 미확보 28개

`002, 011, 013, 015, 018, 019, 025, 029, 033, 035, 037, 057, 061, 075, 076, 077, 080, 090, 128, 131, 132, 133, 139, 143, 147, 150, 157, 174`

이 중 현재 후속 대기열의 대상 **12개**는 다음과 같다. 도구 준비는 실제 제안 확보가 아니다. 중복 실행을 제출하지 않는다.

| 대기 경로 | 아직 미확보인 대상 | 근거 |
| --- | --- | --- |
| attention | 019 | [acquireCandidate.mjs](acquireCandidate.mjs), [원본 정체성과 관측 한계](authentic-input-sources.md) |
| contested | 033·143·150 | [acquireCandidate.mjs](acquireCandidate.mjs), 실제 filed 소송의 다음 철 관측 |
| marriage | 018·128·131·132·133·139 | [acquireMarriage.mjs](acquireMarriage.mjs), [정상 무답 진행 계획](authentic-input-next.md) |
| small-rights | 061·077 | [acquireMarriage.mjs](acquireMarriage.mjs), 정상 예외 방침 명령 뒤 실제 청지기 처리 관측 |

## 나머지 16개: 조건부 다음 경로

아래는 실행 승인이나 새 실행 결과가 아니라, 기존 실제 저장에서 가능한 다음 조사 방향이다. 조건을 확인하기 전에는 적격 입력으로 부르지 않는다.

| ID | 실제 입력과 정상 행동 경로 | 한계·근거 |
| --- | --- | --- |
| 015·035 | 실제046 취소 답변 후 저장을 재사용해 봇 재주문 없이 정상 시간 진행. 봄/여름과 가을/겨울을 함께 관측 | 실제 사용가능목재·대기 공사수요·교역 거점을 확인해야 한다. [조건표](missing-inputs.md), [046 도구](answer046.mjs). 원본 주문을 지우는 상태 편집은 금지 |
| 013·025 | 실제 감사 원본에서 정상 방침 경로를 택해 차기 감사 발생을 관측하는 별도 경로를 검토 | [새052 입력](../eb-weight-input-audit/files/eb-weight-audit-acquire/ck_evt_052-offered-55000-0.save.json.gz)은 감사기한55320으로 다음 철56000 전에 닫힌다. 그 저장을 무조건 한 철 더 돌리는 것으로 두 사건을 확보할 수 있다고 주장하지 않는다. 특정 방침이나 실제 제안은 아직 검증하지 않음 |
| 011 | 실제 미혼 원본에서 다음 철 직전 정상 혼인 제안을 한 번 하고, 실제 countered 결과일 때 다음 철을 관측 | [기존 역제안 입력의 기한 부족](authentic-input-sources.md): 잔여2·15·17틱으로80틱 조건 실패. 새로운 제안도 수락/거절될 수 있다. 현재 marriage acquisition은 혼인 명령을 하지 않으므로 별도 경로 |
| 029 | inherited 원본의 실제 후보를 정상 임명·감사한 결과를 보고 다음 여름의 조건을 재평가 | 현재 후보 능력/충성만으로 즉시 적격이 아니다. 현직 오류·횡령0, 미답 감사 없음 및 예측 조건 필요. [조건표](missing-inputs.md), [stewardship](../../../src/engine/stewardship.ts) |
| 002·037·076·157 | 온전히 보유한 외부 영지 둘을 실제로 얻은 저장부터 확보하고, 직접감독/위임·회계 및 동시 결산·후보 조건을 확인 | 새7개 실행 저장에도 해당 두 영지 상태 없음. [heldOffMapEstates](../../../src/engine/stewardship.ts)는 영지 전체의 titleHolder와 possessor가 모두 lord여야 한다. 두 부분 필지는 대체 불가. [parallel_accounts 맥락](../../../src/engine/registryPetitionContextEstates.ts) |
| 147 | 필요한 영지 조건을 갖춘1348–1355 실제 사망→자동임명 직후 입력 확보 | 수동 재임명은 동일한 증거가 아니다. [사망 전이 맥락](../../../src/engine/registryStewardSuccessionContext.ts), [조건표](missing-inputs.md). 늦은 저장에서 연도를 바꾸지 않음 |
| 057 | 실제 시장–교회 거리와 헌장 전 조건을 동시에 갖춘 저장 검색 | [새038 자연 실행](../eb-weight-input-038-seed1-new-game/README.md)에서도 미확보. [헌장 맥락](../../../src/engine/registryChapterPetitions.ts). 희귀 추첨만의 문제로 단정하지 않음 |
| 075 | lord의 실제 old_possession 청구권 생성 뒤 정상 제소한 저장 확보 | [old_possession 맥락](../../../src/engine/registryPetitionContextEstates.ts), [실제 청구 생산자](../../../src/engine/estates.ts). 일반 소송으로 대체할 수 없으며 입력 부재를 생산자 부재로 판정하지 않음 |
| 090 | 실제 목수 가구와 trade-house rebuildOf 공사가 함께 있는 화재·재건 저장 확보 | [shop_repair 맥락](../../../src/engine/registryPetitionContextTown.ts). 지금 입력이 없다는 것뿐이며 사실 생산 불가능의 증거는 아님 |
| 080 | 실제 양수 연체와 대량 주문이 공존하는1430–1450 저장부터 확인 | [완료 실행 final](../eb-weight-input-080-174-seed1/files/eb-weight-acquire-remaining/080-174-seed1/final.save.json.gz) @560000에는 주문 없음·연체 `[]`. 정상 주문만 추가해도 연체가 생기는 것은 아니다. [pending_order 맥락](../../../src/engine/registryPetitionContextTown.ts) |
| 174 | 1430–1439 창 안의 실제 저장에서 정상 진행하는 경로만 가능 | 위 final@560000은1440년이라 창 밖. [완료 실행](../eb-weight-input-080-174-seed1/README.md)의 제한 관측 실패는 보존한다. 같은 실행을 반복할 새 근거는 아직 없음 |

## 미검증 범위

새 실제 offer를 얻었다는 것과 화면 검증 통과는 다르다. 정상 답변의 실제 상태 변화, 정확한 answerId 연결, 결과 뒤 LS1 칩 갱신, 결과 카드 항목과 탐색 전후 SHA는 각 UI 실행에서 확인해야 한다. 이번 기록은 그 검사를 대신하지 않는다.

미확보 목록은 검사한 보존 범위와 현재 대기열 이전 시점의 상태다. 모든 저장·모든 정상 행동의 불가능 증명도, 엔진이 사실을 만들지 않는다는 결론도 아니다. 실제 발생 전까지 `NO_AUTHENTIC_OFFER_INPUT`을 유지하고, 원본을 바꾸거나 정본 조건을 넓히지 않는다.
