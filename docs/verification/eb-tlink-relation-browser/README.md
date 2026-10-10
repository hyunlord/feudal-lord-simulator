# EB-TLINK estate relationship browser evidence

Functional navigation PASS; narrow-screen visual acceptance NEEDS_WORK.

Official kept run `engineB-tlink-relation-browser-23d1226` used clean source `23d12264289538de5f6ef3ef3f36aa9257b10aba`. The remote command exited 0 in 36.5 seconds. `result.json` reports `pass: true`, no browser errors, exact save roundtrip, unchanged tick 2000 and history nextOrdinal 20.

The prepared consumed fixture contains actual estate-petition answer `h-000002` at tick 1000 and existing `stewardship.season` record `h-000003` at tick 2000. Its `estate_mood` cause names that answer with `part: true`; tenant influence +4 is consumed at the first real seasonal observation. The visible copy says the earlier answer's closer relationship with tenants remains this season. It does not establish that the answer caused the reported cash income.

Normal UI path: C shortcut (actual `chronicleAdmission` in `result.json`) → own answer → seasonal follow-up link → because backlink → own answer. This succeeded at 1280×800, then again after normal viewport resize to 390×844 without resetting state. Four PNGs retain both directions. The executed `driver.mjs` is preserved byte-for-byte inside `driver.mjs.gz`; its imports are designed for execution from the repository's ignored `.remote/` directory.

The parent reviewer directly inspected all four 23d screenshots; this packaging step verified their bytes and did not perform a separate visual review. Desktop shows the qualitative relationship sentence and usable links. At 390px, the top navigation and fixed-width detail content extend beyond the right edge: text/buttons are visibly clipped. DOM text and successful clicks do not prove complete narrow-screen readability. Baseline origin is unclassified: this archive has no paired baseline proving that clipping predates this change. The desktop answer's “예측과 실제” area is also blank; this is not full presentation acceptance.

This is a prepared regression fixture with a synthetic seasonal boundary, not natural play, a 125-year observation, aggregate 80% coverage, or income-causality proof. No source or renderer changes were made for this browser capture.

## Pins

- Executed driver SHA256: `374aa8d08a95fd45bb03c50c8f0e3876692c5c0135ab548c5d2fa2bdcc2e9585`.
- Input: `fixtures/saves/v56/eb-tlink-estate-relation-consumed.save.json`, 1,025,046 bytes; SHA256 `8d09ef0265b0f823cbae40bb5222701d33397da6a1e04d44213abf24b802cf3c`.
- Archived gzip expands to those exact input bytes; no normalization. Compressed SHA256: `519227a78807dcee6f670645e20c8b390ac9dfe00330fb727ec98a557b93a83c`.
- Every artifact size/hash recorded in `result.json` was independently checked before copying. The driver is gzip-packed without changing its original bytes (including its trailing blank line); expand it to the logical `driver.mjs` path named by the original result. `SHA256SUMS` covers every retained file except itself.

## Previous run retained

`result-864f1ea.json.gz` preserves the exact earlier result bytes (decoded SHA256 `9cc3c2c1b44cb55505b497eabc8f12bcb0873a3431f49a6f0ad5acf33586f480`) from clean source `864f1ea06851f0508109f34ab355e4843bb16ff4`, official kept run `engineB-tlink-relation-browser-864f1ea`. Its four PNGs are superseded here by the latest captures; original artifacts remain in the kept official run. This is provenance retention, not an additional independent natural-play sample.

`result-9ad9253.json.gz` preserves the exact previous 9ad result bytes (decoded SHA256 `a38819ab2aa65b666c654e58ef408fccd32f605eeb694e4bfa424ea5b116405d`). The existing 864 gzip is copied byte-for-byte. Neither prior run is represented as current 23d visual evidence.

Execution receipts are retained under `receipts/`: exact exit-code, timing and changed-files files plus byte-preserving gzip of the run log. The official run exited 0; command duration was 36.5 seconds. This prepared archive is local staging only and does not change tracked evidence.
