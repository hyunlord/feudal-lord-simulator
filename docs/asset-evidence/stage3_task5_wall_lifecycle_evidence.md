# Stage 3 Task 5 Wall Lifecycle Evidence

## RED

Command:

```bash
npx tsx --test tests/constructionDelivery.test.ts tests/labour.test.ts tests/constructionLifecycle.test.ts tests/constructionCancellation.test.ts tests/constructionSiteCardModel.test.ts tests/diagnosticCard.test.ts
```

Result before production edits: 41 tests, 33 pass, 8 fail.

Expected failing behaviors:

- `cancelConstruction leaves proclaimed palisade segments unchanged without refunds or cargo cleanup`
- `advanceTick completes a ready palisade segment as wall state without creating a building or house`
- `advanceFrame at 5x keeps a ready palisade segment visible until sixty wall ticks`
- `palisade aggregate completes only after the last planned segment completes`
- `queued palisade segment model identifies gate-outward position without adding a stall state`
- `construction site card disables palisade cancellation with an explicit reason`
- `palisade construction labour assigns only the earliest incomplete wall segment`
- `palisade construction labour advances to the next segment after the prior segment is complete`

## GREEN

Focused Task 5 command:

```bash
npx tsx --test tests/constructionDelivery.test.ts tests/labour.test.ts tests/constructionLifecycle.test.ts tests/constructionCancellation.test.ts tests/constructionSiteCardModel.test.ts tests/diagnosticCard.test.ts
```

Result: 41 tests, 41 pass, 0 fail.

Clean-patch check without Todo7 dirty files:

```bash
/Users/rexxa/.config/superpowers/worktrees/feudal-lord-simulator/stage3-palisade-age/node_modules/.bin/tsc --noEmit
/Users/rexxa/.config/superpowers/worktrees/feudal-lord-simulator/stage3-palisade-age/node_modules/.bin/tsx --test tests/constructionDelivery.test.ts tests/labour.test.ts tests/constructionLifecycle.test.ts tests/constructionCancellation.test.ts tests/constructionSiteCardModel.test.ts tests/diagnosticCard.test.ts
```

Result: typecheck passed; focused tests 41 pass, 0 fail in a detached HEAD temp worktree containing only the Task 5 files.

Affected regression command:

```bash
npx tsx --test tests/phase3Architecture.test.ts tests/palisadeProclamation.test.ts tests/palisadeGeometry.test.ts tests/constructionPlacement.test.ts tests/engineTick.test.ts tests/economyHarnessConstruction.test.ts tests/constructionDeliveryBusySource.test.ts tests/deliveryCancellation.test.ts tests/deliveryLifecycle.test.ts tests/deliveryTaggedDestinationBaseline.test.ts tests/simulationPorts.test.ts tests/routing.test.ts
```

Result: 63 tests, 63 pass, 0 fail.

Typecheck/build:

```bash
npx tsc --noEmit
npm run build
```

Result: both passed; Vite built 139 modules and emitted `dist/assets/index-CGE7fBAy.js`.

Full suite:

```bash
npm test
```

Result: 594 tests, 590 pass, 4 fail. All failures require local `ffmpeg` and are outside Task 5:

- `tests/terrainTexturePipeline.test.ts`: `spawnSync ffmpeg ENOENT`
- `tests/worldAssetRelease.test.ts`: three `spawnSync ffmpeg ENOENT` failures

LSP diagnostics:

- `omx_code_intel/lsp_diagnostics` transport closed.
- `mcp__lsp.diagnostics` reported TypeScript LSP is not installed and was previously declined.
- Compiler-backed diagnostics were covered by `npx tsc --noEmit`.

## Diff Hygiene

- Source pure LOC after split: `constructionLifecycle.ts` 139, `constructionCancellation.ts` 97, `palisadeConstruction.ts` 48, `labour.ts` 225, `palisadeLabour.ts` 52, `constructionSiteCardModel.ts` 98, `DiagnosticCard.tsx` 126, `GameCanvas.tsx` 83.
- Todo7 housing/protection files were left unstaged for the Task 5 commit.
