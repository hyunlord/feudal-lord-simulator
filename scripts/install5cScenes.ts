// INSTALL-5c capture scenes: the seed 5 final state (its NW-SE stone gate at (40, 0) is one of the fixtures' two
// straight-run gates), written for scripts/install5cEvidence.mjs.
//   tsx scripts/install5cScenes.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { seedGroundState } from "./boundaryFixtureStates";

mkdirSync("docs/verification/install5c/scene", { recursive: true });
writeFileSync("docs/verification/install5c/scene/seed5.json.gz", gzipSync(JSON.stringify(seedGroundState(5))));
