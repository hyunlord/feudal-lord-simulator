import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BALANCE } from '../src/content/balanceConfig';
import type { Building } from '../src/content/buildingConfig';
import { runProduction } from '../src/engine/simulationProduction';
import { initialPalisadeDraft } from '../src/render/palisadeDraftInteraction';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { EraConsole, buildEraConsoleModel } from '../src/ui/EraConsole';
import { proposalPredictionLines } from '../src/ui/wallPrediction';

const sawmill: Building = {
  id: 'sawmill-a', kind: 'sawmill', tx: 2, ty: 2, workers: 2,
  inventory: { logs: 4 }, reserved: {}, stockReserved: {}, productionProgress: 34,
};
const grassGrid = Array.from({ length: 64 }, (_, index) => ({
  tx: index % 8, ty: Math.floor(index / 8), terrain: 'grass' as const,
  buildingId: null, hasRoad: Math.floor(index / 8) === 1,
}));
const path = [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 5 }, { x: 1, y: 5 }, { x: 1, y: 1 }];

test('prediction has no invented completion time before measured timber output', () => {
  const state = { ...DEFAULT_GAME_STATE, tick: 2400, treasuryTimber: 0, buildings: [sawmill],
    width: 8, height: 8, tiles: grassGrid };
  const lines = proposalPredictionLines(state, path);
  assert.ok(lines.some(line => line.id === 'scope' && line.text.includes('목재 240')));
  assert.ok(lines.some(line => line.id === 'eta' && line.text.includes('생산 기록 부족')));
});

test('real sawmill output populates a bounded 2400-tick gross-production window', () => {
  const state = { ...DEFAULT_GAME_STATE, tick: 2501, buildings: [sawmill], width: 8, height: 8,
    tiles: grassGrid, timberProductionWindow: {
      startTick: 102, throughTick: 2500, produced: 2, productionTicks: [100, 101],
    } };
  const next = runProduction(state);
  assert.deepEqual(next.timberProductionWindow, {
    startTick: 102, throughTick: 2501, produced: 1, productionTicks: [2501],
  });
  assert.equal(next.buildings[0]?.inventory.timber, 1);
});

test('blocked sawmill work never becomes production evidence', () => {
  const state = { ...DEFAULT_GAME_STATE, tick: BALANCE.TICKS_PER_SECOND,
    buildings: [{ ...sawmill, inventory: {} }], width: 8, height: 8, tiles: grassGrid };
  const next = runProduction(state);
  assert.equal(next.timberProductionWindow?.produced, 0);
  assert.equal(next.buildings[0]?.inventory.timber ?? 0, 0);
});

test('measured output sets an explicitly transport-excluded 1x minimum time', () => {
  const state = { ...DEFAULT_GAME_STATE, tick: 2400, treasuryTimber: 0, buildings: [sawmill],
    width: 8, height: 8, tiles: grassGrid, timberProductionWindow: {
      startTick: 1, throughTick: 2400, produced: 100,
      productionTicks: Array.from({ length: 100 }, (_, index) => 24 * (index + 1)),
    } };
  const lines = proposalPredictionLines(state, path);
  assert.ok(lines.some(line => line.id === 'eta' && line.text.includes('최소 약 5분')));
  assert.ok(lines.some(line => line.id === 'eta' && line.text.includes('운송 제외')));
});

test('edited wall prediction follows the current draft rather than the untouched proposal', () => {
  const current = { ...DEFAULT_GAME_STATE, width: 8, height: 8, tiles: grassGrid,
    era: 'hamlet' as const, treasuryTimber: 1000 };
  const draft = initialPalisadeDraft({
    path,
    runs: [], perimeterSteps: 16, enclosedFootprints: 0, enclosureRatio: 0,
  });
  const model = buildEraConsoleModel({ state: current, draft });
  assert.ok(model.predictionLines.some(line => line.id === 'scope' && line.text.includes('길이 16칸')));
});

test('stone requirement tells a marketless player where coin comes from', () => {
  const state = { ...DEFAULT_GAME_STATE, era: 'palisade' as const, treasuryCoin: 0 };
  const model = buildEraConsoleModel({ state, draft: null });
  assert.match(model.coinHint ?? '', /시장 0개.*남는 물자를 팔 때/);
});

test('wall construction exposes explicit balanced and priority controls', () => {
  const current = { ...DEFAULT_GAME_STATE, era: 'palisade' as const,
    palisade: { id: 'wall-a', polygon: path, gate: path[0] ?? { x: 1, y: 1 }, segments: [] } };
  const model = buildEraConsoleModel({ state: current, draft: null });
  const markup = renderToStaticMarkup(createElement(EraConsole, {
    model, onBeginProposal: () => undefined, onConfirmProposal: () => undefined,
    onCancelProposal: () => undefined, priority: 'balanced', onPriorityChange: () => undefined,
  }));
  assert.match(markup, /성벽 공사 자재 우선순위/);
  assert.match(markup, /aria-pressed="true"[^>]*>✓ 균형 · 25% 비축/);
  assert.match(markup, /공사 우선/);
});
