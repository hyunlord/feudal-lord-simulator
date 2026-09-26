# Independent QA A — Experiment integrity

Verdict: PASS for the comparison experiment, not production replacement.

- Exactly three real asset requests are routed into the actual Phase14 game. Screenshots are real browser captures; the comparison board only labels/resizes them.
- All three viewport pairs have identical paused snapshots (tick 0), zoom/LOD and exact cottage screen coordinates. All three candidate routes hit; no browser errors or horizontal overflow.
- Original canvas contracts retained: house 96×112, oak 88×112, grass 256×256. Sprite aspect ratios and bottom bounding-box anchors retained (house 96, oak 112). Genuine transparent backgrounds; most visible pixels have alpha ≥240.
- Both comparison boards inspected directly. No rectangular background contamination.

Limits: grass joins 6.63/7.28 vs baseline 0/0; visible repetition remains. Oak style differs from older trees. Bounding-box alignment does not prove every semantic footprint alignment. Paused frames do not establish moving-unit visibility, long-session performance or every zoom. Similarity 65/100 is a pixel metric, not a quality grade. Baseline files are the installed game assets; the experiment itself does not independently authenticate original generation hardware.

Reviewer: independent read-only `trial_integrity_review` agent, 2026-09-17. Product code unchanged.
