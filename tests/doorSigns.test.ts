/**
 * LM-R1 Wave 37 house-front signs (src/render/doorSigns.ts, manifest by scripts/installWave37DoorSigns.py): the 32
 * pictures and their feet, which sign a household shows (from the same inputs as the back yard, plus the LM-E6a trade),
 * lord mode only, where the sign stands (the road cell's verge before the house, beside the door path), NAT-1's rules
 * (about half show none, never three of one picture in a row along a road), the zoom rule and the cache.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TRADE_IDS } from "../src/content/trades";
import type { GameState } from "../src/engine/engine.types";
import { initialAgency } from "../src/engine/townAgency";
import { yardHash } from "../src/render/backyardDecals";
import { DOOR_SIGN_CONDITION_MIN_ZOOM, doorSignDrawnAt, doorSignKey, doorSignKind, doorSignPlan, doorSigns, SIGN_BY_TRADE, SIGN_BY_YARD_OCCUPATION,
  UNPICTURED_TRADES, type DoorSignHousehold } from "../src/render/doorSigns";
import { WAVE37_DOOR_SIGNS, type Wave37DoorSignKey } from "../src/render/wave37DoorSignManifest.generated";
import { decodeSave } from "../src/save/saveCodec";

const load = (name: string) => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v47/${name}.save.json`))).envelope.state as GameState;
const lord = (state: GameState): GameState => ({ ...state, agency: initialAgency() });
const TOWNS = ["population-176", "chapter-five-town", "chapter-four-town", "palisade-construction", "zoned-opening", "money-arrears"] as const;
const fed: DoorSignHousehold["house"] = { buildingId: "house-1", level: 2, residents: 4 };
const household = (fields: Partial<DoorSignHousehold> = {}): DoorSignHousehold => ({ house: fed, members: [], trade: null, tick: 50_000, movedInTick: null, ...fields });

test("Given the manifest When its 32 pictures are read Then every sign has an A and a B, each at Astra's foot, none mirrored", () => {
  const keys = Object.keys(WAVE37_DOOR_SIGNS) as Wave37DoorSignKey[];
  assert.equal(keys.length, 32);
  const signs = new Map<string, string[]>();
  for (const key of keys) signs.set(WAVE37_DOOR_SIGNS[key].sign, [...(signs.get(WAVE37_DOOR_SIGNS[key].sign) ?? []), WAVE37_DOOR_SIGNS[key].variant]);
  assert.equal(signs.size, 16, "12 trades and 4 circumstances");
  for (const [sign, variants] of signs) assert.deepEqual(variants.sort(), ["a", "b"], sign);
  // The rework-v2 feet (assets-inbox/wave37/rework-v2/records/assets.csv), the four reworked among them.
  assert.deepEqual(WAVE37_DOOR_SIGNS.trade_baker_a.pivot, { x: 57, y: 89 });
  assert.deepEqual(WAVE37_DOOR_SIGNS.trade_miller_a.pivot, { x: 100, y: 78 });
  assert.deepEqual(WAVE37_DOOR_SIGNS.condition_prosperous_bench.pivot, { x: 30, y: 87 });
  assert.deepEqual(WAVE37_DOOR_SIGNS.condition_newcomer_cart_b.pivot, { x: 104.78, y: 88.89 });
  for (const key of keys) {
    const meta = WAVE37_DOOR_SIGNS[key];
    assert.ok(meta.pivot.x > 0 && meta.pivot.x < meta.width && meta.pivot.y > meta.height * 0.8 && meta.pivot.y < meta.height, key);
  }
  const source = readFileSync("src/render/doorSigns.ts", "utf8");
  assert.equal(/mirror|scale\(-1|, true, true\)/.test(source.replace(/Never mirrored/g, "")), false, "no left-right flip");
});

test("Given the engine's twenty trades When the sign table is checked Then each is decided (a picture or none) and the pictured ones are Wave 37's", () => {
  for (const trade of TRADE_IDS) assert.ok((SIGN_BY_TRADE[trade] !== undefined) !== UNPICTURED_TRADES.includes(trade), `undecided trade ${trade}`);
  const drawn = new Set(Object.values(WAVE37_DOOR_SIGNS).map(meta => meta.sign));
  for (const sign of [...Object.values(SIGN_BY_TRADE), ...Object.values(SIGN_BY_YARD_OCCUPATION)]) assert.ok(drawn.has(sign!), sign);
});

test("Given households When their sign is read Then empty shows none, hunger strains, a newcomer's cart, the trade, then how it fares", () => {
  assert.equal(doorSignKind(household({ house: { ...fed, residents: 0 } })), null);
  assert.equal(doorSignKind(household({ house: { ...fed, abandonedTick: 10 } })), null);
  assert.equal(doorSignKind(household({ house: { ...fed, burntTick: 10 } })), null);
  assert.equal(doorSignKind(household({ house: { ...fed, foodShortSinceTick: 10 }, trade: "baker" })), "strained");
  assert.equal(doorSignKind(household({ house: { ...fed, leavingSinceTick: 10 } })), "strained");
  assert.equal(doorSignKind(household({ movedInTick: 49_500, trade: "smith" })), "newcomer");
  assert.equal(doorSignKind(household({ movedInTick: 40_000, trade: "smith" })), "smith", "a season on, the trade");
  const trades: Record<string, string> = { baker: "baker", brewer: "ale", miller: "miller", innkeeper: "inn", weaver: "weaver", smith: "smith",
    carpenter: "carpenter", merchant: "merchant", dyer: "dyer", tanner: "tanner" };
  for (const [trade, sign] of Object.entries(trades)) assert.equal(doorSignKind(household({ trade: trade as never })), sign, trade);
  // A trade Wave 37 did not draw: the craft or a member's trade, else how the house fares — never another trade's picture.
  assert.equal(doorSignKind(household({ trade: "tailor" })), "ordinary");
  assert.equal(doorSignKind(household({ trade: "tailor", members: [{ id: "p-1", role: "head", occupation: "chapman" }] })), "merchant");
  assert.equal(doorSignKind(household({ house: { ...fed, crafts: [{ craftId: "brew_ale", workers: 1, input: {}, output: {}, stock: {} }] } })), "ale");
  assert.equal(doorSignKind(household({ members: [{ id: "p-1", role: "head", occupation: "husbandman" }] })), "ordinary", "no farmer sign");
  assert.equal(doorSignKind(household({ house: { ...fed, level: 3 } })), "prosperous");
});

test("Given a sign When its picture is chosen Then A / B is fixed by the house, both show across a town, and winter's prosperous house keeps its bench", () => {
  const ids = Array.from({ length: 40 }, (_, at) => `house-${at}`);
  assert.deepEqual(new Set(ids.map(id => doorSignKey(id, "baker", false))), new Set(["trade_baker_a", "trade_baker_b"]));
  for (const id of ids) {
    assert.equal(doorSignKey(id, "smith", false), doorSignKey(id, "smith", false));
    assert.notEqual(doorSignKey(id, "smith", false, true), doorSignKey(id, "smith", false), "the other picture");
    assert.equal(doorSignKey(id, "prosperous", true), "condition_prosperous_bench");
  }
});

test("Given the sandbox and the campaign When the signs are read Then none show; in lord mode the same towns show them", () => {
  for (const name of TOWNS) assert.deepEqual(doorSigns(load(name)), [], name);
  assert.ok(TOWNS.some(name => doorSigns(lord(load(name))).length > 0));
  assert.deepEqual(doorSignPlan(load("chapter-four-town")), []);
});

test("Given lord-mode towns When the signs stand Then each is on its house's road cell verge, beside the door path, clear of buildings and water", () => {
  for (const name of TOWNS) {
    const state = lord(load(name));
    const byId = new Map(state.buildings.map(building => [building.id, building]));
    const corners = new Set<string>();
    for (const sign of doorSigns(state)) {
      const tile = state.tiles[sign.cell.ty * state.width + sign.cell.tx]!;
      assert.ok(tile.hasRoad && tile.buildingId === null && tile.terrain !== "water" && tile.terrain !== "rock", `${name} ${sign.id}`);
      // The foot: 0.4 back from the road cell's middle toward the house (0.1 past the footprint's edge), 0.3 to the side.
      const dx = sign.x - sign.cell.tx, dy = sign.y - sign.cell.ty;
      assert.deepEqual([Math.abs(dx), Math.abs(dy)].map(value => Math.round(value * 1000) / 1000).sort(), [0.3, 0.4], `${name} ${sign.id}`);
      const back = Math.abs(dy) > Math.abs(dx) ? { tx: sign.cell.tx, ty: sign.cell.ty + Math.sign(dy) } : { tx: sign.cell.tx + Math.sign(dx), ty: sign.cell.ty };
      assert.equal(state.tiles[back.ty * state.width + back.tx]!.buildingId, sign.buildingId, `${name} ${sign.id}: before its own house`);
      assert.ok(byId.has(sign.buildingId));
      const corner = `${Math.round(sign.x * 2)},${Math.round(sign.y * 2)}`;
      assert.ok(!corners.has(corner), `${name}: two signs on one corner`);
      corners.add(corner);
    }
  }
});

/** Along one road line (the road row or column the signs stand on, ordered along it), no picture three times running. */
function assertNoThreeRunning(signs: ReturnType<typeof doorSigns>, name: string): void {
  const lines = new Map<string, typeof signs[number][]>();
  for (const sign of signs) {
    const alongX = Math.abs(sign.y - sign.cell.ty) > Math.abs(sign.x - sign.cell.tx);
    const key = alongX ? `y${sign.cell.ty}:${Math.sign(sign.y - sign.cell.ty)}` : `x${sign.cell.tx}:${Math.sign(sign.x - sign.cell.tx)}`;
    lines.set(key, [...(lines.get(key) ?? []), sign]);
  }
  for (const line of lines.values()) {
    line.sort((a, b) => a.x - b.x || a.y - b.y);
    for (let at = 2; at < line.length; at += 1) assert.ok(!(line[at]!.key === line[at - 1]!.key && line[at]!.key === line[at - 2]!.key), `${name}: three ${line[at]!.key}`);
  }
}

test("Given lord-mode towns When NAT-1's rules are checked Then about half the houses show none and no road line shows one picture three times running", () => {
  let houses = 0, shown = 0;
  for (const name of TOWNS) {
    const state = lord(load(name));
    const signs = doorSigns(state);
    houses += state.buildings.filter(building => building.kind === "house").length;
    shown += signs.length;
    for (const sign of signs) assert.equal(yardHash(sign.buildingId, 37) % 2, 0, "only the houses the hash shows");
    assertNoThreeRunning(signs, name);
  }
  assert.ok(shown <= houses * 0.6 && shown >= houses * 0.2, `${shown} of ${houses}`);
});

test("Given a row of five bakers When their signs are chosen Then no picture stands three times running", () => {
  const state = lord(load("population-176"));
  const signs = doorSigns({ ...state, trades: { households: state.houses.map(house => ({ houseId: house.buildingId, tradeId: "baker" as const, sinceTick: 0,
    workshop: "front_shop" as const, receipt: { tick: 0, reasons: [], score: 0, chancePermille: 1000, of: 1 }, productivityPermille: 0, idleSeasons: 0 })),
    stock: {}, chains: {}, streets: [], haulage: { season: 0, last: 0 }, quits: [] } });
  assert.ok(signs.length >= 3 && signs.every(sign => sign.key.startsWith("trade_baker_")));
  assertNoThreeRunning(signs, "bakers");
});

test("Given the zoom When a sign draws Then none at block detail, the circumstance props from 0.8, the trade signs at every painted zoom", () => {
  assert.equal(DOOR_SIGN_CONDITION_MIN_ZOOM, 0.8);
  assert.equal(doorSignDrawnAt({ category: "trade" }, 0.6), true);
  assert.equal(doorSignDrawnAt({ category: "condition" }, 0.6), false);
  assert.equal(doorSignDrawnAt({ category: "condition" }, 1.0), true);
  assert.equal(doorSignDrawnAt({ category: "trade" }, 0.3), false);
});

test("Given a lord-mode town When the plan is asked twice Then the cache answers the same list, and a changed house list recomputes it", () => {
  const state = lord(load("palisade-construction"));
  const first = doorSignPlan(state);
  assert.equal(doorSignPlan({ ...state }), first);
  const emptied = { ...state, houses: state.houses.map(house => ({ ...house, residents: 0 })) };
  assert.deepEqual(doorSignPlan(emptied), []);
  assert.deepEqual(doorSignPlan(state).map(sign => sign.key), first.map(sign => sign.key), "deterministic");
});
