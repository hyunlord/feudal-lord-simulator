# 엔진 검토 메모 — TRACE-LINK·INERT 가지 (2026-10-10, 병합 전)

- **대상**:
  - `codex/engine-b-tlink` `07c5943b8`
  - `codex/engine-b-inert` `3aeba0cd1`
  - 둘 다 본선 `64a16b5a6`에서 갈라졌다. 공통 조상은 `db750c164`이다.
- **검토 방식**(사용자 지시 2026-10-10): 코드 읽기와 Mac 가벼운 시험만 했다. 병합은 GROW-BLOCK-2a를 올린 뒤에 한다.

## Mac 시험
| 가지 | typecheck | 시험 |
|---|---|---|
| tlink | 통과 | answerEffects·answerEffectsReplay·engineBTlink*·traceKeep·sliceEnds — 171 통과, 1 건너뜀, 0 실패 |
| inert | 통과 | stewardshipConsequences*·engineBInert*·traceKeep — 32 통과, 0 실패 |

## 코어에서 바뀌는 곳
**tlink**
- 흔적 기록:
  - `decisionTrace.ts`(+105)·`decisionTrace.types.ts`가 답마다의 흔적(`trace.answers`)을 남긴다.
  - 보조 파일: `decisionTraceAnswers`·`AnswerLedger`·`AnswerReceipts`·`EstateRelations`·`Evidence`.
- 읽기:
  - `answerEffectCapture.ts`(답 앞뒤 스냅숏)와 `decisionPresentation.ts`.
  - `decisionReads.ts`: `traceInRange`·`decisionRemembers`가 세력 기억을 답 소유로 다시 묶고, `yearReview`가 `trace.answers`도 센다.
- 문구: `history.ts`(3줄), `historyCopy.ko.ts`.
- 저장: `answerEffectsValidation`·`traceAnswerValidation`.
- UI 연결 다섯 곳(렌더 몫): `decisionCard/surfaces.ts`·`lordCardsModel`·`registryCardModel`·`results/decisionThread`·`AppModals`.

**inert**(tlink의 앞부분 위에 올림)
- `stewardship.ts`(+87):
  - 상인 관계 −100에서 특허 청원을 거절하면 4철 동안 거래 몫 25 %를 잃는다(`charterRefusal`·`charterSeasonLoss`).
  - 그 뒤 12철 동안, 관계가 −80 위로 오르기 전에는 같은 청원이 같은 자리를 차지하되 다시 묻지 않는다(`charterPetitionSuppressed`).
  - 감사 결과를 묵인하면 4철에 걸쳐 결손이 수입에서 빠진다(`tolerateAuditErrors`·`toleratedSeasonLoss`).
- 새 상태: `stewardship.types.ts`의 `charterResistance`·`toleratedErrors`·분기 요약의 `charterLoss`·`toleratedLosses`.
- 흔적: `decisionTraceStewardshipLosses.ts`, `stewardshipConsequencesConfig.ts`.
- 모두 `lordMode(state)`로 막혀 있다. 샌드박스에는 stewardship이 없어 가드레일 해시가 바뀌지 않을 것으로 본다. 확인은 엔진 B의 영주 모드 밖 해시 비교로 한다(아직 도는 중).

## 2a 가지와 겹치는 파일
- **없다**: `claude/grow-block-2a`가 바꾼 파일과 두 가지가 바꾼 파일이 겹치지 않는다.
- **본선과 충돌**(`git merge-tree`):
  - tlink 쪽: 저장 판 파일(`saveTypes.ts`·`migrations/index.ts`·`v54ToV55.ts`·`schemaFingerprint.v55.json`·`fixtures/saves/v55/manifest.json`)과 렌더 파일 둘(`decisionCard/surfaces.ts`·`AppModals.tsx`, 본선 렌더가 그 뒤 바꿈), 그리고 ROADMAP.
  - `history.ts`·`decisionTrace.ts`·`historyCopy.ko.ts`는 자동으로 합쳐진다.
- **tlink와 inert 사이**:
  - 엔진 코드(`decisionTrace.ts`·`migrations/index.ts`)는 자동으로 합쳐진다.
  - 충돌은 저장 판 파일(`saveTypes`·`v56ToV57`·`schemaFingerprint.v57`·`fixtures/saves/v57`)과 `engine-B-tlink.md`뿐이다.
  - **주의**: inert는 tlink의 앞부분 위에 있어서, tlink가 나중에 더한 `answerEffectCapture.ts`·`answerEffects.types.ts`·`answerEffectsValidation.ts`가 inert에는 없다. 합칠 때 tlink를 먼저 넣고 inert를 그 위에 얹는다.

## 저장 영향
- **두 가지의 이행**:
  - 각각 v54→v55→v56→v57의 셋이다. 모두 판 번호만 올리고 새 칸은 비워 둔다. 옛 저장의 답 흔적·관계 증거·답 효과·압력은 "없음(모름)"이며 지어내지 않는다.
  - 본선은 GROW-BLOCK에서 이미 v55를 썼다(`agency.charterWallFailure`·`abandonedSites`).
- **2a**: 저장 모양을 바꾸지 않는다(시작 자리, 규칙, 탐색만).
- **넣을 때(사용자 지시)**: 두 가지를 함께 넣으며 판 번호 하나 **v56**, 이행 하나 **v55→v56**(번호만, 새 칸 모두 선택)으로 한다.
  - 고정 저장 `fixtures/saves/v56`(`buildSaveFixtures --from-version 55`)과 지문 `schemaFingerprint.v56.json`을 한 번에 정한다.
  - 두 가지의 v55·v56·v57 이행과 지문, v55·v57 고정 저장은 쓰지 않는다.
  - 결정 줄 하나에 두 가지의 새 칸을 다 적는다.

## 병합 때 함께 볼 것
- **같은 stewardship 기록을 함께 건드린다**(사용자 지시, 작은 묶음): `stewardship.escalated`·`audit_found`·`season`에 청원 id·감사 id를 넣는 일과 tlink의 `petition_routed`.
- **관문**(사용자 지시 2026-10-10): 결과 보임 ≥ 80 %, 무효과 0, 결정 수가 늘지 않음, 가드레일 해시 불변, 기대표 10개 사건 시험. 엔진 B의 측정 도구로 판정한다.
- **결정 수가 늘지 않음**: inert의 반복 억제는 청원 자리를 그대로 쓰고(다시 굴리지 않음), 억제된 청원은 청지기가 거절로 닫는다. 결정이 늘지 않는 쪽이다.

## 사용자 판정(2026-10-10) — 병합 때 지킬 것
- **렌더 파일 충돌**: 렌더 A의 판을 기준으로 맞춘다.
  - 결정 영수증 `ad4c6f72`가 본선에 들어왔다.
  - 충돌을 풀 때 영수증 동작이 바뀌면 안 되고, 렌더 A의 영수증 시험(답 74종)이 그대로 통과해야 한다.
  - 병합 뒤 렌더 A가 영수증을 `answerEffects` 읽기로 바꾼다.
- **inert의 "같은 청원 다시 묻지 않기"**:
  - 지금은 12철 동안 그 청원이 같은 자리를 차지한다. 그러면 그 영지의 다른 청원까지 막힐 수 있다.
  - inert는 영주 모드 전용이라 해시·결정론을 위해 자리를 지킬 필요가 없다. 자리를 비워 다른 청원이 올 수 있게 하는 쪽을 권한다.
  - 어느 쪽이든 청지기가 닫은 것은 청지기 보고에 한 줄 남는다(예: "상인 특허 청원 — 지난번 거절에 따라 청지기가 거절").
- **가드레일 해시 불변**: 엔진 B의 영주 모드 밖 해시 비교 결과로 확인한 뒤에 넣는다.
