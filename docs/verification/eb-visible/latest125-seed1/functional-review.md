# EB visible125 seed-1 functional review

Scope: independent review of completed browser capture `.remote-runs/render-EB-visible125-seed1-ee7d0ff/eb-visible125-seed1/results.json` plus representative screenshots. No simulation was run during this review.

## Verdict

No blocking functional capture bug found in the 31-case artifact. The evidence supports the 13 paired consequence/backlink checks, tick/trace stability, and presentation stability during capture, with bounded limitations for automatic chip record identity and the known `ck_evt_038` presentation hash mismatch.

## Provenance checked

- Capture source revision: `ee7d0ffe79ce8d1ba0a6a67d721fc2a4b0163f7e`.
- Checkpoint source revision: `2485af40046793f1856829fa1161dc4431942aa7`.
- Checkpoint manifest SHA-256: `e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d`.
- Viewport: `1280x800`.
- Result contains 31 cases: 15 manifest pairs × two captures plus one final-year-review capture. The 15 pairs are 13 `paired` and 2 `mature_without_observed_future_link` (`ck_evt_038`, `ck_evt_140`).
- All 141 referenced PNG screenshots exist and are `1280x800`.

## Exact consequence and backlink checks

Pass for all 13 paired consequence cases. Each paired consequence case has `exactConsequenceLinkShown: true` and `exactCauseBackLinkShown: true`:

`ck_evt_005`, `ck_evt_092`, `ck_evt_211`, `ck_evt_201`, `ck_evt_053`, `ck_evt_009`, `ck_evt_032`, `ck_evt_130`, `ck_evt_042`, `ck_evt_031`, `ck_evt_024`, `ck_evt_206`, `ck_evt_165`.

Representative screenshot checks matched the JSON booleans:

- `ck_evt_005-consequence-chip.png` shows the consequence card on the main map with an `연대기에서 보기` button.
- `ck_evt_005-consequence-because.png` shows the chronicle detail backlink section naming the decision that caused the consequence.
- `ck_evt_032-consequence-chip.png` shows the visible consequence card and manual chronicle link.
- All shown panel boxes in the JSON are inside the viewport (`110` shown panels, `0` outside). Hidden year-review panels are consistently recorded as hidden.

## Tick, trace, and presentation stability

- `tickUnchanged: true` for all 31 cases.
- `initialHistoryTraceExact: true` and `finalHistoryTraceExact: true` for all 31 cases.
- `presentationUnchangedDuringCapture: true` for all 31 cases.
- `finalPresentationStateExact: true` for 30 of 31 cases.
- The sole presentation-state mismatch is `ck_evt_038-answer`: expected presentation SHA `2286bfae80a7d7f563fa17eb5270d717dfad7c681c236b66109c867a7bb36e0a`, initial/final presentation SHA `d3374dda962f17a9fcecce7ab80798560d85f9adae67f9009bf2c28027f497ac`. It stayed unchanged during capture, matching the known pending `038` answer presentation mismatch rather than a browser-capture mutation.
- `initialStateExact` is `false` for all 31 cases. The result limits state that `openScene` dismisses welcome/Escape and sets camera and that no simulation resumed; treat exact GameState trace/presentation/tick fields as the relevant non-resume evidence, not full raw state equality.

## Known no-pair/final scroll limits

`ck_evt_038-final-no-pair` and `ck_evt_140-final-no-pair` both report `decisionLocated: false`; this matches the stated 100-scroll harness limit. The final save still contains both target records:

- `h-002358` exists in `state.history.records` and `state.trace.decisions` for `registry:ck_evt_038:defer`.
- `h-007606` exists in `state.history.records` and `state.trace.decisions` for `registry:ck_evt_140:b`.

This means the final-save record presence is supported, while final UI location for those old records is not proved by the completed capture.

## Automatic chip identity limits

The automatic chip is useful visibility evidence but is not exact target-decision evidence in every case. `chipMatchesExpectedDecision` is `true` in 11 cases, `false` in 7 cases, and `null` in 13 cases where no chip match was evaluated or shown.

False chip-identity cases:

- `ck_evt_005-consequence`: selected chip history record `h-002654`, target decision `h-002653`; the exact backlink panel still names the target decision.
- `ck_evt_092-answer`: selected `h-002648`, target `h-002727`.
- `ck_evt_032-answer`: selected `h-008762`, target `h-008835`.
- `ck_evt_032-consequence`: selected `h-008761`, target `h-008835`; exact consequence/backlink still pass.
- `ck_evt_042-answer`: selected `h-009574`, target `h-009947`.
- `ck_evt_042-consequence`: selected `h-009574`, target `h-009947`; exact consequence/backlink still pass.
- `ck_evt_031-consequence`: selected `h-017957`, target `h-018191`; exact consequence/backlink still pass.

Boundary: do not use automatic chip selection alone as exact target proof in these cases. Use the exact consequence/backlink booleans and detail screenshots for causal-link proof.

## Final-year-review capture

`final-year-review` has `automaticYearReview: false`, `tickUnchanged: true`, `finalHistoryTraceExact: true`, `finalPresentationStateExact: true`, and hidden `.results-card.year-review`. The screenshot `final-year-review-year.png` visually confirms no year-review panel was visible after paused reload. This is limited to the captured paused reload state and does not claim first-season automatic visibility.

## Functional/design observations from screenshots

Representative screenshots show readable Korean UI, visible cards/buttons, and no obvious clipping in the sampled main-map or chronicle panels. The evidence is functional, not a full visual design audit across all states: no responsive breakpoints beyond `1280x800`, hover/focus states, performance, or accessibility assertions were captured.
