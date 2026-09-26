# Independent QA B — Visual comparison

Verdict: PASS for the comparison trial; production replacement not established.

| Asset | Recommendation | Evidence |
| --- | --- | --- |
| Cottage | PROMOTE as preferred sample | Warm thatch roof and dark door distinguish houses from grass at game size; compatible orientation and brown/cream family; no visible rectangular background or halo. More painterly than adjacent buildings, so whole-set consistency still requires review. |
| Oak | HOLD for style integration | Irregular separated foliage masses improve circular silhouette. Trunk is readable at small size. Mixed forest exposes mismatch with flat strongly outlined old trees; moving-unit/road visibility not established. |
| Grass | HOLD for another tiling pass | Calmer short texture helps cottage readability. No severe border in 3×3, but recurring dark/light clusters remain. Joins 6.63/7.28 are below interior 9.61, which supports local continuity, not invisible repetition. |

1440 comparison is aligned and useful. 768 and 375 candidate screenshots show recognizability, not by themselves comparative improvement. The full experiment also retains matching baseline captures at both sizes.

All diff fields/hotspots inspected: matching 1440×900; 453524/1296000 pixels differ (34.99%); similarity 65/100; 52 hotspots concentrated mostly on grass-heavy left/lower world. Some UI pixels also change, so this is not a pure asset mask. Screenshot alphaChannelIntact does not independently certify sprite edges; separate asset metrics address sprite alpha.

Existing narrow-screen UI crowding is outside this asset trial. Reviewer directly opened seven supplied images and read all diff/seam data. Independent read-only `trial_visual_review` agent, 2026-09-17.
