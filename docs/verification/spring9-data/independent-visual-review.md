# Spring9 committed capture — independent visual gate

**PASS with stated visibility limits; no blocking introduced visual defect observed.** Reviewed on 2026-10-05. This is an independent inspection of the actual committed `70c153211187f5e7dedef538147136b22afdd8fc` native captures, not approval inferred from source approval or draw lineage. Sole write: this report. No product, installation, ledger or runtime changes and no new capture runs.

## Images individually opened

Every AFTER image below was individually opened through `view_image` at its native 1280×800 image size from `output/art-architecture/spring9-committed-70c15321/`. The three spring BEFORE images were individually opened from `output/art-architecture/season-core-committed-208c6222/`, alongside their corresponding AFTER. No contact sheet substituted for these thirteen image inspections.

| Actual PNG filename | Verdict and directly visible observation |
| --- | --- |
| prepared-season-spring-z1.png | PASS. Flowering orchard remains grounded inside the same outlined plot. Visible trunks and blossom silhouettes retain registration; no new opaque image rectangle, detached root, doubled trunk or cut canopy edge is apparent. Changes in peripheral tree foliage are modest in this framing. |
| prepared-season-spring-z06.png | PASS / visibility note. Wide framing exposes the forest groups and greener, brighter spring foliage. Forest bases remain aligned with the land and river edges. The orchard remains readable as a flowering group, but individual species and fine alpha edges cannot be resolved reliably at this zoom. Dense forest crowns obscure one another. |
| prepared-season-spring-z14.png | PASS / framing note. Close view makes orchard trunk-to-ground contact, blossom margins and small foreground details clearer. No new rectangular matte or pivot jump compared with BEFORE. The orchard's lower portion reaches beyond the bottom viewport in BOTH BEFORE and AFTER; this view cannot prove the whole orchard is unclipped. This is existing camera framing, not a new source-canvas defect. |
| prepared-season-summer-z1.png | PASS. Leafy orchard and scattered mature trees remain coherent with ground contact; no conspicuous missing rectangle or displaced silhouette. |
| prepared-season-summer-z06.png | PASS / visibility note. Forest, orchard and river compose consistently at overview scale. Small trees are readable as vegetation, not reliably distinguishable asset IDs. |
| prepared-season-autumn-z1.png | PASS. Orange broadleaf crowns and green orchard remain aligned to their trunks and terrain; plot outline and trees show no obvious broken edge or displaced base. |
| prepared-season-autumn-z06.png | PASS / visibility note. Autumn forest palette and orchard grouping remain legible; dense overlap limits individual-tree judgments. |
| prepared-season-winter-z1.png | PASS. Bare trunks and branches, evergreen groups and snow details remain grounded; no spring blossom leakage apparent. |
| prepared-season-winter-z06.png | PASS / visibility note. Winter overview retains forest and orchard structure. Thin bare branches lose detail at this scale without an obvious new clipping or placement problem. |
| prepared-season-winter-z14.png | PASS / framing note. Visible bare orchard trunks and nearby broadleaf roots meet the ground coherently. Lower plot is viewport-clipped in this close framing, so full plot visibility is not asserted. |

## Before/after findings and evidence separation

The three spring comparisons show retained overall layout, plot boundary and root positions. New spring forest foliage is visibly brighter/greener in the overview. The flowering orchard retains its established cream/pale blossom appearance and spacing. No introduced hard rectangular opacity patch, gross scale mismatch, anchor displacement or source-edge truncation is apparent in the visible subjects. The outlined olive orchard ground is already present in BEFORE and must not be misreported as a new opaque source background. Peripheral image-edge clipping and close-view lower orchard clipping are framing limitations. Existing dense forest occlusion remains.

Read `.omo/evidence/spring9-committed-summary.json` separately as machine evidence: ten views pass repeat A/A with zero differing pixels and no reported errors; seven non-spring views have zero BEFORE/AFTER differing pixels. Spring differences are 18,642 pixels at z1, 100,186 at z06 and 17,766 at z14, with identity equal after excluding the intentionally changed expectedRequests. These are recorded machine results, not a newly rerun pixel comparison by this reviewer. The seven non-spring AFTER images were still actually opened; byte-equality did not replace viewing them.

## Limits and disposition

This gate supports proceeding with the scoped candidate-promotion workflow when combined with the separate source/provenance/selection/decode/draw evidence. It does not itself edit or mark any candidate installed. All nine URLs being selected/requested/drawn does **not** establish that all nine are separately visible and identifiable in these crowded views. In particular, scattered dead-tree/pine variants, overlapping forest trees and the three orchard species are not individually attributable from these unlabelled screenshots alone. No claim of every source pixel, every occlusion case, natural play, motion, DPR2 or universal zoom readability is made. These are prepared scenes at DPR1 and zoom0.6/1/1.4; the close view uses its documented alternate camera. Source quality approval remains separate from this actual-capture visual gate. Post-ledger reference captures and final publication gates are outside this review.
