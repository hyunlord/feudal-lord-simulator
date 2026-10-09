# EB-TLINK estate relationship browser evidence

Functional navigation PASS; narrow-screen visual acceptance NEEDS_WORK.

Official kept run `engineB-tlink-relation-browser-864f1ea` used clean source `864f1ea06851f0508109f34ab355e4843bb16ff4`. `result.json` reports `pass: true`, no browser errors, exact save roundtrip, unchanged tick 2000 and history nextOrdinal 20.

The prepared consumed fixture contains actual estate-petition answer `h-000002` at tick 1000 and existing `stewardship.season` record `h-000003` at tick 2000. Its `estate_mood` cause names that answer with `part: true`; tenant influence +4 is consumed at the first real seasonal observation. The visible copy says the earlier answer's closer relationship with tenants remains this season. It does not establish that the answer caused the reported cash income.

Normal UI path: chapter's “전체 연대기 보기” button → own answer → seasonal follow-up link → because backlink → own answer. This succeeded at 1280×800, then again after normal viewport resize to 390×844 without resetting state. Four PNGs retain both directions. The executed `driver.mjs` is preserved byte-for-byte inside `driver.mjs.gz`; its imports are designed for execution from the repository's ignored `.remote/` directory.

All four screenshots were directly inspected. Desktop shows the qualitative relationship sentence and usable links. At 390px, the top navigation and fixed-width detail content extend beyond the right edge: text/buttons are visibly clipped. DOM text and successful clicks do not prove complete narrow-screen readability. Baseline origin is unclassified: this archive has no paired baseline proving that clipping predates this change. The desktop answer's “예측과 실제” area is also blank; this is not full presentation acceptance.

This is a prepared regression fixture with a synthetic seasonal boundary, not natural play, a 125-year observation, aggregate 80% coverage, or income-causality proof. No source or renderer changes were made for this browser capture.

## Pins

- Executed driver SHA256: `374aa8d08a95fd45bb03c50c8f0e3876692c5c0135ab548c5d2fa2bdcc2e9585`.
- Input: `fixtures/saves/v56/eb-tlink-estate-relation-consumed.save.json`, 1,025,046 bytes; SHA256 `8d09ef0265b0f823cbae40bb5222701d33397da6a1e04d44213abf24b802cf3c`.
- Archived gzip expands to those exact input bytes; no normalization. Compressed SHA256: `519227a78807dcee6f670645e20c8b390ac9dfe00330fb727ec98a557b93a83c`.
- Every artifact size/hash recorded in `result.json` was independently checked before copying. The driver is gzip-packed without changing its original bytes (including its trailing blank line); expand it to the logical `driver.mjs` path named by the original result. `SHA256SUMS` covers every retained file except itself.
