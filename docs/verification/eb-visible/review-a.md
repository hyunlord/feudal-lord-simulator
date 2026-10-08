# EB visible browser smoke — visual QA Pass A

Scope: read-only inspection of `/Users/rexxa/fls-astra-engineB-weight/.remote-runs/render-EB-visible-smoke-be2c05f/eb-visible/results.json`, `source-manifest.json`, `.omo/evidence/eb-visible-image-diff.json`, and the captured PNGs under `eb-visible/`.

Verdict: PASS for bounded functional/design integrity of the captured browser states. No blocking visual or functional defect found in this evidence set.

## Evidence reviewed

- Render source revision: `be2c05f3bb555697bc6c750290c6abe2f151c754` with `dirtyPaths: ""` in `results.json`.
- Checkpoint source revision: `2485af40046793f1856829fa1161dc4431942aa7` with `dirtyPaths: ""` in `source-manifest.json`.
- Viewport: 1280×800.
- Cases: 11 browser capture cases; all have `errors: []`, `tickUnchanged: true`, `initialHistoryTraceExact: true`, and `finalHistoryTraceExact: true` where present.
- Objective image-diff evidence: `.omo/evidence/eb-visible-image-diff.json` covers four answer→consequence decision-image comparisons; all have `dimensionsMatch: true` and `alphaChannelIntact: true`. Diff ratios are high by design because they compare changed answer/consequence states, not a same-state reference baseline.

## Functional integrity findings

- PASS — Manual decision lookup works for all answer/no-pair cases inspected. `decisionLocated: true` for ck_evt_005-answer, ck_evt_038-answer, ck_evt_092-answer, ck_evt_201-answer, ck_evt_211-answer, and ck_evt_038-final-no-pair. The screenshots show the chronicle detail panel using live UI controls and Korean text, not a pasted screenshot.
- PASS — Exact paired consequence forward/back links work for the paired captures. `exactConsequenceLinkShown: true` and `exactCauseBackLinkShown: true` for ck_evt_005-consequence, ck_evt_092-consequence, ck_evt_201-consequence, and ck_evt_211-consequence. The because screenshots show the backlink heading `이 일이 따라 나온 결정` and a decision-specific link, not a generic chip-only claim.
- PASS — ck_evt_038 final/no-pair state correctly shows the no-future message. `ck_evt_038-final-no-pair-decision.png` displays `아직 이 결정 뒤에 적힌 일이 없습니다`, matching the mature-without-observed-future-link manifest status.
- PASS — Paused reloads do not advance the simulation in the captured workflow. All reviewed cases report the same loaded/final tick and preserved history/trace exactness.

## Design and visual integrity findings

- PASS — The screenshots render as the existing live game/chronicle interface: reusable panels, buttons, filters, timeline tabs, event chips, and detail cards are visible and interactive-looking. No evidence of a static raster substitute for the UI surface.
- PASS — The decision/consequence detail panels remain inside the 1280×800 viewport. Recorded panel boxes are inside the viewport, and visual inspection did not show clipped panel edges or unreadable content in the inspected captures.
- PASS — Korean text is legible in the inspected panels. I did not see obvious tofu glyphs, broken CJK metrics, or severe Korean line-breaking failures in the decision, consequence, because, or no-pair detail screenshots.
- PASS — Alpha/transparency evidence is clean for the objective diff set: all four image-diff records report `alphaChannelIntact: true`.

## Limitations

- The automatic event chip is not exact evidence for every answer checkpoint. For example, some answer captures show a generic/current decision-trace chip for another visible story, while exact answer evidence comes from manual chronicle navigation.
- `.results-card.year-review` is absent in all captured year-review probes (`automaticYearReview: false`, `.results-card.year-review shown: false`). This is limited evidence of paused reload behavior only; it does not prove a year-review UI path.
- `initialStateExact: false` is recorded in every case. `openScene` dismisses welcome/Escape and sets camera, but no field diff was captured, so the complete cause is unverified. The relevant audit invariant here is history/trace exactness plus unchanged tick, both of which are preserved in the recorded cases.
- The image-diff file is change-detection evidence between answer and consequence states, not a pixel-fidelity baseline. The high diff ratios should not be read as visual regressions.
- This pass inspected completed screenshots and harness JSON only. It did not resume simulation, re-run browser automation, or validate save decoding beyond the recorded harness outputs.

## Blocking items

None found in this Pass A evidence set.

Synthesis note: Pass B found specific CJK syllable breaks on closer inspection. Its REVISE findings govern the combined NEEDS WORK verdict; this bounded functional PASS is not overall visual acceptance.
