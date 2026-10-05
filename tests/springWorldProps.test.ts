import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { decodeSave } from '../src/save/saveCodec';
import type { GameState } from '../src/engine/engine.types';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { isSpringWorldEntry } from '../src/render/art/springWorldValidation';
import { springWorldProps, springPropSupport, type SpringPropSelector } from '../src/render/springWorldProps';
import { weatherAt, weatherActive } from '../src/engine/eventSchedule';
import { backyardLayout, backyardPlan } from '../src/render/backyardDecals';
import { yardDecalRect } from '../src/render/drawBackyardDecals';
import { boxesOverlap } from '../src/render/tradeWorldPlacement';
import { tileToScreen, depthKey } from '../src/render/iso';
import { sortRenderItems } from '../src/render/objectRenderSort';
import { calendarProgress } from '../src/render/calendarProgress';
const choose: SpringPropSelector = role => ART_REGISTRY.entries('ground-prop').filter(isSpringWorldEntry).find(entry => entry.role === role) ?? null;
function state(): GameState {
  const saved = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v47/chapter-four-town.save.json'))).envelope.state as GameState;
  return { ...saved, tick: 0, width: 24, height: 24, buildings: [], houses: [], walkers: [], zones: [], constructionSites: [], forestHarvests: [], palisade: null,
    tiles: Array.from({ length: 576 }, (_, at) => ({ tx: at % 24, ty: Math.floor(at / 24), terrain: 'grass', buildingId: null, hasRoad: false })) };
}
test('Given no source contexts or unready art When planning Then no spring props are invented', () => {
  assert.deepEqual(springWorldProps(state(), choose), []);
  assert.deepEqual(springWorldProps(state(), () => null), []);
});
test('Given forest edge When spring planning Then nest is stable and other seasons hide it without state mutation', () => {
  const base = state(); const forest = { ...base, tiles: base.tiles.map(tile => tile.tx === 12 ? { ...tile, terrain: 'forest' as const } : tile) };
  const before = JSON.stringify(forest); const props = springWorldProps(forest, choose);
  assert.ok(props.some(prop => prop.role === 'nest'));
  assert.deepEqual(springWorldProps(forest, choose), props); assert.equal(JSON.stringify(forest), before);
  for (const tick of [1000, 2000, 3000]) assert.deepEqual(springWorldProps({ ...forest, tick }, choose), []);
});
test('Given a standalone bank When computing source support Then full 128 world pixel width is reserved', () => {
  const entry = choose('swollen-bank', 0); assert.ok(entry);
  const support = springPropSupport(entry, { tx: 12, ty: 12 });
  assert.ok(support.length > 8); assert.ok(new Set(support.map(cell => cell.tx)).size >= 4);
});
test('Given actual wet spring and water edge When planning bank Then roads buildings and dry weather prevent unsupported placement', () => {
  let wet = state();
  for (let seed = 1; seed < 1000; seed++) { const candidate = { ...wet, seed }; if (weatherActive(candidate) && weatherAt(candidate).kind === 'wet') { wet = candidate; break; } }
  assert.equal(calendarProgress(wet).season, 0); assert.equal(weatherAt(wet).kind, 'wet');
  wet = { ...wet, tiles: wet.tiles.map(tile => tile.ty < 12 ? { ...tile, terrain: 'water' as const } : tile) };
  const banks = springWorldProps(wet, choose).filter(prop => prop.role === 'swollen-bank'); assert.ok(banks.length > 0);
  let dry = wet;
  for (let seed = 1; seed < 1000; seed++) { const candidate = { ...wet, seed }; if (weatherAt(candidate).kind !== 'wet') { dry = candidate; break; } }
  assert.notEqual(weatherAt(dry).kind, 'wet'); assert.equal(springWorldProps(dry, choose).filter(prop => prop.role === 'swollen-bank').length, 0);
  const unsupported = { ...wet, tiles: wet.tiles.map(tile => tile.terrain === 'grass' ? { ...tile, terrain: 'rock' as const } : tile) };
  assert.equal(springWorldProps(unsupported, choose).length, 0);
  const blocked = { ...wet, tiles: wet.tiles.map(tile => ({ ...tile, hasRoad: true })) }; assert.equal(springWorldProps(blocked, choose).filter(prop => prop.role === 'swollen-bank').length, 0);
  const built = { ...wet, tiles: wet.tiles.map(tile => ({ ...tile, buildingId: 'occupied' })) }; assert.equal(springWorldProps(built, choose).length, 0);
});
test('Given an actual orchard When choosing ornamental cherry Then fruit props remain untouched and the support belongs to the orchard', () => {
  const base = state(), membership = base.tiles.filter(tile => tile.tx >= 5 && tile.tx < 18 && tile.ty >= 5 && tile.ty < 18).map(tile => tile.ty * base.width + tile.tx);
  const orchard: GameState = { ...base, zones: [{ id: 'orchard', kind: 'orchard', strokes: [], membership, createdOrdinal: 1 }] };
  const before = JSON.stringify(orchard), cherries = springWorldProps(orchard, choose).filter(prop => prop.role === 'cherry');
  assert.equal(cherries.length, 1); assert.match(cherries[0]?.id ?? '', /ornamental-cherry/);
  assert.ok(cherries.every(prop => prop.cells.every(cell => membership.includes(cell.ty * orchard.width + cell.tx))));
  assert.equal(JSON.stringify(orchard), before);
  const blocked = { ...orchard, tiles: orchard.tiles.map(tile => ({ ...tile, hasRoad: true })) };
  assert.deepEqual(springWorldProps(blocked, choose), []);
});
test('Given a real occupied house backyard When choosing laundry Then it uses a free backyard footprint without existing decal overlap', () => {
  const base = state(), original = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v47/chapter-four-town.save.json'))).envelope.state as GameState;
  const house = original.houses[0], building = original.buildings.find(building => building.id === house?.buildingId);
  assert.ok(house && building);
  const home = { ...building, tx: 12, ty: 12 }, household = { ...house, residents: 5 };
  const town: GameState = { ...base, buildings: [home], houses: [household], tiles: base.tiles.map(tile => tile.tx === 12 && tile.ty === 12 ? { ...tile, buildingId: home.id } : tile) };
  const laundry = springWorldProps(town, choose).filter(prop => prop.role === 'laundry');
  assert.equal(laundry.length, 1);
  const yard = backyardLayout(town).find(yard => yard.buildingId === home.id); assert.ok(yard);
  const available = new Set([...yard.cells, ...yard.spill].map(cell => cell.ty * town.width + cell.tx));
  const entry = choose('laundry', 0); assert.ok(entry);
  for (const prop of laundry) {
    assert.ok(prop.cells.every(cell => available.has(cell.ty * town.width + cell.tx)));
    const point = tileToScreen(prop.tx, prop.ty), scale = entry.geometry.scale;
    const box = { x: point.sx - entry.geometry.pivot.x * scale, y: point.sy - entry.geometry.pivot.y * scale, width: entry.image.width * scale, height: entry.image.height * scale };
    assert.ok(backyardPlan(town).every(decal => !boxesOverlap(box, yardDecalRect(decal))));
    const occupied = { ...town, buildings: [...town.buildings, { ...home, id: 'blocking-house', tx: prop.tx, ty: prop.ty }] };
    assert.ok(springWorldProps(occupied, choose).every(next => next.tx !== prop.tx || next.ty !== prop.ty));
  }
  assert.equal(springWorldProps({ ...town, houses: [{ ...household, burntTick: 1 }] }, choose).filter(prop => prop.role === 'laundry').length, 0);
  const blocked = { ...town, tiles: town.tiles.map(tile => ({ ...tile, hasRoad: true })) };
  assert.deepEqual(springWorldProps(blocked, choose), []);
});

test('Given readiness changes on the same state When deriving placements Then a previous empty cache never conceals ready art', () => {
  const base = state(), edge = { ...base, tiles: base.tiles.map(tile => tile.tx === 12 ? { ...tile, terrain: 'forest' as const } : tile) };
  assert.deepEqual(springWorldProps(edge, () => null), []);
  const ready = springWorldProps(edge, choose); assert.ok(ready.length > 0);
  assert.strictEqual(springWorldProps(edge, choose), ready, 'paused immutable state reuses placement array');
  assert.deepEqual(springWorldProps(edge, () => null), []);
  assert.equal(choose('nest', 0)?.minZoom, 1);
});
test('Given spring props at different depths When queue sorting Then source anchors determine order', () => {
  const prop = { id: 'nest', assetId: 'wave43:nest_bird_spring', role: 'nest' as const, tx: 2, ty: 3, cells: [] };
  const a = { kind: 'spring_prop' as const, id: 'a', prop, depth: depthKey(2, 3), anchorTx: 2 };
  const b = { ...a, id: 'b', prop: { ...prop, ty: 4 }, depth: depthKey(2, 4) };
  assert.deepEqual(sortRenderItems([b, a]).map(item => item.id), ['a', 'b']);
});
