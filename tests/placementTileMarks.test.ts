import assert from "node:assert/strict";
import { test } from "node:test";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { placementPreview } from "../src/render/interactions";
import { drawOnboardingGuidanceOverlay } from "../src/render/onboardingGuidanceOverlay";
import { blockingReasons } from "../src/render/placementTileMarks";
import { placementChipModel } from "../src/ui/placementChip";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { getTile } from "../src/world/grid";

const state: GameState = DEFAULT_GAME_STATE;

/** A grass tile with nothing (no building, road or water) within `radius` tiles. */
function openGround(radius: number): { tx: number; ty: number } {
  for (const tile of state.tiles) {
    let clear = tile.terrain === "grass";
    for (let dy = -radius; clear && dy <= radius; dy += 1) for (let dx = -radius; clear && dx <= radius; dx += 1) {
      const near = getTile(state, { tx: tile.tx + dx, ty: tile.ty + dy });
      clear = near !== null && near.buildingId === null && !near.hasRoad && near.terrain !== "water";
    }
    if (clear) return { tx: tile.tx, ty: tile.ty };
  }
  throw new Error("no open ground");
}

test("UX-3 S-52: only the footprint and its one-tile ring are judged — open ground is fine, the ring is outline", () => {
  const origin = openGround(3);
  const preview = placementPreview(state, "well", origin, null);
  const marks = preview.marks ?? [];
  const { width, height } = BUILDING_CONFIG_BY_KIND.well;
  assert.equal(marks.filter(mark => !mark.ring).length, width * height);
  assert.equal(marks.filter(mark => mark.ring).length, (width + 2) * (height + 2) - width * height);
  assert.ok(marks.every(mark => mark.ok), "a well needs no road: open ground is fine everywhere");
  assert.deepEqual(blockingReasons(marks), []);
});

test("UX-3 S-52: a tile under a building is blocked with its own reason icon; water is named as water", () => {
  const building = state.buildings[0]!;
  const onBuilding = placementPreview(state, "well", building, null).marks ?? [];
  const blocked = onBuilding.find(mark => !mark.ring && !mark.ok);
  assert.ok(blocked !== undefined && blocked.reason === "building" && blocked.icon);
  assert.equal(blockingReasons(onBuilding)[0]?.reason, "building");
  const water = state.tiles.find(tile => tile.terrain === "water" && tile.buildingId === null && !tile.hasRoad)!;
  assert.equal(blockingReasons(placementPreview(state, "well", water, null).marks ?? [])[0]?.reason, "water");
});

test("UX-3 S-52: a whole-building failure (no road beside a house) marks the footprint once and hatches the ring", () => {
  const origin = openGround(3);
  const marks = placementPreview(state, "house", origin, null).marks ?? [];
  const footprint = marks.filter(mark => !mark.ring);
  assert.ok(footprint.every(mark => !mark.ok && mark.reason === "needs_road"));
  assert.equal(footprint.filter(mark => mark.icon).length, 1, "the icon is drawn once, on the centre tile");
  assert.ok(marks.filter(mark => mark.ring).every(mark => !mark.ok));
});

test("UX-3 S-53/S-55: the chip is the building and its cost, the ledger line, and the one main reason", () => {
  const origin = openGround(3);
  const preview = placementPreview(state, "well", origin, null);
  const chip = placementChipModel(state, { tool: "well", marks: preview.marks ?? [], reachHouses: 3 });
  assert.equal(chip.title, "우물 · 목재 10");
  assert.match(chip.ledger[0]!.text, /^목재 10 \/ 보유 \d+ · 배치 후 \d+$/);
  assert.equal(chip.reason, null);
  assert.equal(chip.reach, "집 3채 도달");
  const onBuilding = placementChipModel(state, { tool: "well", marks: placementPreview(state, "well", state.buildings[0]!, null).marks ?? [], reachHouses: null });
  assert.match(onBuilding.reason ?? "", /^건물·공사장 1칸/);
  const free = placementChipModel(state, { tool: "house", reachHouses: null });
  assert.equal(free.title, "오두막 · 무료");
  assert.deepEqual(free.ledger, []);
});

test("UX-3 S-22: before a tool is picked the tutorial target draws no hint diamonds (its label only)", () => {
  const calls: string[] = [];
  const context = new Proxy({ canvas: { clientWidth: 1000, clientHeight: 800, width: 1000, height: 800 } } as Record<string | symbol, unknown>, {
    get: (target, key) => key in target ? target[key] : key === "measureText" ? () => ({ width: 40 })
      : (...args: unknown[]) => { calls.push(String(key)); void args; },
    set: (target, key, value) => { target[key] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  const target = { kind: "well" as const, label: "우물", origin: { tx: 10, ty: 10 }, region: [{ tx: 10, ty: 10 }, { tx: 11, ty: 10 }] };
  drawOnboardingGuidanceOverlay(context, { targets: [target], zoom: 1, tiles: false });
  assert.equal(calls.filter(call => call === "closePath").length, 0);
  assert.ok(calls.includes("fillText"), "the label still shows");
  calls.length = 0;
  drawOnboardingGuidanceOverlay(context, { targets: [target], zoom: 1, tiles: true });
  assert.ok(calls.filter(call => call === "closePath").length >= 2);
});

test("UX-3 S-52: when one tile collides, only that tile is blocked — the rest of the footprint reads fine", () => {
  const origin = openGround(4);
  const blocker = { tx: origin.tx + 1, ty: origin.ty + 1 };
  const blocked: GameState = { ...state, tiles: state.tiles.map(tile => tile.tx === blocker.tx && tile.ty === blocker.ty ? { ...tile, buildingId: "blocker" } : tile) };
  const footprint = (placementPreview(blocked, "storehouse", origin, null).marks ?? []).filter(mark => !mark.ring);
  assert.equal(footprint.length, 4);
  assert.deepEqual(footprint.filter(mark => !mark.ok).map(mark => [mark.tx - origin.tx, mark.ty - origin.ty, mark.reason]), [[1, 1, "building"]]);
});
