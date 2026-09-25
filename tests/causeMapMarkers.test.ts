import assert from 'node:assert/strict';
import test from 'node:test';
import type { Building } from '../src/content/buildingConfig';
import type { GameState } from '../src/engine/engine.types';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { causeMarkerSeverity } from '../src/ui/causeRegistry';
import type { BuildingCausePresentation, HouseProgressModel } from '../src/ui/houseProgressModel';
import { causeMarkersForState, drawCauseMap } from '../src/render/causeMapOverlay';

function building(id: string, kind: Building['kind'], tx: number, ty: number): Building {
  return { id, kind, tx, ty, workers: 5, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
function house(id: string, level: number) {
  return { buildingId: id, level, residents: 14, hasWater: true, breadStock: 0, lastServicedTick: 0, unmetRequirementTicks: 0 };
}
/** Walled L4 homes with no well: each is about to lose its level to water first, bread second. */
function riskState(homes: readonly (readonly [string, number, number])[]): GameState {
  const polygon = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 0 }];
  return { ...DEFAULT_GAME_STATE, width: 22, height: 22, tick: 0,
    tiles: Array.from({ length: 484 }, (_, i) => ({ tx: i % 22, ty: Math.floor(i / 22), terrain: 'grass', buildingId: null, hasRoad: Math.floor(i / 22) === 5 })),
    houses: homes.map(([id]) => house(id, 4)),
    buildings: [...homes.map(([id, tx, ty]) => building(id, 'house', tx, ty)), building('market', 'market', 6, 6), building('church', 'church', 8, 7)],
    palisade: { id: 'wall', polygon, gate: { x: 0, y: 5 }, segments: [{ id: 'wall-0', edgePath: polygon, order: 0, tileCount: 80, completed: true, constructionSiteId: null }] },
  };
}
function loggedContext(): CanvasRenderingContext2D & { readonly calls: string[] } {
  const calls: string[] = [];
  const target: Record<string, unknown> = { calls };
  return new Proxy(target, {
    get(object, key) {
      if (key in object) return object[key as string];
      return (...args: unknown[]) => { calls.push(`${String(key)}:${args.join(',')}`); };
    },
    set(object, key, value) { object[key as string] = value; calls.push(`${String(key)}=${String(value)}`); return true; },
  }) as unknown as CanvasRenderingContext2D & { readonly calls: string[] };
}
const presentation = (patch: Partial<BuildingCausePresentation>): BuildingCausePresentation => ({
  buildingId: 'b', name: 'n', status: 'blocked', summary: '', ...patch,
  blocker: patch.blocker === undefined ? { causeId: 'workers', requirement: 'production', reason: 'understaffed', label: '', sources: [] } : patch.blocker,
});
const housePresentation = (patch: Partial<HouseProgressModel>): HouseProgressModel => ({
  ...presentation(patch), currentLevel: 2, nextLevel: 3, progressTicks: 0, requiredTicks: null, remainingTicks: null, ...patch,
});

test('severity: ▲ for a house about to fall or a stopped facility, ◆ for a held-back house or a paused facility', () => {
  assert.equal(causeMarkerSeverity(housePresentation({ status: 'risk' })), 'block');
  assert.equal(causeMarkerSeverity(presentation({ status: 'blocked' })), 'block');
  assert.equal(causeMarkerSeverity(housePresentation({ status: 'blocked' })), 'warn');
  assert.equal(causeMarkerSeverity(presentation({ blocker: { causeId: 'operation_paused', requirement: 'production', reason: 'paused', label: '', sources: [] } })), 'warn');
});

test('causes the settlement clears by itself and non-causes draw no marker', () => {
  const waiting = { causeId: 'bread', requirement: 'bread', reason: 'awaiting_delivery', label: '', sources: [] } as const;
  assert.equal(causeMarkerSeverity(housePresentation({ status: 'risk', blocker: waiting })), null);
  assert.equal(causeMarkerSeverity(housePresentation({ status: 'ready', blocker: null })), null);
  assert.equal(causeMarkerSeverity(presentation({ status: 'normal', blocker: null })), null);
});

test('a building with several unmet needs shows only its first actionable cause, as a ▲', () => {
  const state = riskState([['home', 4, 4]]);
  const markers = causeMarkersForState(state, 1).filter(marker => marker.buildingIds.includes('home'));
  assert.equal(markers.length, 1);
  assert.equal(markers[0]?.causeId, 'water');
  assert.equal(markers[0]?.severity, 'block');
  const context = loggedContext();
  drawCauseMap(context, state, 1, false);
  assert.ok(context.calls.includes('moveTo:0,-15'));
  assert.ok(context.calls.includes('lineTo:15,11'), 'triangle, not the diamond');
  assert.equal(context.calls.includes('lineTo:15,0'), false);
  assert.ok(context.calls.includes('fillText:물,0,4'));
});

test('a house held below its next level draws the ◆ caution shape', () => {
  const state = riskState([['home', 4, 4]]);
  state.buildings = [...state.buildings, building('well', 'well', 2, 4)];
  state.houses = state.houses.map(home => ({ ...home, level: 2, breadStock: 5 }));
  assert.equal(causeMarkersForState(state, 1).find(marker => marker.buildingIds.includes('home'))?.severity, 'warn');
  const context = loggedContext();
  drawCauseMap(context, state, 1, false);
  assert.ok(context.calls.includes('lineTo:15,0'));
  assert.equal(context.calls.includes('lineTo:15,11'), false);
});

test('zoomed out below 0.8, nearby problem houses share one marker with their count', () => {
  const state = riskState([['home-a', 1, 1], ['home-b', 3, 1], ['home-c', 13, 13]]);
  assert.equal(causeMarkersForState(state, 0.8).length, 3);
  const clustered = causeMarkersForState(state, 0.7);
  assert.deepEqual(clustered.map(marker => marker.buildingIds), [['home-a', 'home-b'], ['home-c']]);
  const context = loggedContext();
  drawCauseMap(context, state, 0.7, false);
  assert.ok(context.calls.includes('fillText:2,0,4'));
  assert.ok(context.calls.includes('fillText:물,0,4'));
});

test('problem-only view still outlines the footprint of a building with an actionable cause', () => {
  const state = riskState([['home', 4, 4]]);
  const strokes = (problemOnly: boolean) => {
    const context = loggedContext();
    drawCauseMap(context, state, 1, problemOnly);
    return context.calls.filter(call => call === 'stroke:').length;
  };
  assert.equal(strokes(true), strokes(false) + 1, 'one footprint outline on top of the marker');
});
