# Runtime coverage evidence audit

Audited 2026-10-05 from completed local artifacts in `/Users/rexxa/fls-astra-renderB/output/art-architecture`. Machine-readable per-entry observations, identity checks, file hashes, and source-manifest SHA256s are in [`runtime-coverage.json`](runtime-coverage.json). Audit helper: `.omo/audit/runtime-coverage.mjs` (read-only inputs). No product, harness, comparator or test changes; no browser/remote execution.

## Result

| Evidence | Result |
|---|---|
| before-v3 capture | PASS: 28 views, 28 exact A/A repeats, zero errors |
| core-v3 capture | PASS: 28 views, 28 exact A/A repeats, zero errors |
| before → core | All 28 complete identities equal, including expected requests; exact RGBA hashes equal |
| core-pixels-v3 | PASS: 28 lossless PNG comparisons, zero differing pixels, zero channel delta |
| data-v3 capture | PASS: 8 views, 8 exact A/A repeats, zero errors |
| core → data identity | All 8 equal after excluding only `expectedRequests` |
| frozen product | All 1,039 recorded code hashes match current main and isolated data-proof checkout |

Identity comparison includes saved-state SHA, state name/tick/season, camera tile, zoom, viewport, DPR, browser version, renderer, frozen Date/performance time and capture protocol. Both repeat RGBA SHA and the repeat comparator pass were independently checked. The strict migration comparator was not modified or relaxed.

## Observed asset coverage

Wave42: all 36 catalog entries appear in expected requests and satisfy request, HTTP 200 response, successful decode at exact catalog dimensions, and actual canvas draw-lineage observation in every view where expected, for both baseline and core. None are supported solely by preload evidence. The catalog has 40 rules; every entry is referenced and every variant target resolves to an entry. The isolated data-proof retains the identical Wave42 bundle and rules.

House data: all 36 wave20-era entries satisfy those same observations in data-v3. The bundle has 26 rules with no unreferenced entry or unknown variant target. The 36 runtime files consist of exactly 32 files absent from current core and four existing byte-identical files reused. Every isolated runtime file SHA matches its declared provenance SHA. This is 36 observed catalog URLs, not 32 total URLs.

The 28-view core set consists of the eight original city views plus 20 prepared fixture views. Prepared fixture coverage is deliberate saved-state construction; it is not evidence that normal simulation naturally reached every stage. Summer/winter and zoom 1/0.6 are covered. This is entry coverage, not exhaustive coverage of all selection boundaries, rule combinations, seasons, zooms or gameplay conditions.

## Intentional data-install image differences

Decoded lossless PNGs were compared with the existing `comparePng` helper. All dimensions remain 1280×800. All eight core → data comparisons correctly return strict pixel equality `pass: false` because installing the house bundle intentionally changes painting. These are diagnostic change measurements, not migration-equality passes.

| Year / season | Zoom 1 changed pixels | Zoom 0.6 changed pixels |
|---|---:|---:|
| 1350 summer | 50,834 | 17,992 |
| 1350 winter | 50,721 | 17,948 |
| 1400 summer | 49,727 | 17,580 |
| 1400 winter | 49,960 | 17,670 |

## Limits of the evidence

Actual draw-lineage means an image reaches the captured canvas through observed draw calls, including offscreen intermediates. It does not assert that all of its pixels remain visible after occlusion or later compositing, or that a human has approved its appearance. The prepared fallow plot intentionally draws before its house and may be partly covered. Request/decode/draw evidence, exact repeated pixels, source selection preflight and human visual inspection are distinct claims.

The frozen hash ledger establishes equality for the 1,039 recorded product-code paths in the two current checkouts; capture `commit` alone does not identify uncommitted changes. No claim of exhaustive product-file inventory or independent remote filesystem attestation is made by that hash check. Runtime captures and their manifests establish the recorded runs; source-manifest hashes pin the artifacts audited here.


## Separate remote code attestation

[`remote-code-freeze.json`](remote-code-freeze.json) records the actual kept remote core-v3 and data-v3 product-code inventory: both expected and actual counts are 1,039, both difference lists are empty, and both pass. Their aggregate SHA256 is `fe924ebd99df4aef97eddbf24de5b0c86c7b68958e9300982c49002237492e8d`. This remote attestation supplements the local checkout hash audit above; it is a separate evidence source. The main working tree remains core-only pending the separate data installation commit.
