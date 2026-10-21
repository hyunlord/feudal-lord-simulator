/**
 * STONE-1a (the user's ruling 2026-10-21, lord mode): a gate for a town its own wall cut in two. The state: seed 32
 * (lord slice) at the first tick of 1326 (DGX engine-STORE-save32-c0e0ac7) — the wall's gate (50,35) opens on the river,
 * its extra gate (37,32) has no road outside, and three storehouses and a masonry outside reach nothing inside.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { CUT_OFF_GATES_TOTAL_MAX, cutOffComponents, cutOffGateChoices, openCutOffGates, pastFirstCloseAfterClosing, recordWallClosed } from "../src/engine/cutOffGates";
import { migrateV56ToV57 } from "../src/save/migrations/v56ToV57";
import type { GameState } from "../src/engine/engine.types";
import { createSimulationRoutePorts } from "../src/engine/simulationPorts";
import { decodeSave } from "../src/save/saveCodec";

const town = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/store/seed32-1326.save.json.gz")))).envelope.state as GameState;
const OUTSIDE_STONE = ["construction-site-000050", "construction-site-000059", "construction-site-000070", "construction-site-000073"];
const wallSites = town.constructionSites.filter(site => site.kind === "stone_wall_segment");
const reaches = (state: GameState) => {
  const routes = createSimulationRoutePorts(state).delivery;
  return wallSites.every(site => OUTSIDE_STONE.every(id => routes.fromBuildingToDestination(id, { kind: "construction_site", siteId: site.id }) !== null));
};

test("STONE-1a: seed 32's town outside its wall is one cut-off road component; one gate at (35,40) joins it", () => {
  assert.equal(cutOffComponents(town).length, 1);
  assert.equal(reaches(town), false);
  assert.deepEqual(cutOffGateChoices(town, 2), [{ x: 35, y: 40 }]);
});

test("STONE-1a: at the season's close the gate opens, the outside stone reaches every wall site, and nothing is cut off", () => {
  assert.equal(town.tick % 1_000, 0);
  const opened = openCutOffGates(town);
  assert.deepEqual(opened.palisade?.additionalGates, [{ x: 37, y: 32 }, { x: 35, y: 40 }]);
  assert.equal(cutOffComponents(opened).length, 0);
  assert.equal(reaches(opened), true);
  assert.equal(openCutOffGates(opened), opened, "a joined town opens no more");
});

test("STONE-1a: no gate mid-season, in the sandbox, or past three extra gates", () => {
  const midSeason = { ...town, tick: town.tick + 1 };
  assert.equal(openCutOffGates(midSeason), midSeason);
  const { agency: _agency, ...sandbox } = town;
  assert.equal(openCutOffGates(sandbox as GameState), sandbox);
  const full = { ...town, palisade: { ...town.palisade!, additionalGates: [{ x: 37, y: 32 }, { x: 32, y: 36 }, { x: 33, y: 35 }].slice(0, CUT_OFF_GATES_TOTAL_MAX) } };
  assert.equal(openCutOffGates(full), full);
});

test("STONE-1a (v57): an older save's closed lord-mode wall reads as closed long ago; the sandbox and an open wall get no tick", () => {
  assert.equal(town.palisade?.closedTick, 0, "the v56 save migrated: closed long ago");
  const { closedTick: _closedTick, ...v56Wall } = town.palisade!;
  const v56 = { ...town, palisade: v56Wall };
  assert.equal((migrateV56ToV57({ schemaVersion: 56, state: v56 }) as { state: GameState }).state.palisade?.closedTick, 0);
  const { agency: _agency, ...sandbox } = v56;
  assert.equal((migrateV56ToV57({ schemaVersion: 56, state: sandbox }) as { state: GameState }).state.palisade?.closedTick, undefined);
  const open = { ...v56, palisade: { ...v56Wall, segments: v56Wall.segments.map((segment, index) => index === 0 ? { ...segment, completed: false } : segment) } };
  assert.equal((migrateV56ToV57({ schemaVersion: 56, state: open }) as { state: GameState }).state.palisade?.closedTick, undefined);
});

test("STONE-1a (v57): the wall's closing tick is noted in lord mode and cleared when a segment opens", () => {
  const { closedTick: _closedTick, ...wall } = town.palisade!;
  const unnoted = { ...town, palisade: wall };
  assert.equal(recordWallClosed(unnoted).palisade?.closedTick, town.tick);
  const opened = { ...town, palisade: { ...town.palisade!, segments: town.palisade!.segments.map((segment, index) => index === 0 ? { ...segment, completed: false } : segment) } };
  assert.equal(recordWallClosed(opened).palisade?.closedTick, undefined);
  assert.equal(recordWallClosed(town), town, "noted already: unchanged");
  const { agency: _agency, ...sandbox } = unnoted;
  assert.equal(recordWallClosed(sandbox as GameState), sandbox);
});

test("STONE-1a: no gate at the wall's first season close; from the second close on", () => {
  assert.equal(pastFirstCloseAfterClosing({ closedTick: 103_500 }, 104_000), false);
  assert.equal(pastFirstCloseAfterClosing({ closedTick: 103_500 }, 105_000), true);
  assert.equal(pastFirstCloseAfterClosing({ closedTick: 104_000 }, 104_000), false);
  assert.equal(pastFirstCloseAfterClosing({ closedTick: 104_000 }, 105_000), true);
  assert.equal(pastFirstCloseAfterClosing({}, 104_000), true);
  const justClosed = { ...town, palisade: { ...town.palisade!, closedTick: town.tick - 500 } };
  assert.equal(openCutOffGates(justClosed), justClosed);
  const closedASeasonAgo = { ...town, palisade: { ...town.palisade!, closedTick: town.tick - 1_500 } };
  assert.deepEqual(openCutOffGates(closedASeasonAgo).palisade?.additionalGates, [{ x: 37, y: 32 }, { x: 35, y: 40 }]);
});
