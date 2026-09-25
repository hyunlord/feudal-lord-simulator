# Representative family check (synthetic, not game installation)

Examined `representative-12x12.png` after first native-to-final resampling. Display factors: 0.3 / 0.5 / 0.675 (game zoom 0.6 / 1.0 / 1.35). The zoomed panels are viewports into the same 12×12 layout; higher-zoom outer tiles are clipped by the panel viewport. Repeated G trees intentionally test a family representative, not final variation placement.

- Orchard G: distinct fruit-bearing tree and split leaning trunk remain visible at 0.3. Broad low canopy is intentionally shorter than upright existing variants; neither silhouette stretch nor reflection was used.
- Stubble A: straw-colored short cut tufts and earth rows remain recognizable at 0.3. X seam RGBA equality verified. Its alpha exactly equals supplied growing A; supplied fallow A already differs from growing A at 12,534 / 32,768 alpha samples. Existing comparison references remain untouched; do not claim their historical outlines are identical.
- Farmstead A: thatched barn and courtyard distinguish its overall silhouette; the tiny plough/cart at 160×136 shown at 0.3 are small, so this check does not establish independent tool recognition. Registration uses the entire generated canvas, fixed pivot (80,120); no separate bbox centering.
- Ox alpha correction: native image viewing showed hidden brown RGB and led to an initial false halo rejection. Actual compositing on opaque white and green checkerboard (`ox-alpha-composite-review.png`) shows clean transparency for all four attempts. Outside alpha is zero; no manual silhouette removal is required or performed. Regenerate/white have broader paint and clearer reduced-size masses than initial/clean; source selection belongs to the lead.

This check establishes candidate readability at the stated display factors, not runtime integration, game occlusion, performance, or user approval. Recheck all final variants in requested proof sheets.

## Final nonmodule review

All 13 nonmodule assets processed and `proofs/02-orchards.png` / `proofs/03-fields-farmsteads.png` visually inspected after alpha compositing. Technical checks: 13 exact dimensions, transparent exterior, fixed requested pivots, source SHA/provenance, single native-to-target resample. Both stubble variants have zero X-edge RGBA differences and zero alpha differences against supplied growing A.

- Proof 02: four real Wave4b trees, one clearly separate earlier pilot, four new trees. G leaning / H low-wide / I slender young / J old gnarled silhouettes are distinguishable; G and H have similar fruit colors by design. The pilot and new I/J have finer leaf shapes than broad Wave4b canopy masses, so family paint density is not identical.
- Proof 03: five states shown at 0.3, with stubble rows A/B/A; farmstead a/b/working plus warehouse at 0.5 and 0.3; all four animal assets appended at both factors. Farmstead a and working use exactly the same full-source canvas mapping. At 0.3 the open door and props are subtler; this sheet does not claim each individual tool is readily identifiable.
- Animal transparency is verified through the composited final sheet. No brown background halo is visible; hidden source RGB is not part of the displayed alpha result. The selected ox team is the broad tan-paint regenerate source, explicitly recorded in `ox-plough-release.json`; previous attempts and prompts were retained.
- No native artwork was reflected, stretched to alter silhouette, or repainted procedurally. The stubble strip alone uses specified shape-independent alpha registration and X-edge color matching. These are candidate comparisons, not gameplay validation.
