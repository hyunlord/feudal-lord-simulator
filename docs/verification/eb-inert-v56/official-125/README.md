# v56 integrated INERT cohort

Run: engineB-V56-inert-d4c9249
Source: d4c924986f1755c398ec30e643a3864e358ad233

Measured gate: **PASS**. Native hashes and render acceptance are separate.

| Metric | Before | After |
| --- | ---: | ---: |
| total | 836 | 682 |
| median | 2 | 2 |
| max | 6 | 6 |
| yearsAboveFour | 26 | 17 |

All 375 calendar rows and event/choice source counts are in frequency-detail.json. Raw observer files remain in the kept official run; manifest.json preserves original byte sizes and hashes. Both pass and fail are archived. No missing result is interpreted as a verdict.

The three `original/seed-{1,2,3}/manifest.json.gz` files retain the exact original JSON bytes after decompression. `manifest.json` records compressed paths/sizes/hashes in `files`; `originalFiles`, `rawSha256`, config replay pins and capture provenance keep the original uncompressed hashes.

Verify the committed archive (including gzip decoding, original hashes, cross-references, all checksums and the full folder size) from the repository root:

```sh
node docs/verification/eb-inert-v56/verify-archive.mjs
```

`official-125/archive.mjs` is the unchanged historical producer used to collect this result. The parent `archive.mjs` now emits gzip originals for future archives. Full raw observer replay remains separate from this compact-archive integrity check.
