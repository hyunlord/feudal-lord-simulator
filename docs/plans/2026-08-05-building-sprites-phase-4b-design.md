# Phase 4B Building Sprite Design

## Goal

Make the house, watermill, and storage barn read as one settlement family at the game's default zoom without touching the renderer.

## Method

Keep the Phase 4A SDXL guided-inpaint pipeline, 1024px generation, 2:1 view, upper-left light, cyan key, and Lanczos downscale. Replace only the structural guide and subject clauses. The house remains a low one-room hut. The mill becomes a short, wide building with a wheel on its side face. The storage building uses the required long rectangular barrel-vaulted form and avoids the misleading subject words.

The final processed alpha bounding box is the scale authority. One-tile subjects must be 64–90px wide; the two-tile barn must be 115–141px wide. Out-of-band candidates are rejected before evidence assembly. Visible pixels stay in the canonical ramps. Ramp counts and proportions are emitted per candidate so plaster/timber dominance and excessive stone/slate can be reviewed numerically.

The outline is a one-pixel exterior dilation at final scale using ink RGB and alpha 179. It does not trace internal transparent holes and is omitted below the lower-third cutoff. One accepted hut is also shown without this outline in the contact sheet.

## Evidence

Generate eight candidates per subject. Publish the 24 processed candidates, a contact sheet including the no-outline hut variant, an old/new comparison, and an in-context screenshot with the three picks close together along one road. Preserve renderer and determinism hashes and report all rejections honestly.
