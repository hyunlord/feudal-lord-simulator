// The tests that read a folder by walking it, not by importing a file (decisions RR24, RR25). The import graph of
// test:changed never reaches what they walk, so a change under any of a test's folders picks it: an engine comment
// matching phase3Architecture's DOM pattern (5ce62b92, EB-LME9c-2) and drawBuildings.ts over renderSourceGuards' size
// limit (f749fecc) both reached the trunk unpicked, and RR25's second review reused saveFixtures.test over a changed save
// fixture (it then failed). A folder ends in "/"; a single file is named as it is.
// tests/sourceScanTests.test.ts keeps the map whole: a test that walks or copies folders (readdir, opendir, globSync,
// cpSync) is here, and every folder named exists.
// A test that reads files by a path it builds (a list, a template, a module's own path list) is here too, with what it
// reads (RR22 review 2026-10-21): engineBTlinkOutcomeEvidence's pin check reads the INERT review list's files, so a
// change to one of them did not pick it and the trunk stayed broken from CLOTH-1 (59b42df3) to b9bd1f4b. The others came
// from one sweep of the traced reads (infra-SUIT2-tests-5951427) against this pick; reads that only hash files into a
// provenance record (the growth harness, the outcome tools' own hashes) are left out.
import { INERT_REVIEWED_EFFECT_SOURCES } from "../engineBInertReviewedSources.mjs";
const SRC = ["src/"];
const ART_MANIFESTS = ["src/render/", "src/ui/"];   // scripts/provenanceLedgerAssets.ts reads its list of manifest files
export const FOLDER_WALKS = {
  "tests/buildingCatalog.test.ts": SRC,                                   // no per-building table outside the catalog
  "tests/buildingCatalogExtensibility.test.ts": ["src/", "scripts/", "tests/", "tsconfig.json", "vite.config.ts"],   // copies them, runs tsc
  "tests/buildMenuContracts.test.ts": ["src/styles/"],                  // the stylesheets main.tsx imports, by name
  "tests/economyHarness.test.ts": ["src/engine/"],
  "tests/engineBInertCapture.test.ts": [],                              // its readdir lists the capture folder of the temporary root it makes
  "tests/engineFrameBudget.test.ts": ["fixtures/saves/v32/"],
  "tests/eventArtAuto.test.ts": ["assets-inbox/event-art/", "scripts/checks/distBudget.config.json"],   // eventArtIntake lists the folder with readdir; distBudget.mjs loads its config
  "tests/eventArtGeneration.test.ts": ["assets-inbox/event-art/"],       // scripts/eventArtIntake.ts lists it with readdir when imported
  "tests/eventArtCard.test.ts": [...ART_MANIFESTS, "scripts/checks/distBudget.config.json"],   // the runtime asset list and the budget config
  "tests/engineBTlinkOutcomeEvidence.test.ts": INERT_REVIEWED_EFFECT_SOURCES.map(pin => pin.path),   // its pin check hashes each reviewed file
  "tests/frameTokens.test.ts": ["src/styles/", "src/ui/", "src/render/", "src/App.tsx"],
  "tests/gitPaths.test.ts": ["scripts/"],                                // gitPathCalls.mjs scriptFiles lists scripts/ with git ls-files (RR27)
  "tests/hoverOnlyInfo.test.ts": ["src/ui/", "src/render/", "src/App.tsx"],
  "tests/inputIntentBoundary.test.ts": ["src/render/", "src/ui/", "src/App.tsx"],   // scripts/inputIntentBoundary.ts walks them with readdir
  "tests/inventedNames.test.ts": SRC,
  "tests/legacyArtRetired.test.ts": ART_MANIFESTS,
  "tests/ledger.test.ts": [...SRC, "scripts/economyHarnessAutoplay.ts", "scripts/economyHarnessSerializer.ts", "scripts/verifySaveDeterminism.ts"],   // ledgerBalanceTrace imports these by a built path
  "tests/lmr2Ledger.test.ts": SRC,                                        // who imports src/ui/lord/ledger
  "tests/lmr2LordPortraits.test.ts": ["src/ui/lord/"],
  "tests/lmr2LordScreen.test.ts": ["src/styles/", "src/ui/lord/"],
  "tests/lmr2Negotiation.test.ts": ["src/ui/lord/negotiation/"],
  "tests/manorHouse.test.ts": ["fixtures/saves/v49/"],
  "tests/palette.test.ts": SRC,
  "tests/phase11PublishedUi.test.ts": SRC,
  "tests/phase3Architecture.test.ts": SRC,                                // module boundaries; no React/DOM/Canvas in the pure folders
  "tests/phase4bArtifacts.test.ts": ["docs/asset-evidence/legacy-candidates/candidates_v2/", "src/render/"],
  "tests/pixelFacts.test.ts": SRC,                                        // getImageData readers
  "tests/qa025PauseHolds.test.ts": SRC,                                   // who sets the speed
  "tests/renderSourceGuards.test.ts": SRC,                                // render file sizes and patterns
  "tests/resourceCatalog.test.ts": ["src/", "scripts/", "tests/"],        // no per-good table outside the catalog
  "tests/resourceCatalogExtensibility.test.ts": ["src/", "scripts/", "tests/", "tsconfig.json", "vite.config.ts"],   // copies them, runs tsc
  "tests/saveFixtures.test.ts": ["fixtures/saves/"],
  "tests/saveSchemaFingerprint.test.ts": ["src/save/"],                 // schemaFingerprint.v<version>.json by the version
  "tests/saveStorageRoute.test.ts": SRC,                                  // storage only through src/save
  "tests/sceneStateGuard.test.ts": ["scripts/"],
  "tests/sourceScanTests.test.ts": ["tests/"],                            // this map's own guard: a new walker is a new test
  "tests/suitLedger.test.ts": [],                                       // walks $SUIT_LEDGER_STATES (DGX states, outside the repository) only
  "tests/surfacesRegistry.test.ts": SRC,                                  // framed UI candidates (scripts/checks/surfaceRegistry.mjs)
  "tests/testedReuse.test.ts": [],                                      // its readdir calls are in the throwaway repositories it builds
  "tests/touchTargets.test.ts": ["src/styles/", "src/ui/", "src/render/", "src/App.tsx"],
  "tests/uiArtSkin.test.ts": ["src/ui/", "src/styles/", "public/"],       // and that the pictures its CSS names exist
  "tests/uiAuditMoney.test.ts": ["src/ui/", "src/render/"],
  "tests/uiGeometryShadow.test.ts": [],                                // its readdir lists the shadow records of the throwaway repository it builds
  "tests/verifyProvenance.test.ts": ["public/", ...ART_MANIFESTS],      // scripts/provenanceLedgerFs.ts listAllPublicFiles walks public/ with readdir
  "tests/wheatFarmRetired.test.ts": ["public/assets/", ...ART_MANIFESTS, "fixtures/saves/"],
};

/** The tests that walk src/ (RR24's list): every test with a folder under src/. */
export const SOURCE_SCAN_TESTS = Object.keys(FOLDER_WALKS).filter(test => FOLDER_WALKS[test].some(folder => folder.startsWith("src/")));

/** Whether `file` is under one of `folders` (a folder ends in "/"; a single file matches itself). */
export const underFolders = (file, folders) => folders.some(folder => folder.endsWith("/") ? file.startsWith(folder) : file === folder);

/** The guard that keeps the map whole, picked by any changed test file (a new walker is a new test). */
export const SOURCE_SCAN_GUARD = "tests/sourceScanTests.test.ts";
