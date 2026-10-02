import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import type { GameState } from "../src/engine/engine.types";
import { BUILDING_SPRITE_ALPHA } from "../src/render/buildingSpriteFit.generated";
import { beginBuildingVariantFrame, frameBuildingVariant } from "../src/render/buildingVariants";
import { STOREHOUSE_SNOW_IMAGES, storehouseSnowKey } from "../src/render/storehouseSnowArt";

// NAT-5 (RUN-02, decision N4-D3): the storehouse's roof snow follows the picture on screen and sits on its canvas.

const pngSize = (path: string): readonly [number, number] => {
  const bytes = readFileSync(path);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

test("Given the three snow layers When installed Then each is a whole storehouse canvas (160 x 136) in public/", () => {
  const canvas = BUILDING_SPRITE_ALPHA.storehouse;
  for (const meta of Object.values(STOREHOUSE_SNOW_IMAGES)) {
    assert.deepEqual(pngSize(`public/${meta.url}`), [canvas.width, canvas.height], meta.url);
    assert.deepEqual([meta.width, meta.height], [canvas.width, canvas.height]);
  }
});

test("Given storehouses showing each picture When the snow layer is chosen Then it matches the picture shown", () => {
  const opening = createGrowthOpening(1).state as GameState;
  const template = opening.buildings.find(building => building.kind === "storehouse");
  assert.ok(template !== undefined, "the opening has a storehouse to copy");
  const storehouses = Array.from({ length: 24 }, (_, index) => ({ ...template, id: `store-${index}`, tx: 4 + (index % 6) * 6, ty: 4 + Math.floor(index / 6) * 6 }));
  const state = { ...opening, buildings: storehouses };
  beginBuildingVariantFrame(state);
  const families = new Set<string>();
  for (const building of storehouses) {
    const family = frameBuildingVariant(building)?.family ?? "a";
    families.add(family);
    assert.equal(storehouseSnowKey(building, true), family === "b" || family === "c" ? family : "a", building.id);
    assert.equal(storehouseSnowKey(building, false), "a", "a variant still loading shows storehouse.png, so its snow is a's");
  }
  assert.ok(families.size >= 2, `the sample shows more than one picture (${[...families].join(", ")})`);
});

test("Given the inbox ledger When the layers are installed Then their rows say NAT-5", () => {
  const ledger = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8").split("\r\n");
  for (const variant of ["a", "b", "c"]) {
    const row = ledger.find(line => line.includes(`storehouse_${variant}_snow-v1.png`));
    assert.ok(row?.endsWith(",NAT-5"), `storehouse_${variant}_snow row`);
  }
});
