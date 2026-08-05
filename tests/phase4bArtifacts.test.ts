import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

describe("Phase 4B release artifacts", () => {
  it("commits exactly eight processed candidates for each of three subjects", () => {
    const candidateRoot = path.join(root, "public/assets/buildings/candidates_v2");
    const files = readdirSync(candidateRoot).filter((name) => name.endsWith(".png")).sort();
    assert.equal(files.length, 24);
    for (const subject of ["house", "mill", "granary"]) {
      assert.equal(files.filter((name) => name.startsWith(`${subject}_`)).length, 8);
    }
  });

  it("commits candidate, old-new, and live context evidence plus 24 profiles", () => {
    for (const name of ["building_candidates_v2.png", "building_old_new_v2.png", "building_in_context_v2.png"]) {
      assert.equal(existsSync(path.join(root, "docs/assets", name)), true, name);
    }
    const profile = JSON.parse(readFileSync(path.join(root, "docs/asset-evidence/buildingCandidateProfilesV2.json"), "utf8")) as { candidates: unknown[] };
    assert.equal(profile.candidates.length, 24);
  });

  it("keeps Phase 4B candidate evidence separate from Phase 4D runtime sprites", () => {
    const candidateRuntimeReferences: string[] = [];
    const renderFiles = readdirSync(path.join(root, "src/render"))
      .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"));

    for (const fileName of renderFiles) {
      const source = readFileSync(path.join(root, "src/render", fileName), "utf8");
      if (/candidates_v2|building_candidates_v2|building_old_new_v2|building_in_context_v2/.test(source)) {
        candidateRuntimeReferences.push(fileName);
      }
    }

    assert.deepEqual(candidateRuntimeReferences, []);
    assert.equal(existsSync(path.join(root, "public/assets/buildings/house_l0.png")), true);
    assert.equal(existsSync(path.join(root, "public/assets/buildings/mill.png")), true);
    assert.equal(existsSync(path.join(root, "public/assets/buildings/barn.png")), true);
  });
});
