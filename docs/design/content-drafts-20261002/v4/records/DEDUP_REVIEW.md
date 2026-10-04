# v4 소송·사건 중복 억제 계약 정합성 검토

입력: `/tmp/astra-content-v4-20261004/ADAPTER_CONTRACTS.json` (A 승계), 001–130 분할 registry-entries, A 131–200 원고 및 등록기. 출력은 수정 제안이며 게임 설치·실행 없음. 원고와 분할 registry는 수정하지 않았다.

## 바꾼 계약

- 중앙 `fn.right_evidence_case.v2`를 `suit.evidence`로 정규화하고 중앙·faction-nature scoped 복제 모두 같은 내용으로 바꿨다. 키는 `[suit.evidence,campaignId,실제 suitId]`다. 같은 소송은 증거종류·연도·원고 제목이 바뀌어도 재상신하지 않는다. 다른 실제 소송은 다시 후보가 된다.
- 146·150·153·154를 `fn.standalone_draft_once.v2` 중앙·scoped의 memberIds/additionalCopyIds에서 함께 제거했다. 나머지 캠페인당 한 번 제한은 유지했다.
- `suit.enforce`를 별도 중앙·scoped 계약으로 선언했다. 같은 소송의 증거 선택이 후속 집행 선택까지 막지 않는다. 단 enforcing 단계만 가능하다.
- 154는 가구 채무 문제이므로 `suit.evidence`에 넣지 않았다. `fn.debt_right_case.v4`에 실제 검증된 채무 case + 연결 suit 키를 제안하고 `NE_SR01_FN08` 차단을 유지했다. case selector는 현재 구현됐다고 주장하지 않는다.
- 기존 기록은 검증된 실제 suit/case로만 키를 이전한다. 옛 캠페인당 한 번 예약을 버리거나 ID만 보고 새 사건으로 간주하지 않는다. 식별 불가 시 추가 문구를 차단하고 기존 엔진 사건은 보존한다.

## 사건별 근거와 부모가 맞출 registry

| 사건 | 정본 그룹 | 판단 |
|---|---|---|
| 009 | suit.evidence | 수도원 문서에서 실제 같은 권원 소송의 증거를 고름. B의 전 기간 후보+소송별 한 번 반영. |
| 032 | suit.evidence | 같은 소송의 증거 묶음 선택. 제목·증거만 바꾼 반복 억제. |
| 033 | suit.evidence | 증서/증인 선택도 같은 소송의 증거 결정. |
| 053 | suit.evidence | 가문 증서/법정 기록도 같은 권원 증거군. |
| 075 | suit.evidence | 영주의 오래된 점유/증서/칙허 제출. estate_suit.evidence 별칭을 통일하되 authored_context 차단 유지. |
| 143 | suit.evidence | 증인/칙허 비교. 기존 fn.right_evidence_case.v2 예약은 같은 suit 키로 이전. |
| 146 | suit.evidence | 수선용 산림 이용권 분쟁의 소송 증거 선택과 연결. 나무 주문/사업 지원 선택이 있어도 현재 실제 권리 소송을 전제로 함. `NE_SR01_FN02`(실제 수선권·판매권 범위 연결) 유지. |
| 150 | suit.evidence | 실제 권리 소송의 증인/법정 기록과 시장 부담 선택. 다른 제목으로 같은 증인 문제 재상신 금지. 세율 왕복은 새 suit가 아니다. |
| 153 | suit.evidence | 다리 기부와 통행 권원의 증서/칙허 선택. `NE_SR01_FN07` 기부-권리 연결 검증 없으면 계속 차단. |
| 038 | suit.enforce | 증거 수집이 아니라 판결 집행. 같은 suit에 증거군과 집행군 각각 한 번 가능하나 각 단계·선택 조건 유지. |
| 154 | fn.debt_right_case.v4 | 가구간 외상·채무는 일반 영지 권원 소송과 다른 생활 문제. 검증된 실제 채무 case와 연결 suit를 함께 요구. `NE_SR01_FN08` 미구현 차단 유지. |

부모 통합 시 위 사건의 `dedup.group` 또는 `groupRef`를 표와 맞춘다. FN 계열의 contractRef는 faction-nature scoped 정의로 해소된다. 146/150/153의 옛 once_per_campaign 잔여를 실제 suit 기준 recurrence로 바꾸되, 미지원 맥락 차단은 절대 삭제하지 않는다. 154는 실제 채무 case + suit 기준이며 새 suit만으로 같은 채무 문제를 재생하지 않는다.

## 보존한 것

- 관련 없는 기존 중앙 계약 11개 객체 동일 보존: 144의 목재 조달, 지붕 수선, 목재 주문, 관리인 선임, 반복 청원, 직물 가공, 유행병, 식량 저장, 급수, CN 혼인·시민 조건 등.
- CN shared 조건의 추가 캠페인 제한을 이번 변경 이유로 일반 해제하지 않았다.
- 기존 원고의 unsupportedFilters, bind 적법성, 명령 원자성, minimumEnabledConsequentialChoices=2, 연간/계절 예산은 해제하지 않았다.
- source historical originals는 증거로 보존하되 정본 중앙/scoped 정의 위에 덮어쓰지 않는다는 우선순위를 명시했다.

## 검증

`node reconcile.cjs` 실행 성공. 중앙 계약 15개, scoped 그룹 전부 중앙과 JSON 객체 동일, 관련 없는 11개 객체 동일. 출력 VALIDATION.json 참조. 런타임 실행 및 실제 저장 키 마이그레이션 검증은 하지 않았다. 정본 계약은 여전히 not_installed다.
