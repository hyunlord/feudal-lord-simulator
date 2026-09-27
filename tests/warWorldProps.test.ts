/**
 * UI-6 chapter 2's war in the world (src/render/warWorldProps.ts, spec docs/design/chapter-two-war.md WR-5): the beacon's
 * shore spot, its lit / idle picture, the raid's aftermath window (burning quay, smoke over the burnt houses), the wall
 * inspector's ring defence line, and the object queue carrying none of it without a war.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { CHAPTER_TWO } from "../src/content/chapterConfig";
import type { GameState } from "../src/engine/engine.types";
import { endChapterTwo, initialPolitics } from "../src/engine/politics";
import { advanceWar, beaconLit, raidEventId, raidSeasonOffset } from "../src/engine/war";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { objectRenderItemsForFrame } from "../src/render/renderObjectFrameCache";
import { ringDefenceLine, ringDefenceRow, wallInspectorModel } from "../src/render/wallInspectorModel";
import { beaconSpot, RAID_AFTERMATH_TICKS, raidAftermathVisible, raidBurntHouseIds, raidQuaySpot, warProps } from "../src/render/warWorldProps";
import { selectWorldAtTile } from "../src/render/worldSelection";
import { decodeSave } from "../src/save/saveCodec";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const M = 148_000;

/** The 24-house walled town (v19 fixture, a coastal campaign map) in chapter 2 at spring 1337, its ring closed (timber). */
function warTown(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v19/palisade-construction.save.json"))).envelope.state as GameState;
  const palisade = state.palisade === null ? null : { ...state.palisade, segments: state.palisade.segments.map(segment => ({ ...segment, completed: true, material: "timber" as const })) };
  const funded = postLedgerEntries({ ...state, tick: M }, [{ account: "cash", category: "opening_balance", amount: 5000 - treasuryBalance(state),
    sourceRefs: [{ type: "scenario", id: "war-world-props-test" }] }]);
  const politics = initialPolitics(state);
  return { ...state, tick: M, palisade, treasuryCoin: funded.treasuryCoin, ledger: funded.ledger,
    historicalEras: [...(state.historicalEras ?? []), { id: "war", enteredTick: M, forced: false }],
    politics: { ...politics, chapter: { number: CHAPTER_TWO.chapter, startTick: 80_000, populationStart: state.population, peakPopulation: state.population } } };
}
const season = (state: GameState, offset: number) => advanceWar({ ...state, tick: M + offset * SEASON }, endChapterTwo);
const tileAt = (state: GameState, tx: number, ty: number) => state.tiles[ty * state.width + tx];
const water = (state: GameState, tx: number, ty: number) => tileAt(state, tx, ty)?.terrain === "water";
const fullRange = (state: GameState) => ({ minTx: 0, minTy: 0, maxTx: state.width - 1, maxTy: state.height - 1 });

test("the beacon's spot: deterministic, on a free shore tile, and none without a war", () => {
  const before = warTown();
  assert.equal(before.war, undefined);
  assert.equal(beaconSpot(before), null);
  assert.deepEqual(warProps(before), []);
  const atWar = season(before, 0);
  assert.notEqual(atWar.war, undefined, "the messenger came");
  const started = performance.now();
  const spot = beaconSpot(atWar);
  const scanMs = performance.now() - started;
  assert.notEqual(spot, null);
  const { tx, ty } = spot!;
  const tile = tileAt(atWar, tx, ty)!;
  assert.equal(tile.terrain, "grass");
  assert.equal(tile.buildingId, null, "not on a building");
  assert.equal(tile.hasRoad, false, "not on a road");
  assert.ok(water(atWar, tx - 1, ty) || water(atWar, tx + 1, ty) || water(atWar, tx, ty - 1) || water(atWar, tx, ty + 1), "beside water");
  // Deterministic: a copy of the same state (new arrays, no cache) gives the same tile.
  const copy = structuredClone(atWar) as GameState;
  const cachedStart = performance.now();
  beaconSpot(atWar);
  const cachedMs = performance.now() - cachedStart;
  assert.deepEqual(beaconSpot(copy), spot);
  // A building on that tile moves the beacon to another free shore tile.
  const tiles = atWar.tiles.map(candidate => candidate.tx === tx && candidate.ty === ty ? { ...candidate, buildingId: "test-building" } : candidate);
  const moved = beaconSpot({ ...atWar, tiles });
  assert.notEqual(moved, null);
  assert.notDeepEqual(moved, spot);
  assert.equal(tiles[moved!.ty * atWar.width + moved!.tx]!.buildingId, null);
  process.stdout.write(`# shore scan ${scanMs.toFixed(2)} ms, cached ${cachedMs.toFixed(3)} ms (${atWar.width}x${atWar.height})\n`);
});

test("the beacon is lit the season before the raid and idle otherwise", () => {
  const town = season(warTown(), 0);
  const raidOffset = raidSeasonOffset(town);
  assert.deepEqual(warProps(town).map(prop => prop.kind), ["beacon_idle"]);
  const lit = { ...town, tick: M + (raidOffset - 1) * SEASON + 10 };
  assert.equal(beaconLit(lit), true);
  assert.deepEqual(warProps(lit).map(prop => prop.kind), ["beacon_lit"]);
  assert.deepEqual(warProps(lit).map(prop => [prop.tx, prop.ty]), warProps(town).map(prop => [prop.tx, prop.ty]), "the same spot, lit");
  const early = { ...town, tick: M + (raidOffset - 2) * SEASON + 10 };
  assert.deepEqual(warProps(early).map(prop => prop.kind), ["beacon_idle"]);
});

test("the raid's aftermath: quay and smoke from the raid's tick for two seasons, smoke only over houses still burnt", () => {
  const town = season(warTown(), 0);
  const raidOffset = raidSeasonOffset(town);
  const raided = season({ ...town, tick: M + raidOffset * SEASON - 1 }, raidOffset);
  const raid = raided.war?.raid;
  assert.notEqual(raid, undefined, "the raid came");
  assert.equal(raidAftermathVisible(raided), true);
  const burnt = raided.houses.filter(house => house.burntByEventId === raidEventId(raid!.tick)).map(house => house.buildingId);
  assert.ok(burnt.length > 0, "the raid burnt houses behind a timber ring");
  assert.deepEqual([...raidBurntHouseIds(raided)].sort(), [...burnt].sort());
  assert.deepEqual(warProps(raided).map(prop => prop.kind), ["beacon_idle", "quay", "raid_burning_quay", ...burnt.map(() => "raid_smoke_column_sheet")]);
  assert.deepEqual(warProps(raided).filter(prop => prop.kind === "raid_smoke_column_sheet").map(prop => prop.id).sort(), burnt.map(id => `war:smoke:${id}`).sort());
  // UI-6b: the Wave 12 quay lies under the fire, on its tile, sorted just before it.
  const [stone, fire] = ["quay", "raid_burning_quay"].map(kind => warProps(raided).find(prop => prop.kind === kind)!);
  assert.deepEqual([stone!.tx, stone!.ty, stone!.x, stone!.y], [fire!.tx, fire!.ty, fire!.x, fire!.y]);
  assert.ok(stone!.depth < fire!.depth && fire!.depth - stone!.depth < 0.001);
  const quay = raidQuaySpot(raided)!;
  const beacon = beaconSpot(raided)!;
  assert.ok(Math.max(Math.abs(quay.tx - beacon.tx), Math.abs(quay.ty - beacon.ty)) >= 3, "the quay stands apart from the beacon");
  assert.equal(tileAt(raided, quay.tx, quay.ty)!.buildingId, null);
  // Late in the window the fires still burn; at its end they are gone.
  const late = { ...raided, tick: raid!.tick + RAID_AFTERMATH_TICKS - 1 };
  assert.equal(raidAftermathVisible(late), true);
  assert.deepEqual(raidQuaySpot(late), quay, "the quay does not move within the window");
  const after = { ...raided, tick: raid!.tick + RAID_AFTERMATH_TICKS };
  assert.equal(raidAftermathVisible(after), false);
  assert.deepEqual(raidBurntHouseIds(after), []);
  assert.deepEqual(warProps(after).map(prop => prop.kind), ["beacon_idle"]);
  // A rebuilt house loses its smoke; a house burnt by an ordinary fire never had it.
  const [first, second] = burnt;
  const rebuilt = { ...raided, houses: raided.houses.map(house => house.buildingId === first ? { ...house, burntTick: undefined, burntByEventId: undefined }
    : house.buildingId === second ? { ...house, burntByEventId: "fire@1" } : house) } as GameState;
  assert.equal(raidBurntHouseIds(rebuilt).includes(first!), false);
  if (second !== undefined) assert.equal(raidBurntHouseIds(rebuilt).includes(second), false);
});

test("the object queue carries the war props only at war", () => {
  const peace = warTown();
  const input = (state: GameState) => ({ state, visibleTiles: state.tiles, range: fullRange(state), includeGroundCover: false });
  assert.equal(objectRenderItemsForFrame(input(peace)).some(item => item.kind === "war_prop"), false);
  const war = season(peace, 0);
  const items = objectRenderItemsForFrame(input(war)).filter(item => item.kind === "war_prop");
  assert.deepEqual(items.map(item => item.id), ["war:beacon"]);
  // After the raid each smoke column comes right after its house in the queue.
  const raidOffset = raidSeasonOffset(war);
  const raided = season({ ...war, tick: M + raidOffset * SEASON - 1 }, raidOffset);
  const queue = objectRenderItemsForFrame(input(raided));
  for (const id of raidBurntHouseIds(raided)) {
    const house = queue.findIndex(item => item.kind === "building" && item.id === id);
    const smoke = queue.findIndex(item => item.id === `war:smoke:${id}`);
    assert.ok(house >= 0 && smoke > house, `${id}: house ${house}, smoke ${smoke}`);
    assert.ok(queue.slice(house + 1, smoke).every(item => item.depth === queue[house]!.depth || item.depth === queue[smoke]!.depth),
      "only the house's own row (and its neighbours' smoke) comes between");
    assert.ok(queue[smoke]!.depth - queue[house]!.depth < 0.01);
  }
});

test("the wall inspector: the ring's defence, 0 while a gap remains", () => {
  const town = warTown();
  const segment = town.palisade!.segments[0]!;
  const closed = wallInspectorModel(town, segment.id)!;
  assert.equal(closed.name, "목책 구간");
  assert.ok(closed.rows.includes("성벽 방어 60% · 고리가 닫혔습니다"), closed.rows.join(" / "));
  assert.deepEqual(ringDefenceRow(town), { label: "성벽 방어", value: "60% · 고리 닫힘" });
  const stone = { ...town, palisade: { ...town.palisade!, segments: town.palisade!.segments.map(entry => ({ ...entry, material: "stone" as const })) } };
  assert.equal(ringDefenceLine(stone), "성벽 방어 100% · 고리가 닫혔습니다");
  assert.equal(wallInspectorModel(stone, segment.id)!.name, "석벽 구간");
  const gap = { ...town, palisade: { ...town.palisade!, segments: town.palisade!.segments.map((entry, index) => index === 1 ? { ...entry, completed: false } : entry) } };
  assert.equal(ringDefenceLine(gap), "성벽 방어 0% · 틈 1구간이 남아 고리가 열려 있습니다");
  assert.deepEqual(ringDefenceRow(gap), { label: "성벽 방어", value: "0% · 틈 1구간" });
  assert.equal(wallInspectorModel(town, "no-such-segment"), null);
  assert.equal(ringDefenceRow({ palisade: null }), null);
  // Selected on the map: a tile on a finished segment's line, with no building, opens the wall's card.
  const point = segment.edgePath.find(entry => tileAt(town, entry.x, entry.y)?.buildingId === null
    && !town.constructionSites.some(site => site.kind === "palisade_segment" && site.path.some(step => step.x === entry.x && step.y === entry.y)))!;
  const walkerFree = { ...town, walkers: [] };
  const selected = selectWorldAtTile(walkerFree, { tx: point.x, ty: point.y });
  assert.equal(selected?.kind, "wall_segment");
});
