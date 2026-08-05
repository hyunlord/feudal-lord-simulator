import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

  it("keeps the procedural building renderer byte-identical and sprite-free", () => {
    const buildings = readFileSync(path.join(root, "src/render/drawBuildings.ts"));
    const renderer = readFileSync(path.join(root, "src/render/renderer.ts"));
    assert.equal(createHash("sha256").update(buildings).digest("hex"), "0a07e98420e6025cc696176b97d5045fabd9d4c1adc60a47e8020d67cf85caba");
    assert.equal(createHash("sha256").update(renderer).digest("hex"), "0a9ba537a2ef599539f90cb279f5071fcb8a7c655d39353dc22e405047a1baf3");
    assert.doesNotMatch(buildings.toString("utf8"), /drawImage|candidates_v2|\.png/);
    assert.doesNotMatch(renderer.toString("utf8"), /drawImage|candidates_v2|\.png/);
  });
});
