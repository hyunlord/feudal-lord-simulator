// The tests that read src/ by walking its folders, not by importing a file (decision RR24, 2026-10-09). The import graph
// of test:changed (changedTests.mjs) never reaches them, so a change in src/ picks every one of them: an engine comment
// matching phase3Architecture's DOM pattern (5ce62b92, EB-LME9c-2) and drawBuildings.ts over renderSourceGuards' size
// limit (f749fecc) both reached the trunk unpicked. Together they run in about 11 s on the Mac.
// tests/sourceScanTests.test.ts keeps the list whole: a test that calls readdir and names a src path is either here or
// in NOT_SOURCE_SCAN with the reason.
export const SOURCE_SCAN_TESTS = [
  "tests/buildingCatalog.test.ts",        // no per-building table outside the catalog
  "tests/economyHarness.test.ts",         // src/engine
  "tests/frameTokens.test.ts",            // src/styles, src/ui, src/render
  "tests/hoverOnlyInfo.test.ts",          // src/ui, src/render
  "tests/inventedNames.test.ts",
  "tests/ledger.test.ts",
  "tests/lmr2Ledger.test.ts",             // who imports src/ui/lord/ledger
  "tests/lmr2LordPortraits.test.ts",      // src/ui/lord
  "tests/lmr2LordScreen.test.ts",         // src/styles, src/ui/lord
  "tests/lmr2Negotiation.test.ts",        // src/ui/lord/negotiation
  "tests/palette.test.ts",
  "tests/phase11PublishedUi.test.ts",
  "tests/phase3Architecture.test.ts",     // module boundaries; no React/DOM/Canvas in the pure folders
  "tests/phase4bArtifacts.test.ts",       // src/render
  "tests/pixelFacts.test.ts",             // getImageData readers
  "tests/qa025PauseHolds.test.ts",        // who sets the speed
  "tests/renderSourceGuards.test.ts",     // render file sizes and patterns
  "tests/resourceCatalog.test.ts",        // no per-good table outside the catalog
  "tests/saveStorageRoute.test.ts",       // storage only through src/save
  "tests/surfacesRegistry.test.ts",       // framed UI candidates (scripts/checks/surfaceRegistry.mjs)
  "tests/touchTargets.test.ts",           // src/styles, src/ui
  "tests/uiArtSkin.test.ts",              // src/ui, src/ui/tutorial
  "tests/uiAuditMoney.test.ts",           // src/ui, src/render
  "tests/wheatFarmRetired.test.ts",       // src/render
];

// Tests that call readdir and name a src path but walk no src folder: the reason each is left out.
export const NOT_SOURCE_SCAN = {
  "tests/buildingCatalogExtensibility.test.ts": "copies the tree and type-checks it; check:merge type-checks every push",
  "tests/resourceCatalogExtensibility.test.ts": "copies the tree and type-checks it; check:merge type-checks every push",
  "tests/engineFrameBudget.test.ts": "walks fixtures/ (town saves); imports src",
  "tests/manorHouse.test.ts": "walks fixtures/saves; imports src",
  "tests/saveFixtures.test.ts": "walks fixtures/saves; imports src",
  "tests/sceneStateGuard.test.ts": "walks scripts/",
  "tests/suitLedger.test.ts": "walks $SUIT_LEDGER_STATES (DGX states); imports src",
  "tests/sourceScanTests.test.ts": "this list's own guard: walks tests/ (picked whenever a test file changes)",
};

/** The guard that keeps the list whole, picked by any changed test file (a new walker is a new test). */
export const SOURCE_SCAN_GUARD = "tests/sourceScanTests.test.ts";
