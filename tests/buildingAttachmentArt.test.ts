import assert from 'node:assert/strict';
import test from 'node:test';
import { BALANCE } from '../src/content/balanceConfig';
import type { TradeId } from '../src/content/trades';
import type { GameState } from '../src/engine/engine.types';
import { stateCalendar } from '../src/engine/scenarioState';
import { initialAgency } from '../src/engine/townAgency';
import { buildingAttachmentAnchor, createBuildingAttachmentArt, type BuildingAttachmentInput } from '../src/render/art/buildingAttachmentArt';
import type { ContractHouseDraw } from '../src/render/art/contractHouseArt';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';

const home = DEFAULT_GAME_STATE.buildings.find(candidate => candidate.kind === 'house');
const resident = DEFAULT_GAME_STATE.houses.find(house => house.buildingId === home?.id);
assert.ok(home && resident);
const building = home;
const { abandonedTick: _abandoned, burntTick: _burnt, foodShortSinceTick: _hungry, leavingSinceTick: _leaving, ...occupied } = resident;
const house = { ...occupied, builtLevel: 2, level: 2, residents: 4 };
const originYear = stateCalendar({ ...DEFAULT_GAME_STATE, tick: 0 }).year;
const drawn: ContractHouseDraw = {
  at: { x: 100, y: 200 }, layers: [], layerAlpha: {},
  body: { bodyId: 'wave20/house_l2_1350_a-v2', sourceRect: { x: 10, y: 20, width: 100, height: 100 }, targetRect: { x: 100, y: 200, width: 50, height: 50 } },
};
function fixture(year = 1399, tradeId: TradeId = 'baker'): BuildingAttachmentInput {
  const state: GameState = { ...DEFAULT_GAME_STATE, tick: (year - originYear) * BALANCE.TICKS_PER_YEAR,
    agency: initialAgency(), buildings: [building], houses: [house], events: { records: [], burning: [] },
    trades: { households: [{ houseId: building.id, tradeId, workshop: 'front_shop', sinceTick: 0, productivityPermille: 1000, idleSeasons: 0,
      receipt: { tick: 0, reasons: [], score: 1, chancePermille: 1000, of: 1 } }], streets: [], stock: {}, chains: {}, haulage: { season: 0, last: 0 }, quits: [] },
  };
  return { state, building, drawn, zoom: 1 };
}
const art = createBuildingAttachmentArt(ART_REGISTRY, { createImage: null, baseUrl: '/' });

for (const [trade, picture] of [['baker', 'bread'], ['brewer', 'ale'], ['smith', 'smith'], ['weaver', 'textile']] as const) {
  test(`selects both era paintings for the actual ${trade} household without modifying it`, () => {
    // Given one authoritative trade record on the same registered house.
    for (const year of [1399, 1400, 1420]) {
      const input = fixture(year, trade); const before = JSON.stringify(input);
      // When selection follows the calendar boundary.
      const selected = art.select(input);
      // Then only the painting changes, not state or its draw receipt.
      assert.equal(selected?.id, `core:era-signs/sign_${picture}_${year < 1400 ? 1300 : 1420}`);
      assert.equal(JSON.stringify(input), before);
    }
  });
}

const omitted: readonly [string, (input: BuildingAttachmentInput) => BuildingAttachmentInput][] = [
  ['zoom 0.6', input => ({ ...input, zoom: 0.6 })],
  ['no body receipt', input => ({ ...input, drawn: null })],
  ['unregistered body', input => ({ ...input, drawn: { ...drawn, body: { ...drawn.body, bodyId: 'unregistered' } } })],
  ['empty home', input => ({ ...input, state: { ...input.state, houses: [{ ...house, residents: 0 }] } })],
  ['missing household', input => ({ ...input, state: { ...input.state, houses: [] } })],
  ['abandoned home', input => ({ ...input, state: { ...input.state, houses: [{ ...house, abandonedTick: 1 }] } })],
  ['burnt home', input => ({ ...input, state: { ...input.state, houses: [{ ...house, burntTick: 1 }] } })],
  ['hungry home', input => ({ ...input, state: { ...input.state, houses: [{ ...house, foodShortSinceTick: 1 }] } })],
  ['leaving home', input => ({ ...input, state: { ...input.state, houses: [{ ...house, leavingSinceTick: 1 }] } })],
  ['unpictured trade', () => fixture(1399, 'tailor')],
  ['no trade record', input => { const { trades: _trades, ...state } = input.state; return { ...input, state }; }],
  ['non-lord mode', input => { const { agency: _agency, ...state } = input.state; return { ...input, state }; }],
  ['paired lot', input => ({ ...input, building: { ...building, houseLot: 'horizontal' } })],
];
for (const [name, mutate] of omitted) test(`omits hanging signs for ${name}`, () => {
  // Given an otherwise eligible household with one disqualifying fact.
  const input = mutate(fixture());
  // When / Then attachment selection cannot invent a qualifying body or occupation.
  assert.equal(art.select(input), null);
});

for (const doused of [false, true]) test(`omits an active fire even when doused=${doused}`, () => {
  // Given doused means a shorter burn, not an already extinguished fire.
  const input = fixture();
  const state = { ...input.state, events: { records: [], burning: [{ buildingId: building.id, eventId: 'test-fire', ignitedTick: input.state.tick - 1, outTick: input.state.tick + 5, doused }] } };
  // When / Then any still-burning home suppresses hanging signs.
  assert.equal(art.select({ ...input, state }), null);
});

test('projects the authored mount through the actual cropped body receipt', () => {
  // Given a body crop, uniform scale and an authored wall point.
  // When / Then the pivot follows the painted wall rather than the tile verge.
  assert.deepEqual(buildingAttachmentAnchor(drawn, { x: 65, y: 92 }), { x: 127.5, y: 236 });
});

test('draws the decoded sign at its registered mount without changing the saved state', async () => {
  // Given a real catalog entry and a controlled browser image boundary.
  const source: HTMLImageElement = Object.create(null);
  Object.assign(source, { naturalWidth: 137, naturalHeight: 137, src: '', onload: null, onerror: null, decode: () => Promise.resolve() });
  const consumer = createBuildingAttachmentArt(ART_REGISTRY, { createImage: () => source, baseUrl: '/' });
  const input = fixture(); const before = JSON.stringify(input);
  const selected = consumer.select(input); assert.ok(selected);
  const mount = selected.mounts.find(item => item.bodyId === drawn.body.bodyId); assert.ok(mount);
  const contact = buildingAttachmentAnchor(drawn, mount.point);
  const calls: unknown[][] = [];
  const context = { imageSmoothingEnabled: false, save() {}, restore() {}, drawImage: (...args: unknown[]) => calls.push(args), getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
  assert.equal(consumer.draw(context, input), false); assert.deepEqual(calls, []);
  source.onload?.call(source, new Event('load')); await Promise.resolve();
  // When the original image has decoded.
  assert.equal(consumer.draw(context, input), true);
  // Then its original fixing point meets the registered wall contact with one uniform scale.
  assert.deepEqual(calls, [[source, 0, 0, 137, 137,
    contact.x - selected.geometry.pivot.x * selected.geometry.scale, contact.y - selected.geometry.pivot.y * selected.geometry.scale,
    137 * selected.geometry.scale, 137 * selected.geometry.scale]]);
  assert.equal(JSON.stringify(input), before);
});
