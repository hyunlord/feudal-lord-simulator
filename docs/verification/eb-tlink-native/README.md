# Native paired diagnostic receipts

Scope: 24 lots, max 500000 ticks, seeds 1–3. Target-scale-stable early termination is retained as measured. This is not the standard guardrail. Read comparison.json and recording-diff.json.gz separately; recording exclusions never overwrite the raw result or native exit code.

## Fetch and reproduce

Fetch the existing completed handle with `bash scripts/remote/run.sh --fetch engineB-tlink-native-latest-9ad9253` (confirm the exact handle against the original run receipt). Do not start another run. Locate eb-tlink-native-paired in the fetched artifact directory. Require provenance.txt, comparison.json, aggregate-exit-code, both source-tree.txt files, all six summary.json/final-state.json files and six seed exit codes. Verify every raw final-state byte count and SHA256 against manifest.json. A fetch reporting missing exit-code is incomplete, not terminal evidence.

From the original repository containing both pinned commits and the unchanged projector, place the retained diagnostic helper under .omo/evidence/ and run:

```sh
node --import tsx .omo/evidence/tlink-native-recording-diff.ts NATIVE_INPUT_DIR NEW_DIFF.json
```

The helper writes a new result only; non-recording differences exit 1 while preserving the report. Packaging does not remedy failed simulations or unavailable files. Raw files remain external; their exact relative paths, sizes and hashes are in manifest.json. The compressed report's original JSON SHA is recorded in the member list.
