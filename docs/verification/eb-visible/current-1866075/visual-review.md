# EB latest actual UI — independent visual review

**Verdict: REVISE remains for presentation quality.** Direct image-tool inspection of eight existing PNGs covering seven requested cases. This is a bounded sample of the completed 31-case capture, not a visual pass for every image. No new browser, simulation, or UI/source edit.

Evidence directory: `.remote-runs/render-EB-visible-current-1866075/eb-visible-current/`. Capture source `18660752adef3d7632e9aac3a6b211f6a7e0e549`, clean; checkpoint source `2485af40046793f1856829fa1161dc4431942aa7`; manifest SHA-256 `e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d`. Viewport 1280×800; run=false.

## Findings against the earlier REVISE

- **Empty prediction/actual column persists in all seven inspected decision-detail views.** The framed “예측과 실제” heading occupies a full third column with no value or missing-data explanation. This is the same presentation gap described in `.omo/evidence/eb-visible125-visual-review.md`; it is not closed. It does not prove absent engine effects, because several of these views show a separate linked consequence below.
- **CJK wrapping remains awkward but readable.** 130 splits “바 / 꾼다” and “받 / 는다”; 031 alternatives leave final “다” on the next line; 165 splits “12 / 단” and “취소한 / 다”; 005 chosen text splits “다 / 음”; 032 chosen text breaks “증거 / 를”. No missing-glyph squares were seen. These are word/phrase wrapping issues, not a failed font load.
- **Panel containment is good in this sample.** The selected row, right decision heading, choices, available consequence links, and map action remain visible. Recorded right detail box is x748.48/y230.66, width515.52/height557.34, inside=true for each reviewed case. The 005 chip box is x912/y272, width360/height145.5, inside=true. Direct screenshots agree; no main right-panel overflow or inter-column collision was apparent.
- The left virtual list intentionally shows partial rows at its upper/lower edges. The selected rows in this sample remain visible; long *other* list descriptions can be cut by row/button bounds. In particular, 038's adjacent authored description is visibly incomplete. Do not mistake that neighboring description for the selected decision's complete effect receipt.
- **038 capture reachability is improved.** Its final-save screenshot now selects the actual old 1309 decision (“판결 뒤에도 닫힌 문: 집행을 미룬다”) while the current year is 1425, using from/to 1309 and all records. The current results record decisionLocated=true. The older report's helper scroll-limit failure does not apply to this screenshot. This capture correction does not resolve blank-column/CJK design issues.

## Per-image review

| Image | Directly visible evidence | Caveat |
|---|---|---|
| 005 consequence chip | Readable market-dues title, 110% choice text, first later tax 1s 8d, chronicle/advice/close controls inside viewport | Actual chip-selected ID is h-002654, a separate market-dues decision, not the 005 registry decision. Do not count it as automatic 005 identity. |
| 005 consequence decision | Correct registry choice “기존 세율을 지키며 다음 거래를 지켜본다”, tax consequence link, relationship −2 memory | Manual record navigation; empty prediction/actual column; awkward narrow chosen-text break. |
| 092 answer decision | 650‰ choice with alternatives; explicit “아직 이 결정 뒤에 적힌 일이 없습니다” | This is the answer checkpoint before retained later consequence. No visible chip selected in this case; absence here is not proof no future effect. |
| 032 consequence decision | 20d legal-record evidence choice; later suit evidence-stage link with shared-cause qualifier | “증거 / 를” wrap; blank prediction/actual. Recorded first chip selects h-008761, not this case decision. |
| 130 consequence decision | 1337 spring visiting-audit choice; linked estate audit dated 1339 autumn | Several years between visible labels; cannot describe this as a fixed first-season result. |
| 031 consequence decision | 1369 autumn loyal steward replacement; linked estate audit dated 1371 autumn | Two-year labelled gap; current chip selects an older estate-petition decision h-018122. |
| 038 final decision | Correct old decision and alternatives; explicit no-follow-up text | No future link shown in this view; do not infer the absence of all underlying suit state changes from that statement. |
| 165 consequence decision | Remaining order12 choice; later timber2 arrival link and town relation+6 | Arrival2 is not delivery of the entire12 order. Same-season labels do not independently prove exact timing. The current chip ID matches h-032652. |

## Functional cross-check and limits

For these seven cases, existing results have errors=[], decisionLocated=true, and initial/final complete expected presentation comparisons true. Five consequence cases (005/032/130/031/165) record exactConsequenceLinkShown=true; 092 answer and 038 final do not. This review read those assertions but did not replay their interactions. The automatic chip's source and the manually selected case record are separate evidence; the raw DOM-ID results, not screenshot filenames, establish which chip was opened.

The old REVISE is retained for empty comparison content and CJK breaks. These paused screenshots do not show automatic season transitions, first arrival timing, 10× delivery, seasonal stewardReport, all 56 events, all seeds, mobile behavior, or measured accessibility/font-size/contrast compliance. Dates in the manual history are evidence of stored dates and visible links, not automatic presentation timing. Shared-cause qualifiers are visible and must not be promoted to sole causation.

## Inspected artifact hashes

`results.json` SHA-256 `d8727c11caa1ddeb930ea569ca04bf2db614495aaf1758da2cdd5117a2be4549`.

| PNG directly viewed | SHA-256 |
|---|---|
| `ck_evt_005-consequence-chip.png` | `c9c6f8c32f78117695726dd3b63feb15274ebdbee781250ff5eb9585cd70dda4` |
| `ck_evt_005-consequence-decision.png` | `d4ea7951edb905ffadb14497ba4857f04d2aa33bfa78b243b847b39b60ddff51` |
| `ck_evt_092-answer-decision.png` | `ebbf9cc15604cb322abff71ab9ab0a6f47bf5cb68b3a3d4219d47f500be0e9d5` |
| `ck_evt_032-consequence-decision.png` | `4a73585d62ba214c8352b6b509ce6d7088025abe6851ba4bf2a96e983752e3eb` |
| `ck_evt_130-consequence-decision.png` | `afa7064c988cd5ff9440feb6bf8e0f1fe4da684c7875b902c438a108fcc94d88` |
| `ck_evt_031-consequence-decision.png` | `411cb469af6e41eed864d19bd5d1c19c0b76e001f52d7d735814588f67e1e624` |
| `ck_evt_038-final-no-pair-decision.png` | `9926b01e97674d530301d7771ab2a85b0a5fd7ea54165f797ef807804d68fef4` |
| `ck_evt_165-consequence-decision.png` | `4da62cfc1c2b7818430353dc0c882b9829a33fbebb4f0a823afa8e881891db26` |
