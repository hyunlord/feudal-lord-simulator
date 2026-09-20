import assert from 'node:assert/strict';
import test from 'node:test';
import { preserveRoadExpansion } from '../src/engine/autoplayExpansion';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/engine/engine.types';
import { createConstructionSite } from '../src/economy/construction';
import { roadLine } from '../src/world/roadGraph';
import { getTile } from '../src/world/grid';

function layout(rows: readonly string[]): GameState {
  return { ...structuredClone(DEFAULT_GAME_STATE), width: rows[0]?.length ?? 0, height: rows.length,
    buildings: [], constructionSites: [], palisade: null,
    tiles: rows.flatMap((row, ty) => [...row].map((cell, tx) => ({ tx, ty,
      terrain: cell === '~' ? 'water' as const : 'grass' as const,
      hasRoad: cell === 'R', buildingId: cell === '#' ? `occupied-${tx}-${ty}` : null }))) };
}

const pocket = ['#######', '###...#', '##R...#', '##.####', '#######'];

test('Given an adjacent trapped pocket When a mill closes the outward passage Then a road preserves the passage', () => {
  const state = layout(pocket);
  const action = preserveRoadExpansion(state, { kind: 'mill', tx: 3, ty: 2 });
  assert.ok(action);
  assert.equal(action.kind, 'place_road');
  if (action.kind !== 'place_road') return;
  assert.ok(roadLine(action.from, action.to).some(tile => tile.tx === 3 && tile.ty === 2));
  assert.ok(roadLine(action.from, action.to).every(tile => getTile(state, tile)?.terrain !== 'water'));
});

test('Given another traversable route into the same region When a mill occupies one entrance Then placement remains allowed', () => {
  const state = layout(['#######', '##....#', '##R...#', '##.####', '#######']);
  assert.equal(preserveRoadExpansion(state, { kind: 'mill', tx: 3, ty: 2 }), null);
});

test('Given a pending site blocks the other entrance When a mill closes the outward passage Then a road is preserved', () => {
  const state = { ...layout(['#######', '##....#', '##R...#', '##.####', '#######']),
    constructionSites: [createConstructionSite({ ordinal: 1, kind: 'mill', tx: 2, ty: 1, startedTick: 0 })] };
  assert.equal(preserveRoadExpansion(state, { kind: 'mill', tx: 3, ty: 2 })?.kind, 'place_road');
});

test('Given a separate road network reaches the outer region When the source component would be sealed Then its connection remains protected', () => {
  const state = layout(['#######', '###..R#', '##R...#', '##.####', '#######']);
  assert.equal(preserveRoadExpansion(state, { kind: 'mill', tx: 3, ty: 2 })?.kind, 'place_road');
});

test('Given water isolates the remaining region When a mill fills a dead end Then no road is invented across water', () => {
  const state = layout(['#######', '###~..#', '##R.~.#', '##.####', '#######']);
  assert.equal(preserveRoadExpansion(state, { kind: 'mill', tx: 3, ty: 2 }), null);
});

test('Given a completed wall blocks the alternative entrance When the land passage closes Then the real traversal boundary is honored', () => {
  const state = layout(['#######', '##....#', '##R...#', '##.####', '#######']);
  const path = [{ x: 2, y: 2 }, { x: 3, y: 2 }];
  state.palisade = { id: 'wall', polygon: path, gate: { x: 20, y: 20 },
    segments: [{ id: 'segment', order: 0, edgePath: path, tileCount: 1, completed: true, constructionSiteId: null }] };
  assert.equal(preserveRoadExpansion(state, { kind: 'mill', tx: 3, ty: 2 })?.kind, 'place_road');
});

// Exact road, occupied, and water geometry from immutable seed 2 at tick 92400.
const seed2BeforeClosure = [
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "................................................................",
  "~~~.............................................................",
  "~~~~............................................................",
  "~~~~............................................................",
  "~~~~............................................................",
  "~~~~............................................................",
  "~~~~............................................................",
  "~~~~............................................................",
  "~~~.............................................................",
  "~~~.............................................................",
  "~~~.............................................................",
  "~~..............................................................",
  "~~..............................................................",
  "~~..............................................................",
  "~~..............................................................",
  "~~........................................##.##.................",
  "~~........................................########..............",
  "~~........................................#RRRRR##..............",
  "~~.......................................##R###R#########.......",
  "~~~......................................##RR#RRRRR#######......",
  "~~~.......................................###.#~~.RRRRRRRR##....",
  "~~~~......................................###...~~~~~~~~.RRR#...",
  "~~~~.......................................#R#..~~~~~~~~~~.R#...",
  "~~~~~.....................................##R#..~~~~~~~~~~~R##..",
  "~~~~~.....................................##R..~~~~~~~~~~~~R##..",
  "~~~~~......................................#R.~~~~~~~~~~~~RR#...",
  "~~~~~~...................................###R~~~~~~~~~~~~.R#....",
  "~~~~~~~..................................###R~~~~~~~~~~RRRR#....",
  "~~~~~~...................................#RRR~~~~~RRRRRR###.....",
  "~~~~~......................................#RRRRRRR#####.##.....",
  "~~~~........................................#########...........",
  "~~~~.............................................##.............",
  "~~~.............................................................",
  "~~..............................................................",
  "~~..............................................................",
  "~~..............................................................",
  "~~..............................................................",
  "~~~.............................................................",
  "~~~.............................................................",
  "~~~.............................................................",
  "~~~.............................................................",
  "~~~~............................................................",
  "~~~~~...........................................................",
  "~~~~~...........................................................",
  "~~~~~..........................................................."
];

test('Given the actual seed 2 tick 92400 layout When a mill closes its last outward passage Then the advisor preserves a road', () => {
  const action = preserveRoadExpansion(layout(seed2BeforeClosure), { kind: 'mill', tx: 42, ty: 48 });
  assert.deepEqual(action, { kind: 'place_road', from: { tx: 42, ty: 48 }, to: { tx: 42, ty: 48 } });
});
