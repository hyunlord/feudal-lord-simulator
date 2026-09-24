// Adds fixtures/saves/v9/zone-undo.save.json: the zoned opening (scripts/buildZoneFixtures.ts) with one more
// burgage stroke merged into its plot zone and a pasture stroke, so the undo stack (spec Z-17) holds records with
// earlier zone versions, an added zone and a merge. Built through the reducer, not a growth run.
// Usage: tsx scripts/buildZoneUndoFixtures.ts (after buildSaveFixtures --from-version 8)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { GameState } from "../src/engine/engine.types";
import { encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";
import { zonedOpeningState } from "./buildZoneFixtures";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

export function zoneUndoState(): GameState {
  let state = zonedOpeningState();
  state = gameReducer(state, { type: "zone_paint", kind: "burgage", stroke: { tool: "brush", radius: 1.5, points: [{ x: 45, y: 44 }, { x: 45, y: 49 }] } });
  state = gameReducer(state, { type: "zone_paint", kind: "pasture", stroke: { tool: "polygon", points: [{ x: 50, y: 46 }, { x: 55, y: 46 }, { x: 55, y: 50 }, { x: 50, y: 50 }] } });
  return state;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const state = zoneUndoState();
  const fixed = "2026-09-25T00:00:00.000Z";
  const encoded = encodeSave({ state, createdAt: fixed, savedAt: fixed, gameVersion: "0.1.0+fixture" });
  const directory = resolve(ROOT, `fixtures/saves/v${SAVE_SCHEMA_VERSION}`);
  writeFileSync(resolve(directory, "zone-undo.save.json"), encoded.bytes);
  const manifestPath = resolve(directory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { fixtures: Record<string, unknown>[] };
  manifest.fixtures = manifest.fixtures.filter(entry => entry.id !== "zone-undo");
  manifest.fixtures.push({ id: "zone-undo", description: "zoned opening plus a merged burgage stroke and a pasture stroke: an undo stack of paint records",
    provenance: "Built through the reducer by scripts/buildZoneUndoFixtures.ts. Not a growth run.",
    file: "zone-undo.save.json", bytes: encoded.bytes.byteLength, tick: state.tick, zones: state.zones?.length ?? 0, undoRecords: state.zoneUndo?.length ?? 0 });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ zones: state.zones?.map(zone => [zone.id, zone.kind, zone.membership.length]), undo: state.zoneUndo?.map(record => [record.order.length, record.previous.length, record.nextZoneOrdinal]) })}\n`);
}
