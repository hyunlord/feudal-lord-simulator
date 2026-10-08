# 엔진 요청 — PLAY-2 화면이 쓸 것 (렌더 A, 2026-10-08)

Astra 영주 모드 두 번째 플레이([docs/qa/lordplay2-20261008](../qa/lordplay2-20261008/TOP10_FRICTION.md))의 화면 몫(PLAY-2)은 엔진이 주는 것만으로 만들었다. 화면이 규칙을 베끼지 않으려고 비워 둔 자리를 엔진에 요청한다. 렌더는 엔진 파일을 고치지 않는다. 저장 변화는 없다(모두 읽기 모델).

## 1. 소송 제기의 비용과 심리 전망 (TOP10 4)
지금 화면은 `file_suit`를 지금 상태에 시험 실행해(`src/ui/lord/ledger/claimOutlook.ts`) 금고에서 빠지는 돈과 새 소송의 `suitHearing` 두 숫자를 보인다. 비어 있는 것:
- **거절된 제기의 비용**: `fileSuitRefusal`이 `"treasury"`이면 시험 실행이 거절돼 비용을 모른다. 화면은 "금고가 모자랍니다"만 말한다. 요청: `suitFilingOutlook(state, claimId)` → `{ cost: number; refusal: SuitRefusal | null; hearing: { plaintiff: number; defence: number } | null }` (거절이어도 `cost`).
- **심리의 판정 규칙**: 화면은 "청구 쪽 45 · 방어 쪽 80"만 말하고 누가 이기는지(같으면 어느 쪽인지)는 말하지 않는다. 요청: `suitHearing`에 `{ verdictNow: "plaintiff" | "defendant" }`(지금 심리하면), 그리고 청구 쪽을 올릴 수 있는 것(제기 뒤의 `suitActions` 증거 무게·후원 지지)의 합이 방어 쪽을 넘을 수 있는지 한 값(`reachable: boolean`).
- **앞으로 단계의 비용**: 단계(증거·후원·심리)마다 금고에서 빠지는 돈이 `suitActions`에 없다. 요청: `suitActions(...).stageCosts: { stage: SuitStage; cost: number }[]`(남은 단계만).

## 2. 기근 대응 뒤 남은 병목과 다음 조건 (TOP10 2)
대응한 기근 카드는 `preparedness(state).weakPoints`(=`crisisReview(state).now`)와 그 숫자를 "남은 병목"으로, 영주 모드에서는 첫 병목에 맞는 영주의 첫 지렛대(`src/ui/lord/advice/lordAdvice.ts`의 방침·장려금·구역·청)를 "다음에 바꿀 조건"으로 보인다(`src/ui/lord/advice/famineAfter.ts`).
- **병목 → 지렛대**: 어느 병목을 어느 사업이 푸는지는 화면이 병목의 말로 읽었다(곡창 없음 → 곡창, 장터 없음 → 시장, 식량이 한 철도 안 됨 → 경작지). "이미 굶는 집"은 지렛대가 없다. 요청: `Preparedness.weakPoints` 항목마다 엔진이 보는 사업·조건(`{ point, project: string | null }` — 마을 사업 키 `granary`·`market`·`zone:arable` 등).
- **같은 말**: `src/content/historyCopy.ko.ts`의 모듈 안 `WEAK_POINTS`(곡창 없음·식량이 한 철도 안 됨·이미 굶는 집·곡식을 살 장터 없음)를 내보내 주면 화면이 사본(`famineAfterCopy.ko.ts`)을 지운다.

## 3. 영주 모드의 목책 안내 (TOP10 10)
목표 서랍의 시대 칸은 영주 모드에서 마을의 청(`lordRequests` proclaim_era)·첫 미충족 조건과 영주의 지렛대·`agency.charterWallTried`로 말한다(`src/ui/lord/advice/lordWall.ts`). "직접 긋기"는 마을의 마지막 탐색이 둘레를 못 찾았을 때만 권한다.
- **못 찾은 까닭**: `charterWallTried`는 배치 키만 남긴다. 요청: 마을 탐색이 둘레를 못 찾은 까닭(`PalisadeFailureReason`)을 함께(`charterWallFailure?`). 지금은 화면의 추천 계산(`proposalSummaryForState`)의 까닭을 대신 붙인다.
- **조건마다 지렛대**: 선포 조건 키(population·granary·chapel·timber…)에 맞는 마을 사업을 엔진이 이름 붙여 주면(목재는 마을이 상인에게 주문하는지 등, FIX-14) 화면이 사본 대응표를 지운다.

## 4. 출생·혼인·사망 소식의 사람 (TOP10 9)
화면은 기록의 subject·params(`person.born`의 motherId·fatherId, `marriage.contracted`의 groom·bride)로 이름과 전기 버튼을 보인다(`src/ui/persons/familyNews.ts`).
- `marriage.child_born`·`marriage.brother_in_law_born`에 아이 id가 없어(신부·처남만) 첫아이는 "신부가 어머니이고 그해 태어난 사람"으로 찾는다. 요청: params에 `child`(그리고 `father`).
- `person.died`·`person.married`에 배우자 id(`spouseId`)를 넣어 주면 사망·혼인 소식이 짝도 부른다.
- 부모 표기가 전기와 가계도에서 다른 것(070·127)은 엔진 쪽 확인 요청(화면은 기록대로 보인다).

## 5. 기한이 있는 가문 결정 (TOP10 8)
유언 변경 칩은 답할 때까지 칩 줄에 남는다(`storyChips`). 요청: 유언·다툼·감사·지도 밖 청원의 **답 기한 틱**을 읽기로(`marriageDecisionDue`에 `{ kind, dueTick }`) — 화면이 "한 철 안에"가 아니라 날짜로 말한다.

## 6. 엔진 몫, 화면은 아직 만들지 않음 (작업 지시서)
- 소식 칩의 주어(점유를 넘겨받은 쪽·잃은 쪽·권리 이름, TOP10 1) — `suit_turned`·점유 집행 기록의 params에 원고·피고·조각을 넣어 주면 화면이 문장에 쓴다.
- 이웃 소송에 대한 방어 명령(TOP10 1) — 명령이 생기면 화면이 소송 트랙에 버튼을 단다.
- "당신의 결정 때문에"의 인과 문구(TOP10 5: 재난 발생과 그때의 대비를 나눔) — `because`에 관계 종류(`cause` / `preparedness`)가 오면 화면이 말을 나눈다.
