# EB current UI functional review

Scope: independent read-only review of latest merged 31-case browser capture at `.remote-runs/render-EB-visible-current-1866075/eb-visible-current`, compared with prior 31-case capture at `.remote-runs/render-EB-visible125-seed1-ee7d0ff/eb-visible125-seed1` and targeted old-history recapture at `.remote-runs/render-EB-old-history-1bab7af/eb-old-history`.

## Verdict

No blocking browser-capture failure found for the latest merged UI capture. The current run has no case errors, keeps tick/history/trace stable in every case, locates every decision-bearing case, and preserves all 13 exact consequence forward/back link checks.

The latest current capture also supersedes the old `ee7d` 31-case limitation for the two final-history cases: `ck_evt_038-final-no-pair` and `ck_evt_140-final-no-pair` now locate the actual decision records, matching the targeted old-history recapture behavior.

Bounded limitation: automatic event-chip identity remains incomplete. In the current capture, 16 cases show a chip after overlay dismissal, but only 8 chips match the expected decision; 8 visible chips select another record. Treat chip/card automatic selection as limited evidence unless the exact record match is true or manual chronicle navigation subsequently locates the expected decision.

## Provenance

- Current capture source: `18660752adef3d7632e9aac3a6b211f6a7e0e549`
- Prior 31-case source: `ee7d0ffe79ce8d1ba0a6a67d721fc2a4b0163f7e`
- Targeted old-history source: `1bab7af4f342a6abf2cd50f5d080241fd0ec339e`
- All three use manifest SHA `e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d`.
- Current cases reviewed: 31.

## Current capture checks

- `errors`: empty for all 31 cases.
- `tickUnchanged`: true for all 31 cases.
- `initialHistoryTraceExact`: true for all 31 cases.
- `finalHistoryTraceExact`: true for all 31 cases.
- `presentationUnchangedDuringCapture`: true for all 31 cases.
- `automaticYearReview`: false for all 31 cases; this remains a paused/manual-history run, not automatic year-review visibility proof.
- `decisionLocated`: true for all 30 decision-bearing cases; `final-year-review` is N/A.
- `exactConsequenceLinkShown`: true for all 13 consequence cases; false for answer/no-pair cases as expected, and N/A for `final-year-review`.

Exact consequence forward/back link pass list:

- `ck_evt_005-consequence`
- `ck_evt_092-consequence`
- `ck_evt_211-consequence`
- `ck_evt_201-consequence`
- `ck_evt_053-consequence`
- `ck_evt_009-consequence`
- `ck_evt_032-consequence`
- `ck_evt_130-consequence`
- `ck_evt_042-consequence`
- `ck_evt_031-consequence`
- `ck_evt_024-consequence`
- `ck_evt_206-consequence`
- `ck_evt_165-consequence`

## Comparison to prior 31-case capture

Improved decision location:

- `ck_evt_038-final-no-pair`: `decisionLocated` changed from false in the prior 31-case capture to true in the current capture.
- `ck_evt_140-final-no-pair`: `decisionLocated` changed from false in the prior 31-case capture to true in the current capture.

These match the targeted old-history recapture, where both final cases were already found after manual year filters were applied.

Unchanged core safety:

- No current errors, same as prior.
- All current ticks unchanged, same as prior.
- All current history/trace checks exact, same as prior.
- All 13 current consequence link checks pass, same as prior.

Presentation state:

- The only current presentation-state mismatch is still `ck_evt_038-answer`.
- The current difference is exactly `/seen`: expected missing, actual object size 1.
- The same `/seen`-only mismatch appears in the targeted old-history recapture and is stable before and after capture.
- No new unexplained presentation diff appears in the merged-current run.

## Chip identity and chip visibility limitations

Current chip summary:

- `chipInitiallyShown`: true in 16 cases, false in 15.
- `chipAfterOverlayDismissal`: true in 16 cases, false in 14, N/A in `final-year-review`.
- `chipMatchesExpectedDecision`: true in 8 cases, false in 8 cases, N/A in 15 cases.

Current visible chips that do not match the expected decision record:

- `ck_evt_005-consequence` selected `h-002654`.
- `ck_evt_092-consequence` selected `h-002648`.
- `ck_evt_140-answer` selected `h-007541`.
- `ck_evt_032-answer` selected `h-008762`.
- `ck_evt_032-consequence` selected `h-008761`.
- `ck_evt_042-answer` selected `h-009574`.
- `ck_evt_042-consequence` selected `h-009574`.
- `ck_evt_031-consequence` selected `h-018122`.

Chip visibility changes versus the prior 31-case capture:

- Newly shown: `ck_evt_005-answer`, `ck_evt_140-answer`.
- No longer shown: `ck_evt_092-answer`, `ck_evt_130-consequence`, `ck_evt_206-answer`, `ck_evt_206-consequence`.

Chip expected-decision match changes versus prior:

- `ck_evt_005-answer`: N/A -> true.
- `ck_evt_092-answer`: false -> N/A because the chip no longer appears.
- `ck_evt_092-consequence`: true -> false.
- `ck_evt_130-consequence`: true -> N/A because the chip no longer appears.
- `ck_evt_140-answer`: N/A -> false.
- `ck_evt_206-answer`: true -> N/A because the chip no longer appears.
- `ck_evt_206-consequence`: true -> N/A because the chip no longer appears.

Interpretation: the merged UI is functionally safe for manual chronicle location and exact consequence/backlink checks, but automatic chip visibility and chip-selected-record identity changed materially from `ee7d`. Do not use current chip presence as a stable latest-trunk pass/fail for specific expected decisions without the `chipMatchesExpectedDecision === true` field.

## Targeted old-history override comparison

- `ck_evt_038-final-no-pair`: current result agrees with targeted old-history; decision found, no exact future consequence link, presentation stable, tick/history stable.
- `ck_evt_140-final-no-pair`: current result agrees with targeted old-history; decision found, no exact future consequence link, presentation stable, tick/history stable.
- `ck_evt_201-consequence`: current result agrees with prior and targeted old-history; decision found and exact forward/back links pass.
- `ck_evt_038-answer`: current result agrees with targeted old-history on the known `/seen` presentation mismatch; no additional diff.

## Limits

- The run is browser replay over saved checkpoints with `run:false`; it does not prove simulation progression under latest trunk.
- History navigation is manual through chronicle filters; this does not prove first-season automatic visibility.
- `initialStateExact` is false in all current cases, as it was in prior and targeted captures; the functional checks here rely on exact history/trace, tick stability, presentation contract, decision location, and explicit link fields rather than raw whole-state equality.
