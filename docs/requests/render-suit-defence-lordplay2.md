# 렌더 A가 넘겨받을 것 — 피고 방어·강제 점거·Astra lordplay2 화면 몫

엔진 세션, 2026-10-08. 근거: 결정 DTR-22·DTR-23·LP2-E, [Astra 둘째 영주 플레이](../qa/lordplay2-20261008/TOP10_FRICTION.md).
엔진은 아래 읽기 모델과 명령을 본선에 넣었다. 화면은 렌더 세션의 일이다. 엔진은 렌더 파일을 고치지 않았다.

## 1. 영주를 상대로 한 소송: 방어 명령 (TOP10 1번)
- 지금 원장의 `neighbourNote`("영주가 막을 명령은 없습니다. 진행만 보입니다.")를 방어 줄로 바꾼다.
- 읽기 모델 `suitDefenceActions(state, suitId)`(`src/engine/suitDefence.ts`)가 돌려주는 것:
  - 증거 종류별 비용·가중치·거절 사유
  - 후원자
  - 합의(돈) 값과 거절 사유
  - 내주기
  - 버티기(비용·더할 힘·지금 힘·거절 사유: `stage`/`not_possessor`/`held`/`treasury`)
  - 지금 심리의 양쪽 수치
- 명령:
  - `add_defence_evidence {suitId, evidence}`
  - `seek_defence_patron {suitId, factionId}`
  - `settle_suit {suitId, terms: "pay" | "yield"}`
  - `hold_possession {suitId}`
- 용어는 정본을 따른다: 최종 합의(짧게 ‘합의’), 점유 침탈 소송, 강제 점거, 남은 권리.

## 2. 강제 점거 예고 (S3)
- `entryThreats(state)`: 예고된 강제 점거 목록(가문·조각·온 시점·`due`).
- `entryDefenceCosts(state, threat)`: 지키기·달래기 비용.
- 명령: `guard_possession {threatId}`, `appease_neighbour {threatId}`.
- 소식 기록(엔진 문구):
  - `estate.entry_threatened` / `entry_repelled` / `entry_called_off` / `entry_forced`
  - `estate.suit_settled`
  - `estate.possession_held`
- 들어온 뒤의 점유 침탈 청구는 `claim.novel === true`다. "청구할 수 있는 권리"에서 접수하면 소송이 접수 다음 철에 바로 심리로 간다.

## 3. 미응답 목록 (TOP10 8번, LP2-E ⑦)
- `lordMattersDue(state)`(`src/engine/lordDue.ts`): 기한 있는 가문 일 목록. 답하거나 기한이 지날 때까지 칩 목록에 남긴다.
  - 유언 변경(`dueTick`)
  - 상속 다툼
  - 영주를 상대로 한 소송(다음 단계 tick)
  - 강제 점거 예고
- 유언 답 기한은 이제 두 철이다.
- 기한이 지나 자동으로 "그대로 두었다"가 된 경우 `marriage.willLapsed === true`다. 혼인 타임라인의 `willAnswer` 줄을 "기한이 지나 그대로 두었다"로 읽는다(`negotiationModel.ts:321`).

## 4. 득실의 주어 (TOP10 1번 후반, LP2-E ②)
- `estate.possession_enforced`·`estate.suit_judged` 기록에 `plaintiff`·`defendant`가 들어간다. 엔진 문장은 득실을 말한다.
- 렌더에서 고칠 곳:
  - **순간 그림**(`wave40Art.ts:43`, `lordMomentCopy.ko.ts`): `succeeded === 1`이면 언제나 "점유를 넘겨받았다"로 읽힌다. 원고가 영주가 아니면 영주가 잃은 것이니 제목·조언을 바꾼다. 실패 때 원고가 이웃이면 "영주가 버텼다"다.
  - **원장 소송 줄**(`ledgerCopy.ko.ts:89`, `enforced: "점유를 넘겨받았습니다"`): 영주를 상대로 한 소송이면 "이웃이 점유를 가져갔습니다"처럼 주어를 넣는다.

## 5. 패소 뒤 상속 카드 (TOP10 3번, LP2-E ③)
- 엔진이 고친 것: 상속 다툼 소송에 지면 혼인 단계가 `lost`로 가고 `marriageDecisionDue`가 null이다.
- 렌더에서 고칠 곳: `decisionCardsModel.ts:88`은 닫힌 소송을 "소송 없음"으로 센다. 끝난 소송이 있으면 판결과 날짜를 보여 준다.

## 6. 원인과 대비 (TOP10 5번, LP2-E ④)
- 기록에 `because[].key === "crisis_prepared"`이 있으면, 연말·연대기의 머리줄을 "○○년 당신의 결정 때문에"가 아니라 "○○년 결정이 남긴 대비"로 쓴다.
- 엔진 문장은 이미 "흉년이 닥쳤을 때 이 결정이 남긴 대비: …"다.

## 7. 전기의 부모 (TOP10 9번, LP2-E ⑥)
- 원인: 전기 관계(`chronicleScreenCopy.ko.ts:33`)는 집안 역할로 부모를 정한다(`child` → 가장·배우자가 부모). 엔진은 혼인 부부의 아이를 이제 `kin` + `lord-kin:<관계>_child`로 두고(v54가 옛 저장도 고침), 부모 id(`fatherId`·`motherId`)는 신랑·신부다.
- 렌더에서 고칠 것:
  - 전기의 부모는 `personParents`(`src/engine/personsApi.ts:32`)로 읽는다.
  - 가솔 목록은 `lord-kin:cousin_child` 등을 "영주의 사촌의 아들"처럼 읽는다.

## 8. 청지기 위임 설명 (TOP10 6번, LP2-E ⑤)
- 지속 좌판세를 바꾸는 선택지가 있는 사건은 이제 권리 무게라서 영주에게 온다.
- 상시 방침 설명에 "지속 세율 변경은 영주에게 온다"를 적어 줄 것.
