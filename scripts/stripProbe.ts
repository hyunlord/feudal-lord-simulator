/**
 * STRIP (the user's ruling 2026-10-23): the arable zone's cells the harvest does not count — diagnosis only, read from a
 * save. Splits every arable cell into: in a strip a farmstead tends (by its tending status), or in no strip because it is
 * not cultivable (`cultivableArableCell`: a road, a building or construction site by kind, or the terrain), inside or
 * outside the wall.
 * Usage: npx tsx scripts/stripProbe.ts <save.json[.gz]>...
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { arableLayouts, stripTending } from "../src/zones/arableFields";
import { cellInsideWall, zonesOf } from "../src/zones/zoneEdits";

for (const path of process.argv.slice(2)) {
  const raw = readFileSync(path);
  const state = decodeSave(new Uint8Array(path.endsWith(".gz") ? gunzipSync(raw) : raw)).envelope.state as GameState;
  const layouts = arableLayouts(state);
  const tending = stripTending(state, layouts);
  const stripOf = new Map<number, string>();
  for (const strip of layouts.flatMap(layout => layout.strips)) for (const cell of strip.cells) stripOf.set(cell.ty * state.width + cell.tx, strip.id);
  const kindOf = new Map<string, string>([...state.buildings.map(building => [building.id, building.kind] as const),
    ...state.constructionSites.map(site => [site.id, `site:${"kind" in site ? site.kind : "?"}`] as const)]);
  const tally: Record<string, number> = {};
  const arable = zonesOf(state).filter(zone => zone.kind === "arable").flatMap(zone => zone.membership);
  for (const index of arable) {
    const where = cellInsideWall(state, index) ? "inside" : "outside";
    const strip = stripOf.get(index);
    const tile = state.tiles[index]!;
    const key = strip !== undefined ? `strip:${tending.get(strip)?.status ?? "?"}`
      : tile.hasRoad ? "road" : tile.buildingId !== null ? `building:${kindOf.get(tile.buildingId) ?? "?"}` : `terrain:${tile.terrain}`;
    tally[`${where} ${key}`] = (tally[`${where} ${key}`] ?? 0) + 1;
  }
  console.log(JSON.stringify({ save: path.split("/").pop(), tick: state.tick, arable: arable.length, tally }));
}
