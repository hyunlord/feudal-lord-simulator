# EB old-history targeted recapture review

Scope: independent review of `.remote-runs/render-EB-old-history-1bab7af/eb-old-history/results.json` plus targeted screenshots `ck_evt_038-final-no-pair-decision.png`, `ck_evt_140-final-no-pair-decision.png`, and `ck_evt_201-consequence-because.png`. No UI edits, simulation, or browser job was run during this review.

## Verdict

Pass for the targeted recapture purpose. All four requested cases were captured and found. The old final-history selections for `ck_evt_038` and `ck_evt_140` now locate the actual target decisions and visibly show the no-future-message state. The `ck_evt_201` cross-year consequence/backlink evidence passes. The only presentation-state mismatch remains `ck_evt_038-answer`, and its difference is exactly `/seen` missing versus object size 1, stable before and after capture.

## Provenance checked

- Capture source revision: `1bab7af4f342a6abf2cd50f5d080241fd0ec339e`.
- Checkpoint source revision: `2485af40046793f1856829fa1161dc4431942aa7`.
- Checkpoint manifest SHA-256: `e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d`.
- Requested cases: `ck_evt_038-answer`, `ck_evt_038-final-no-pair`, `ck_evt_140-final-no-pair`, `ck_evt_201-consequence`.
- Viewport: `1280x800`.
- All referenced screenshots for these cases exist; the three requested PNGs are `1280x800`.
- No case has errors. All shown panels are inside the viewport.

## Case findings

### `ck_evt_038-answer`

- `decisionLocated: true`, `historyOpened: true`, `tickUnchanged: true`.
- `initialHistoryTraceExact: true`, `finalHistoryTraceExact: true`.
- `presentationUnchangedDuringCapture: true`.
- `initialPresentationStateExact: false`, `finalPresentationStateExact: false`.
- The initial and final presentation differences are identical: one differing path, `/seen`, expected missing and actual object size 1. `initialPresentationSha256` and `finalPresentationSha256` are both `d3374dda962f17a9fcecce7ab80798560d85f9adae67f9009bf2c28027f497ac`; expected is `2286bfae80a7d7f563fa17eb5270d717dfad7c681c236b66109c867a7bb36e0a`.
- This is bounded to the known `038` answer presentation mismatch. There is no unexplained additional diff and no capture-time drift.

### `ck_evt_038-final-no-pair`

- `decisionLocated: true`, `historyOpened: true`, `tickUnchanged: true`.
- Presentation and history trace checks pass before and after capture.
- Screenshot `ck_evt_038-final-no-pair-decision.png` visibly selects the 1309 decision `판결 뒤에도 닫힌 문: 집행을 미룬다`.
- The detail panel shows `아직 이 결정 뒤에 적힌 일이 없습니다`, so the final no-future-message state is now actual selected evidence, not just save-contained evidence.

### `ck_evt_140-final-no-pair`

- `decisionLocated: true`, `historyOpened: true`, `tickUnchanged: true`.
- Presentation and history trace checks pass before and after capture.
- Screenshot `ck_evt_140-final-no-pair-decision.png` visibly selects the 1329 decision `멀리 있는 땅을 보는 비용: 직접 감독으로 전환한다`.
- The detail panel shows `아직 이 결정 뒤에 적힌 일이 없습니다`, so the final no-future-message state is now actual selected evidence.

### `ck_evt_201-consequence`

- `decisionLocated: true`, `exactConsequenceLinkShown: true`, `exactCauseBackLinkShown: true`.
- `tickUnchanged: true`, presentation and history trace checks pass before and after capture.
- The detail panel links the 1314 winter decision to a 1315 spring consequence: `그 뒤 첫 좌판세 10d가 들어왔다 (여러 까닭 가운데 하나)`.
- Screenshot `ck_evt_201-consequence-because.png` shows the backlink thread `이 일이 따라 나온 결정` and names the 1314 decision as a contributing cause.
- This validates the targeted cross-year link/backlink path for `ck_evt_201`.

## Visual/CJK limits

The sampled Korean UI is readable and not clipped in the target panels. There are still narrow-column CJK line-wrap limits in decision-choice columns, visible for example in `ck_evt_140-final-no-pair-decision.png` where `직접 감독으로 전환한다` wraps awkwardly. Treat the recapture as functional evidence for selection/linking, not as a full typography/layout pass.

## Boundary

`automaticYearReview` is false for all four cases, and chips are absent before/after overlay dismissal for all four. The result limits still apply: history navigation is manual, no first-season automatic visibility claim is made, and no simulation resumed during capture.
