# EB visible125 seed1 — bounded visual review

Verdict: **REVISE remains; this is not whole-run acceptance.** Read-only inspection of 10 existing 1280×800 screenshots: eight decision-detail views and two consequence/because views. No browser jobs, simulation, UI changes, or source changes were performed. Reviewed directory: `.remote-runs/render-EB-visible125-seed1-ee7d0ff/eb-visible125-seed1/`.

## Concrete findings

- Korean glyphs render in all ten inspected images; no replacement boxes or missing-glyph blocks were visible. Main decision names, years/seasons, consequence text, and navigation controls are readable at the captured resolution.
- **All eight decision-detail views have a completely empty “예측과 실제” column.** Its header and bordered column remain visible without an explanation. This is a presentation gap; it does not demonstrate missing simulation facts. The separate “그 뒤에 일어난 일” section does contain consequence text in all eight.
- **CJK line breaking still needs revision.** The narrow comparison columns split Korean words, sometimes leaving a single final syllable on its own line. Examples include 009 `낸 / 다`, 031 `교체한 / 다`, 024 `낮춘 / 다` and `유지한 / 다`, and 165 `취소한 / 다`. Text is decipherable, but these breaks impede scanning. The wider because-view links wrap more naturally and retain their content.
- No clear text overlap between comparison columns or right-panel clipping was observed. The right-hand consequence controls remain within the viewport. Left-list cards are partially clipped at the scroll viewport edges; 009 has its selected card near the lower boundary. Such edge clipping is a scrolling/capture framing limitation, not evidence that a record was lost.
- The full-width top timeline/filter area consumes roughly the first 230 pixels; the two-pane list/detail layout is stable across the reviewed images. The empty comparison column and unused lower detail area leave substantial blank space while option text wraps densely.
- The two inspected because views show a selected outcome, a readable backward decision link under “이 일이 따라 나온 결정”, and the historical map with legend and comparison control. These are visible UI receipts, not proof that the small map visually depicts the economic or timber effect.

## Per-screen observations

All filenames below are relative to the reviewed directory.

| Entry / screenshot | Visible decision → consequence | Readability and layout |
| --- | --- | --- |
| 053 `ck_evt_053-consequence-decision.png` | 1319 summer court-record evidence → 1319 autumn suit enters evidence stage | Korean readable; chosen option wraps inside `기록 / 을`; empty prediction/actual column; later-event link visible with shared-cause qualifier. |
| 009 `ck_evt_009-consequence-decision.png` | 1325 summer court-book copy → 1325 autumn suit enters evidence stage | Alternative ends `낸 / 다`; selected list card is low in viewport; empty prediction/actual column; consequence link readable. |
| 032 `ck_evt_032-consequence-decision.png` | 1334 summer court-record evidence → 1334 autumn suit enters evidence stage | Chosen option splits `증거 / 를`; no visible right-panel overflow; empty prediction/actual column. |
| 130 `ck_evt_130-consequence-decision.png` | 1337 spring visiting-audit choice → 1339 autumn estate audit | Chosen text splits `바 / 꾼다`, alternative `받 / 는다`; empty prediction/actual column. Visible dates span multiple years; this screen must not be described as a few-season outcome. |
| 031 `ck_evt_031-consequence-decision.png` | 1369 autumn steward replacement → 1371 autumn estate audit | Alternative strands final `다`; full selected card and consequence link visible; empty prediction/actual column. Dates span two years. |
| 024 `ck_evt_024-consequence-decision.png` | 1376 summer market-stall rate 750‰ → 1376 winter first subsequent stall tax 2s 3d | Chosen option strands final `다`; alternative similarly breaks; amount and shared-cause qualifier readable; empty prediction/actual column. |
| 206 `ck_evt_206-consequence-decision.png` | 1378 autumn remaining timber order 10 → timber 2 arrives, also 1378 autumn | Chosen option splits `10 / 단`; alternative strands final `다`; relationship +6 memory line visible; empty prediction/actual column. Same-season labels alone do not establish exact tick ordering. |
| 165 `ck_evt_165-consequence-decision.png` | 1424 winter remaining timber order 12 → timber 2 arrives, also 1424 winter | Chosen option splits `12 / 단`; cancellation alternative strands final `다`; relationship +6 line visible; empty prediction/actual column. Exact tick ordering requires manifest/raw evidence. |
| 024 `ck_evt_024-consequence-because.png` | Stall-tax receipt → 750‰ decision backlink | Receipt and wrapped backlink remain inside their boxes; map, legend, and “지금과 나란히” control visible. No comparative amount explanation is visible in this screenshot. |
| 206 `ck_evt_206-consequence-because.png` | Timber 2 receipt → remaining order 10 backlink | Receipt, backlink, historical map, and controls visible; no text clipping in right pane. Map does not by itself establish delivered timber appearance. |

## Claim boundaries

This sample supports visible Korean decision/outcome/backlink receipts for the listed cases. It does not certify all 31 captures, all 56 supported IDs, all seeds, mobile layouts, accessibility, interactivity, exact causal primacy, or original-state correctness. No independent capture-manifest/state-hash revalidation was performed in this visual-only pass. Shared-cause wording is visible in the suit/audit/tax decision views; it must not be promoted to sole or dominant causation.

The existing smoke CJK REVISE finding is not closed by these screenshots. The observed broken-word wrapping and blank prediction/actual columns warrant retaining that status. Known 038/140 final-image selection failures belong to the capture helper's 100-scroll limit per the parent investigation; this review neither rechecked those images nor classifies them as missing engine data.

## Reviewed file hashes

| File | SHA-256 |
| --- | --- |
| `ck_evt_053-consequence-decision.png` | `6b21ca7a1cb7ba4c92ebb2c63639b12172b87f219b727de9e71950dc77e8e461` |
| `ck_evt_009-consequence-decision.png` | `90c6f4e8f004737a9faf8318c7710604d017b7ace100a30d7f22f10b727bcf22` |
| `ck_evt_032-consequence-decision.png` | `6b71fdcb55518a9ac24df1b1b57eaf0ec3ca0c0b27ebed27dd17a02b4cddd8e7` |
| `ck_evt_130-consequence-decision.png` | `32698d7db167809ceb9c1e089e1bede939b64bd25b8b1f7b11596ac9e529494c` |
| `ck_evt_031-consequence-decision.png` | `27e9f4ae248d764b4249ac149dd86b5abd697773e5c0f3db33740b606b5251a8` |
| `ck_evt_024-consequence-decision.png` | `7cae27bc93593e40d63db6ffe65f9375e0b0bb6a7d70ef866409ec78f4151489` |
| `ck_evt_206-consequence-decision.png` | `4da5fbc69880dfa5422dbf0607e8e0d4f4d9dd54edcf1690a216dbf775daceaf` |
| `ck_evt_165-consequence-decision.png` | `9f8558bae70c4d19e811cdf2fc37f538404a97f0d43b79ef9266a8fcd6e55eb9` |
| `ck_evt_024-consequence-because.png` | `014b48b284df14b0b7cb30e85b87ada9ec6c4b469de57b9d1307c06f2e21235d` |
| `ck_evt_206-consequence-because.png` | `403b5e7b951e8f9d74f7e6bdc51bb48c8e2aecd99f60328a8e298f8928d88a92` |
