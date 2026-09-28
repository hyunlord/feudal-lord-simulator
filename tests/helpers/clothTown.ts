/**
 * C5: the town that came through chapters 1–3 (fixture `chapter-four-town`, the F3-A guardrail's seed 1 at 1368) and the
 * player's way of setting up the cloth chain in it — game commands only: a pasture painted, each building placed on
 * the nearest legal site (a road laid to it first where only the road is missing).
 */
import { readFileSync } from "node:fs";
import type { BuildingKind } from "../../src/content/buildingConfig";
import type { GameState } from "../../src/engine/engine.types";
import { decodeSave } from "../../src/save/saveCodec";
import { gameReducer } from "../../src/state/gameStore";
import { canPlaceBuilding } from "../../src/world/placement";
import type { TileCoordinate } from "../../src/world/grid";

export function clothTown(): GameState {
  return decodeSave(new Uint8Array(readFileSync("fixtures/saves/v26/chapter-four-town.save.json"))).envelope.state as GameState;
}

const distance = (a: TileCoordinate, b: TileCoordinate) => Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);

/** A 6×6 pasture stroke of open grass nearest `near` (the player's polygon). */
export function paintPasture(state: GameState, near: TileCoordinate): GameState {
  const zoned = new Set((state.zones ?? []).flatMap(zone => zone.membership));
  let best: { tx: number; ty: number } | null = null;
  for (let ty = 0; ty + 6 <= state.height; ty += 2) for (let tx = 0; tx + 6 <= state.width; tx += 2) {
    let open = 0;
    for (let dy = 0; dy < 6; dy += 1) for (let dx = 0; dx < 6; dx += 1) {
      const index = (ty + dy) * state.width + tx + dx;
      const tile = state.tiles[index]!;
      if (tile.terrain === "grass" && tile.buildingId === null && !tile.hasRoad && !zoned.has(index)) open += 1;
    }
    if (open >= 30 && (best === null || distance({ tx, ty }, near) < distance(best, near))) best = { tx, ty };
  }
  if (best === null) throw new Error("no open grass for a pasture");
  return gameReducer(state, { type: "zone_paint", kind: "pasture", stroke: { tool: "polygon", points: [{ x: best.tx, y: best.ty }, { x: best.tx + 6, y: best.ty },
    { x: best.tx + 6, y: best.ty + 6 }, { x: best.tx, y: best.ty + 6 }] } });
}

/** Places `kind` on the legal site nearest `near`; where only a road is missing, lays one from the nearest road first. */
export function placeNear(state: GameState, kind: BuildingKind, near: TileCoordinate): GameState {
  const ranked = [...state.tiles].sort((a, b) => distance(a, near) - distance(b, near) || a.ty - b.ty || a.tx - b.tx);
  const legal = ranked.find(tile => canPlaceBuilding(state, kind, tile.tx, tile.ty).ok);
  if (legal !== undefined) return gameReducer(state, { type: "place_building", kind, tx: legal.tx, ty: legal.ty });
  const roads = state.tiles.filter(tile => tile.hasRoad);
  for (const tile of ranked.filter(entry => (canPlaceBuilding(state, kind, entry.tx, entry.ty) as { reason?: string }).reason === "needs_road").slice(0, 40)) {
    const road = [...roads].sort((a, b) => distance(a, tile) - distance(b, tile))[0]!;
    for (let dy = -1; dy <= 2; dy += 1) for (let dx = -1; dx <= 3; dx += 1) {
      const laid = gameReducer(state, { type: "place_road_line", start: { tx: road.tx, ty: road.ty }, destination: { tx: tile.tx + dx, ty: tile.ty + dy } });
      if (laid !== state && canPlaceBuilding(laid, kind, tile.tx, tile.ty).ok) return gameReducer(laid, { type: "place_building", kind, tx: tile.tx, ty: tile.ty });
    }
  }
  throw new Error(`no site for ${kind}`);
}
