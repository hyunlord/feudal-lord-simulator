/**
 * F0-C2 map thumbnails (spec docs/design/history-ledger.md HL-5): a pure rasterizer over the saved state. Each tile
 * becomes a square of `size / width` pixels holding one palette index; the pixels are run-length encoded (value,
 * run ≤ 255 pairs) and base64-encoded, so a season's 128×128 picture costs a few hundred bytes to a few kilobytes.
 * No DOM, no canvas: the render session paints the palette.
 */
import { buildingFootprint } from "../geometry/buildingFootprint";
import { constructionSiteFootprint } from "../economy/construction";
import type { GameState } from "./engine.types";
import type { HistorySnapshot } from "./history.types";
import { zonesOf } from "../zones/zoneEdits";

/** HL-5 palette (index → what the pixel shows). The render session maps these to colours. */
export const SNAPSHOT_PALETTE = [
  "grass", "forest", "water", "rock", "road", "house", "building", "construction",
  "zone_burgage", "zone_arable", "burnt", "wall", "abandoned",
] as const;
export type SnapshotCell = (typeof SNAPSHOT_PALETTE)[number];
const INDEX: Readonly<Record<SnapshotCell, number>> = Object.fromEntries(SNAPSHOT_PALETTE.map((cell, index) => [cell, index])) as Record<SnapshotCell, number>;

/** One palette index per tile, row by row. */
export function tileClasses(state: GameState): Uint8Array {
  const cells = new Uint8Array(state.width * state.height);
  for (const tile of state.tiles) {
    const index = tile.ty * state.width + tile.tx;
    cells[index] = tile.hasRoad ? INDEX.road : INDEX[tile.terrain];
  }
  for (const zone of zonesOf(state)) {
    const value = zone.kind === "arable" ? INDEX.zone_arable : INDEX.zone_burgage;
    for (const index of zone.membership) if (cells[index] === INDEX.grass) cells[index] = value;
  }
  const paint = (tx: number, ty: number, width: number, height: number, value: number) => {
    for (let y = ty; y < ty + height; y += 1) for (let x = tx; x < tx + width; x += 1) {
      if (x >= 0 && y >= 0 && x < state.width && y < state.height) cells[y * state.width + x] = value;
    }
  };
  for (const site of state.constructionSites) {
    const footprint = constructionSiteFootprint(site);
    if (footprint !== null) paint(footprint.tx, footprint.ty, footprint.width, footprint.height, INDEX.construction);
  }
  const houses = new Map(state.houses.map(house => [house.buildingId, house]));
  for (const building of state.buildings) {
    const house = houses.get(building.id);
    const value = house?.burntTick !== undefined ? INDEX.burnt : house?.abandonedTick !== undefined ? INDEX.abandoned
      : building.kind === "house" ? INDEX.house : INDEX.building;
    const { width, height } = buildingFootprint(building);
    paint(building.tx, building.ty, width, height, value);
  }
  for (const segment of state.palisade?.segments ?? []) {
    if (!segment.completed) continue;
    for (const point of segment.edgePath) {
      const x = Math.min(state.width - 1, Math.max(0, Math.floor(point.x)));
      const y = Math.min(state.height - 1, Math.max(0, Math.floor(point.y)));
      cells[y * state.width + x] = INDEX.wall;
    }
  }
  return cells;
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function toBase64(bytes: readonly number[]): string {
  let out = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index]!;
    const b = bytes[index + 1] ?? 0;
    const c = bytes[index + 2] ?? 0;
    const chunk = (a << 16) | (b << 8) | c;
    out += BASE64[(chunk >> 18) & 63]! + BASE64[(chunk >> 12) & 63]!
      + (index + 1 < bytes.length ? BASE64[(chunk >> 6) & 63]! : "=") + (index + 2 < bytes.length ? BASE64[chunk & 63]! : "=");
  }
  return out;
}

function fromBase64(text: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 4) {
    const values = [0, 1, 2, 3].map(offset => { const char = text[index + offset] ?? "="; return char === "=" ? 0 : BASE64.indexOf(char); });
    const chunk = (values[0]! << 18) | (values[1]! << 12) | (values[2]! << 6) | values[3]!;
    bytes.push((chunk >> 16) & 255);
    if (text[index + 2] !== "=") bytes.push((chunk >> 8) & 255);
    if (text[index + 3] !== "=") bytes.push(chunk & 255);
  }
  return bytes;
}

/** HL-5: the state as a `size`×`size` picture (each tile scaled up), run-length encoded and base64. */
export function rasterizeSnapshot(state: GameState, id: string, size: 128 | 256): HistorySnapshot {
  const cells = tileClasses(state);
  const scaleX = size / state.width;
  const scaleY = size / state.height;
  const runs: number[] = [];
  let current = -1;
  let run = 0;
  for (let y = 0; y < size; y += 1) {
    const row = Math.min(state.height - 1, Math.floor(y / scaleY)) * state.width;
    for (let x = 0; x < size; x += 1) {
      const value = cells[row + Math.min(state.width - 1, Math.floor(x / scaleX))]!;
      if (value === current && run < 255) { run += 1; continue; }
      if (run > 0) runs.push(current, run);
      current = value;
      run = 1;
    }
  }
  if (run > 0) runs.push(current, run);
  return { id, tick: state.tick, size, data: toBase64(runs) };
}

/** HL-7 `history.snapshot`: the picture's palette indices, row by row (`size`² values). */
export function decodeSnapshot(snapshot: HistorySnapshot): Uint8Array {
  const pixels = new Uint8Array(snapshot.size * snapshot.size);
  const runs = fromBase64(snapshot.data);
  let offset = 0;
  for (let index = 0; index + 1 < runs.length; index += 2) {
    pixels.fill(runs[index]!, offset, offset + runs[index + 1]!);
    offset += runs[index + 1]!;
  }
  return pixels;
}
