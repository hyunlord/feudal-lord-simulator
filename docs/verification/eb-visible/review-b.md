# EB visible Pass B — REVISE (CJK), confidence high within captured viewport

Read-only review using omo:visual-qa Pass B. Actual PNGs opened with view_image at 1280×800; no source changes, simulations, or child agents. Render source results.json: be2c05f3bb555697bc6c750290c6abe2f151c754, clean; checkpoint source 2485af40046793f1856829fa1161dc4431942aa7. Capture root: `.remote-runs/render-EB-visible-smoke-be2c05f/eb-visible/`.

## Images actually inspected

- `ck_evt_{005,092,211,201}-consequence-decision.png` and `-consequence-because.png` (8 images).
- `ck_evt_038-final-no-pair-decision.png` and `final-year-review-initial.png` (2 images).
- `ck_evt_{005,092,211,201}-answer-decision.png` (4 additional reference images for shared change-diff evidence).

## Visible findings

1. **Medium, CJK line breaking; revision required.** 211 consequence decision, chosen column x780–920/y400–455: `낮/추고` and `양보한/다`, with final `다` alone. 092 consequence because x765–1245/y319–350: `낮춘/다` leaves a one-syllable final line. 038 final decision alternative x935–1080/y339–365: `시/도한다`. 005 chosen `다/음`, 201 chosen `거두/어` also split words. The 092 chosen break `650‰로 / 낮춘다` itself is acceptable; do not flag all two-line labels. Request renderer-owned keep-all phrase wrapping and adequate column width/type size, with these exact strings at 1280×800 as regression cases. Relevant source: `src/ui/chronicle/DecisionCompareFrame.tsx:14` fixes three narrow art-coordinate columns, :29 chosen, :33 alternatives; `src/styles/chronicle.css:307` thread-link wrapping lacks a keep-all rule. Source pointers identify the repair surface; computed styles were not independently inspected.
2. **Low, empty comparison affordance.** All five decision detail screens show an entirely blank third column headed `예측과 실제`, even the four with visible later payment. The actual receipt is legible below in `그 뒤에 일어난 일`; this is not proof of missing payment data. Request an explicit unavailable/comparison-not-applicable state or conditional comparison presentation. Source `DecisionCompareFrame.tsx:37` onward renders heading independently of row/pending content.
3. **Low, repeated copy.** 092 consequence decision left lower card repeats `큰 부담을 거두는 작은 시장:` twice (x130–604/y653–681). It also strands final `다.` on the next line. Request copy composition deduplication; do not infer duplicated game commands from duplicate text.

## Verified visible positives and limits

| Case | What is actually readable |
| --- | --- |
| 005 | Decision → first stall fee 1s 8d, with `여러 까닭 가운데 하나`; because view names the original keep-rate decision. |
| 092 | Decision → first stall fee 1s; because view names the 650‰ lowering decision. |
| 211 | Decision → first stall fee 10d; because view names the lower-dues choice. Relationship +6 is visible separately. |
| 201 | 1314 winter decision → 1315 spring first stall fee 10d; because view explicitly labels the originating 1314 decision. Date difference is intelligible, not a broken year label. |
| 038 | `집행을 미룬다`, alternative 80d attempt, and `아직 이 결정 뒤에 적힌 일이 없습니다` are visible. No fabricated future pair shown. |
| Final initial | World/HUD, `일시 정지 중 · Space`, famine chip, and church-unavailable toast. No annual review modal is visible in this screenshot. |

No tofu, missing glyphs, obvious clipped glyph baselines, overlapping detail controls, or unreadable contrast found in these 14 captures. Scroll-area partial cards at the top/bottom are not established text-loss defects. Small text remains readable at captured resolution; smaller viewports and zoom are untested. Screenshots alone do not prove button operation; results.json separately records four exactConsequenceLinkShown=true cases with errors=[] and tickUnchanged=true.

## Shared objective evidence consumed

`.omo/evidence/eb-visible-image-diff.json` compares answer to consequence decision screenshots, NOT an identical-state approved visual baseline. All command=image-diff; reference/actual dimensions 1280×800, dimensionsMatch=true, totalPixels=1024000, alphaChannelIntact=true.

| ID | diffPixels | diffRatio | similarityScore | hotspots |
| --- | ---: | ---: | ---: | ---: |
| 005 | 424083 | .4141 | 59 | 39 |
| 092 | 418953 | .4091 | 59 | 39 |
| 211 | 423515 | .4136 | 59 | 38 |
| 201 | 428104 | .4181 | 58 | 41 |

All hotspot coordinates/ratios were read. Region mapping covering the flagged cells: grid x0–4/y2–7 is the left record list, whose selected record moves from near y250 to y450 as later records appear and the list is scrolled; large near-1 changes here reflect different cards/positions, not proof of a layout regression. Grid x5–7/y5 is the new receipt replacing the no-follow-up sentence. Grid x5–6/y6 is the displaced memory/map controls below the receipt. Top-strip x1–3/y0–1 and right x7/y1–2 changes are time/era/record-count labels (201 crosses 1315). These visible changes explain the flagged regions without treating the score as visual acceptance. Alpha flag finds no unexpected image-channel loss; screenshots do not establish CSS transparency for every state.

## Completion boundary

This pass needs CJK wrapping revision before a clean visual verdict. It establishes readable manual chronicle decision↔because presentation in paused checkpoint reloads only. results.json has run=false, unchanged ticks, and automaticYearReview=false. It proves neither live 10× discoverability, first-season automatic exposure, automatic annual-review appearance, nor the latest three-seed coverage. No UI or engine edits were made.
