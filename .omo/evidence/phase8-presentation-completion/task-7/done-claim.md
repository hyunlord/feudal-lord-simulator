# Phase 8 Todo7 strict world-asset contracts done claim

Date: 2026-08-07
Worktree: `/Users/rexxa/.config/superpowers/worktrees/feudal-lord-simulator/stage3-palisade-age`

## Scope completed

- Added strict Phase 8 foliage release contract:
  - preserved ground cover keys: `shrub_a`, `shrub_b`, `grass_tuft`, `field_stone`
  - added tree/stump keys: `tree_oak_large`, `tree_oak_small`, `tree_pine_tall`, `tree_pine_short`, `tree_birch`, `tree_dead`, `stump_fresh`, `stump_old`
  - locked tree/stump dimensions: `88x112`, `64x80`, `64x120`, `56x88`, `60x96`, `56x80`, `40x24`, `36x20`
- Preserved terrain release keys exactly: `grass`, `forest_floor`, `water`, `rock`, `packed_earth_road`, each `256x256`.
- Enforced strict manifest metadata:
  - accepted references exactly `house_03`, `mill_02`, `granary_08` with portable path, dimensions, and lowercase sha256
  - 8 candidates for each of 8 tree/stump subjects
  - candidate path, seed, dimensions, hash, alpha/palette/transparent-background/no-shadow checks
  - four-score rubric and total validation
  - selected candidate must be the lowest seed among the top score
  - parchment metric threshold schema
- Added generator dry-run CLI that prints a deterministic job manifest and does not call ComfyUI.
- Updated asset pipeline producer/verifier contract surfaces to compile with the strict manifest.

## Evidence

| Scenario | Invocation | Binary observable | Artifact |
| --- | --- | --- | --- |
| Strict manifest parser and mutation gates | `npx tsx --test tests/worldAssetManifest.test.ts` | `tests 10`, `pass 10`, `fail 0` | `.omo/evidence/phase8-presentation-completion/task-7/green/worldAssetManifest.green.log` |
| Generator catalog and no-network dry-run contract | `python3 tests/test_generate_world_assets.py` | `Ran 14 tests`, `OK` | `.omo/evidence/phase8-presentation-completion/task-7/green/generateWorldAssets.green.log` |
| Generator full dry-run manifest | `python3 scripts/generateWorldAssets.py --dry-run` | `catalogJobs=133`, `queuedJobs=133`, `treeStumpCandidates=64`, `emittedTreeStumpJobs=64` | `.omo/evidence/phase8-presentation-completion/task-7/manual/generateWorldAssets.dry-run.full.json` |
| Generator targeted dry-run manifest | `python3 scripts/generateWorldAssets.py --dry-run --target foliage:tree_oak_large` | `queuedJobs=8`, `treeStumpCandidates=64`, `emittedTreeStumpJobs=8` | `.omo/evidence/phase8-presentation-completion/task-7/manual/generateWorldAssets.dry-run.tree_oak_large.json` |
| Dry-run summary check | `node -e ...` over the two dry-run JSON files | printed exact counts for both dry-run artifacts | `.omo/evidence/phase8-presentation-completion/task-7/manual/generateWorldAssets.dry-run.summary.log` |
| Generator dry-run repeated adversarial check | `python3 scripts/generateWorldAssets.py --dry-run` run twice, then `node -e ...` assertions | both runs reported `treeStumpCandidates=64`, `comfyuiRequests=0`, `emittedTreeStumpJobs=64`, and identical JSON | `.omo/evidence/phase8-presentation-completion/task-7/manual/generateWorldAssets.dry-run.twice.summary.log` |
| Synthetic verifier PASS | `npx tsx .omo/evidence/phase8-presentation-completion/task-7/manual/syntheticVerifierCli.ts valid` | `SYNTHETIC_VERIFIER_PASS scenario=valid assets=28 selections=8` | `.omo/evidence/phase8-presentation-completion/task-7/manual/synthetic-verifier/valid.log` |
| Synthetic verifier mutations FAIL nonzero | `npx tsx ... syntheticVerifierCli.ts bad-hash|bad-dimension|exact-set|missing-file` | each mutation exited nonzero and logged `SYNTHETIC_VERIFIER_FAIL` | `.omo/evidence/phase8-presentation-completion/task-7/manual/synthetic-verifier/mutations.summary.log` |
| Synthetic verifier cleanup receipt | `rg '^cleanup=removed' .../synthetic-verifier/*.log` | five temp fixture roots recorded as removed | `.omo/evidence/phase8-presentation-completion/task-7/manual/cleanup-receipt.log` |
| Asset sprite contract propagation | `npx tsx --test tests/worldSpritePipeline.test.ts` | `tests 12`, `pass 12`, `fail 0` | `.omo/evidence/phase8-presentation-completion/task-7/green/worldSpritePipeline.green.log` |
| Release filename contract slice | `npx tsx --test --test-name-pattern 'maps every Phase 8 release foliage key' tests/worldAssetRelease.test.ts` | `tests 1`, `pass 1`, `fail 0` | `.omo/evidence/phase8-presentation-completion/task-7/green/worldAssetRelease.filename-slice.green.log` |
| DGX ffmpeg-backed release verifier | `ssh -o ControlMaster=no -o ControlPath=none ... 'timeout 240 ... npx tsx --test tests/worldAssetRelease.test.ts'` against a temp worktree patched with Todo7 owned code only | `tests 4`, `pass 4`, `fail 0`; temp worktree cleanup recorded | `.omo/evidence/phase8-presentation-completion/task-7/dgx/worldAssetRelease.ffmpeg.log` |
| DGX remote patch cleanup | `ssh ... 'rm -f /tmp/phase8-todo7-owned-code.patch; test ! -e ...'` | removed uploaded patch file | `.omo/evidence/phase8-presentation-completion/task-7/dgx/remote-patch-cleanup.log` |
| TypeScript integration | `npm run typecheck` | `tsc --noEmit` exited 0 | `.omo/evidence/phase8-presentation-completion/task-7/green/typecheck.green.log` |
| Owned diff whitespace sanity | `git diff --check -- <Todo7 asset files>` | exited 0 with empty output | `.omo/evidence/phase8-presentation-completion/task-7/green/diff-check.green.log` |
| Final focused manifest suite | `npx tsx --test tests/worldAssetManifest.test.ts` | `tests 10`, `pass 10`, `fail 0` | `.omo/evidence/phase8-presentation-completion/task-7/green/worldAssetManifest.final.log` |
| Final generator suite | `python3 tests/test_generate_world_assets.py` | `Ran 14 tests`, `OK` | `.omo/evidence/phase8-presentation-completion/task-7/green/generateWorldAssets.final.log` |
| Final sprite pipeline suite | `npx tsx --test tests/worldSpritePipeline.test.ts` | `tests 12`, `pass 12`, `fail 0` | `.omo/evidence/phase8-presentation-completion/task-7/green/worldSpritePipeline.final.log` |
| Final release filename slice | `npx tsx --test --test-name-pattern 'maps every Phase 8 release foliage key' tests/worldAssetRelease.test.ts` | `tests 1`, `pass 1`, `fail 0` | `.omo/evidence/phase8-presentation-completion/task-7/green/worldAssetRelease.filename-slice.final.log` |
| Final TypeScript integration | `npm run typecheck` | `tsc --noEmit` exited 0 | `.omo/evidence/phase8-presentation-completion/task-7/green/typecheck.final.log` |
| Final owned diff whitespace sanity | `git diff --check -- <Todo7 asset files and evidence>` | exited 0 with empty output | `.omo/evidence/phase8-presentation-completion/task-7/green/diff-check.final.log` |

## Not run / blocked

- Full `tests/worldAssetRelease.test.ts` was not claimed green locally because the local machine lacks `ffmpeg`.
  - Probe artifact: `.omo/evidence/phase8-presentation-completion/task-7/manual/local-ffmpeg-probe.log`
  - Failed full release attempt artifact: `.omo/evidence/phase8-presentation-completion/task-7/green/assetRelease.attempt1.log`
- DGX did run the ffmpeg-backed focused release suite in a temp worktree and passed 4/4.

## Non-owned dirty work preserved

The worktree contains unrelated/parallel edits outside Todo7. They were not reverted.

- `scripts/economyHarnessScenario.ts`
- `scripts/economyHarnessSerializer.ts`
- `scripts/phase4eBenchmarkFixture.ts`
- `src/App.tsx`
- `src/content/palette.ts`
- `src/engine/engine.types.ts`
- `src/engine/tick.ts`
- `src/render/renderObjectFrameCache.ts`
- `src/state/gameStore.ts`
- `src/styles/global.css`
- `src/ui/BuildMenu.tsx`
- `src/ui/InfoPanel.tsx`
- multiple non-asset test fixtures updated for `forestHarvests`
- untracked `scripts/checkContrast.ts`
- untracked `src/engine/forestHarvests.ts`
- untracked `tests/contrastGate.test.ts`
- untracked `tests/forestHarvests.test.ts`
- untracked `.omo/evidence/phase8-presentation-completion-gate-review.md`
