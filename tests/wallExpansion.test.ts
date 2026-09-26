import assert from "node:assert/strict";
import test from "node:test";

import { loadAutoplayFixture } from "../scripts/autoplayStallProbe";
import { autoplayActionToGameAction } from "../src/engine/autoplayActions";
import { runAutoplaySearch } from "../src/engine/autoplaySearchBudget";
import { autoplayWallExpansionAction } from "../src/engine/autoplayWallRoom";
import type { GameState } from "../src/engine/engine.types";
import { historySummary } from "../src/engine/history";
import { expandPalisade, previewPalisadeExpansion } from "../src/engine/palisade";
import { advancePalisadeExpansion, enclosedArableCells, palisadeExpansionWarning } from "../src/engine/palisadeExpansion";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import type { PalisadePath } from "../src/world/palisadeGeometry";
import { cellInsideWall, eraseZone, zonePaintAssessment } from "../src/zones/zoneEdits";

// WALL-2 palisade expansion (spec docs/design/wall-expansion.md WX-1…WX-6), work order W1–W6.
// The seed 3 town of the old small-wall stall (EV8): a built stone wall of 156 cells, 24 lots, fields by the wall.
const SEED3_WALLED = "fixtures/autoplay/seed3-792000.json.gz";
const SEASON = 1_000;

function walled(): { readonly state: GameState; readonly path: PalisadePath } {
  const state = loadAutoplayFixture(SEED3_WALLED);
  // Six more lots than the town holds: the bot widens the wall (AR-12).
  const action = runAutoplaySearch(() => autoplayWallExpansionAction(state, 30));
  assert.equal(action.kind, "proclaim_era");
  return { state, path: (action as { candidatePath: PalisadePath }).candidatePath };
}

test("W1 an expansion keeps the old segments on the new ring and builds only the new steps (its cost is the new length)", () => {
  const { state, path } = walled();
  const preview = previewPalisadeExpansion(state, path);
  assert.ok(preview.ok);
  const after = expandPalisade(state, path);
  assert.notEqual(after, state);
  const palisade = after.palisade!;
  assert.equal(palisade.id, state.palisade!.id);
  assert.deepEqual(palisade.polygon, preview.path);
  // Kept segments are unchanged (built, stone); new segments are timber sites.
  for (const id of preview.reusedSegmentIds) assert.deepEqual(palisade.segments.find(segment => segment.id === id), state.palisade!.segments.find(segment => segment.id === id));
  const fresh = palisade.segments.filter(segment => !preview.reusedSegmentIds.includes(segment.id));
  assert.ok(fresh.length > 0 && fresh.every(segment => !segment.completed && segment.constructionSiteId !== null));
  const sites = after.constructionSites.filter(site => fresh.some(segment => segment.constructionSiteId === site.id));
  assert.equal(sites.length, fresh.length);
  assert.equal(fresh.reduce((sum, segment) => sum + segment.tileCount, 0), preview.newSteps);
  assert.equal(sites.reduce((sum, site) => sum + (site.required.timber ?? 0), 0), preview.timber);
  assert.ok(preview.interiorAfter > preview.interiorBefore);
  for (let cell = 0; cell < state.tiles.length; cell += 1) if (cellInsideWall(state, cell)) assert.ok(cellInsideWall(after, cell), "the old inside stays inside");
  assert.equal(after.nextConstructionOrdinal, state.nextConstructionOrdinal + 1);
});

test("W2 an expansion is refused without a wall, when it gives up inside cells, when it adds none, or when it crosses water", () => {
  const { state, path } = walled();
  const hamlet: GameState = { ...state, palisade: null, era: "hamlet" };
  assert.deepEqual(previewPalisadeExpansion(hamlet, path), { ok: false, reason: "no_palisade" });
  assert.equal(expandPalisade(hamlet, path), hamlet);
  assert.deepEqual(previewPalisadeExpansion(state, state.palisade!.polygon), { ok: false, reason: "not_larger" });
  // The larger ring as the old wall, the old ring as the new one: it would give up cells.
  const larger = expandPalisade(state, path);
  const shrink = previewPalisadeExpansion({ ...larger, constructionSites: state.constructionSites }, state.palisade!.polygon);
  assert.equal(shrink.ok, false);
  // A ring through the lake to the north is not a wall.
  const wet: PalisadePath = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 30 }, { x: 0, y: 0 }];
  assert.equal(previewPalisadeExpansion(state, wet).ok, false);
  assert.equal(expandPalisade(state, wet), state);
});

test("W3 the gate stays on the ring, segments left inside come down with their sites, and timber delivered to them refunds as for a cancelled site", () => {
  const { state, path } = walled();
  const preview = previewPalisadeExpansion(state, path);
  assert.ok(preview.ok && preview.removedSegmentIds.length > 0);
  // Give one segment left inside an unfinished replacement site with timber delivered, to see it refunded.
  const removed = preview.removedSegmentIds[0]!;
  const siteId = `${removed}-test-site`;
  const pending: GameState = {
    ...state,
    palisade: { ...state.palisade!, segments: state.palisade!.segments.map(segment => segment.id === removed ? { ...segment, replacementConstructionSiteId: siteId } : segment) },
    constructionSites: [...state.constructionSites, { ...expandPalisade(state, path).constructionSites.at(-1)!, id: siteId, delivered: { timber: 12 } }],
  };
  const after = expandPalisade(pending, path);
  assert.deepEqual(after.palisade!.gate, state.palisade!.gate, "the gate is still on the new ring");
  assert.ok(preview.removedSegmentIds.every(id => !after.palisade!.segments.some(segment => segment.id === id)));
  assert.ok(!after.constructionSites.some(site => site.id === siteId));
  assert.equal(after.treasuryTimber, pending.treasuryTimber + Math.floor(12 * 0.6));
});

test("W4 fields the new wall takes in are warned, stay unpaintable inside, and a season later are pasture (or the player erases them first)", () => {
  const { state, path } = walled();
  const after = expandPalisade(state, path);
  const warning = palisadeExpansionWarning(after)!;
  assert.ok(warning.cells.length > 0);
  assert.equal(warning.convertsAtTick, after.tick + SEASON);
  const preview = previewPalisadeExpansion(state, path);
  assert.ok(preview.ok);
  assert.deepEqual(warning.cells, preview.enclosedArableCells);
  const cell = warning.cells[0]!;
  const stroke = { tool: "brush" as const, points: [{ x: cell % after.width + 0.5, y: Math.floor(cell / after.width) + 0.5 }], radius: 0.5 };
  assert.equal(zonePaintAssessment(after, "arable", stroke).ok, false, "no new field inside");
  // Not yet: the season has not passed.
  const early: GameState = { ...after, tick: after.tick + SEASON - 1 };
  assert.equal(advancePalisadeExpansion(early), early);
  const converted = advancePalisadeExpansion({ ...after, tick: after.tick + SEASON });
  assert.deepEqual(enclosedArableCells(converted), []);
  const pasture = new Set((converted.zones ?? []).filter(zone => zone.kind === "pasture").flatMap(zone => zone.membership));
  assert.ok(warning.cells.every(entry => pasture.has(entry)));
  assert.equal(converted.palisade!.expansion, undefined);
  // The player can erase them first: then nothing is left to warn about or convert.
  let erased = after;
  for (const entry of warning.cells) erased = eraseZone(erased, { tool: "brush", points: [{ x: entry % after.width + 0.5, y: Math.floor(entry / after.width) + 0.5 }], radius: 0.5 });
  assert.equal(palisadeExpansionWarning(erased), null);
});

test("W5 in the stone town a new timber segment is replaced in stone when it is built, like every timber segment there", () => {
  const { state, path } = walled();
  assert.equal(state.era, "stone_town");
  let after = expandPalisade(state, path);
  const fresh = after.palisade!.segments.find(segment => segment.constructionSiteId !== null && !segment.completed)!;
  // The site gets its timber and its builders' work; the next tick completes it.
  // (Stamped on the fixture's wall clock, which this old save keeps behind its tick.)
  after = { ...after, constructionSites: after.constructionSites.map(site => site.id === fresh.constructionSiteId
    ? { ...site, delivered: { ...site.required }, builderTicks: site.requiredBuilderTicks, startedTick: after.wallTick - 1_000 } : site) };
  let next = after;
  for (let tick = 0; tick < 3 && !next.palisade!.segments.find(segment => segment.id === fresh.id)!.completed; tick += 1) next = advanceTick(next);
  const built = next.palisade!.segments.find(segment => segment.id === fresh.id)!;
  assert.equal(built.completed, true);
  assert.equal(built.material, "timber");
  assert.ok(typeof built.replacementConstructionSiteId === "string", "a stone replacement is queued");
});

test("W6 the expansion is a big decision in the ledger (keep is the alternative), saves as v17, and the bot sends it as expand_palisade", () => {
  const { state, path } = walled();
  const command = autoplayActionToGameAction({ kind: "proclaim_era", candidatePath: path }, state);
  assert.deepEqual(command, { type: "expand_palisade", candidatePath: path });
  const after = gameReducer(state, command!);
  const record = after.history!.records.find(entry => entry.template === "decision.wall_expand")!;
  assert.equal(record.decision!.chosen, "expand");
  assert.deepEqual(record.decision!.alternatives, ["keep"]);
  assert.deepEqual(Object.keys(record.decision!.predicted).sort(), ["lots", "population"]);
  assert.equal(historySummary(record), "목책을 넓혀 새로 두르기로 했다");
  const loaded = decodeSave(encodeSave({ state: after, createdAt: "2026-09-27T00:00:00.000Z", savedAt: "2026-09-27T00:00:00.000Z" }).bytes);
  assert.equal(SAVE_SCHEMA_VERSION, 17);
  assert.equal(loaded.envelope.schemaVersion, 17);
  assert.equal((loaded.envelope.state as GameState).palisade!.expansion!.tick, after.tick);
  assert.deepEqual(loaded.envelope.state, after);
  // A town with room for its lots is not widened; a hamlet has no wall to widen.
  assert.equal(runAutoplaySearch(() => autoplayWallExpansionAction(state, 24)).kind, "none");
  assert.equal(runAutoplaySearch(() => autoplayWallExpansionAction(DEFAULT_GAME_STATE, 24)).kind, "none");
});
