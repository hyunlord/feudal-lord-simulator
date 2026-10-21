# 렌더 요청 — 보조금 화면: 지금 효과 없는 직물 건물(SUBSIDY-CLOTH)

- **보낸 곳**: 엔진(사용자 판정 2026-10-21). 받는 곳: 렌더 A.
- **까닭**: CLOTH-1(결정 CLOTH1-1) 뒤 직물 시점(영주 모드 1364, CL7) 전에는 직조공 집·축융 방앗간·염색집·텐터 틀이 마을 기회 사업에 나오지 않는다. 그래서 그 넷에 건 보조금은 사업을 세우지도 돈을 내지도 않는다. 그런데 보조금 화면(`SUBSIDY_KINDS` = `OPPORTUNITY_KINDS`, `src/ui/lord/policyModel.ts`·`LordPolicyPanel.tsx`)은 넷을 고를 수 있게 낸다 — 효과 없는 선택지.

## 엔진이 주는 것(본선에 있음)
`subsidyEffect(state, kind)` — `src/engine/subsidyEffect.ts`, 순수 함수(상태를 바꾸지 않음):
- `{ kind: "effective" }` — 지금 보조금이 사업을 받친다.
- `{ kind: "not_yet", reason: "cloth_time", fromYear: 1364, fromChapter: null }` — 영주 모드·샌드박스, 직물 시점 전의 직물 넷.
- 캠페인에서는 `fromYear: null, fromChapter: 4`(3장 뒤).
- 문구는 돌려주지 않는다(규칙 5·9, 계층 규칙). 시험: `tests/subsidyEffect.test.ts`(넷은 1364 전 "아직 아님", 그 밖은 언제나 "효과 있음", 1364부터 넷도 "효과 있음", "아직 아님"이면 보조금을 걸어도 마을 제안에 그 건물이 없음).

## 화면에 바라는 것(사용자 판정)
- 보조금 대상 고르기에서 `not_yet`인 종류는 비활성으로 두고 까닭을 함께 보인다: "아직 아님 · 1364년부터"(문구는 렌더의 `*.ko.ts`, 호버 전용 금지).
- 이미 걸려 있는 그런 보조금(옛 저장)이 있으면 같은 까닭을 그 줄에 보인다.
