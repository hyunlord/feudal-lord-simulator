import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { loadAutoplayFixture } from "../scripts/autoplayStallProbe";
import { runAutoplaySearch } from "../src/engine/autoplaySearchBudget";
import { autoplayWallExpansionAction } from "../src/engine/autoplayWallRoom";
import type { GameState } from "../src/engine/engine.types";
import { MARKET_ROAD_REACH, marketReach, marketRoadDistance } from "../src/engine/marketService";
import { expandPalisade, previewPalisadeExpansion } from "../src/engine/palisade";
import { advanceTick } from "../src/engine/tick";
import { applyPalisadeIntent, dragDraftRunByTiles, initialExpansionDraft, type PalisadeDraftState } from "../src/render/palisadeDraftInteraction";
import { alertStackRows, pastureAlertEntry } from "../src/ui/alertStackModel";
import { buildEraConsoleModel, EraConsole } from "../src/ui/EraConsole";
import { houseMarketDistance, marketReachLine, marketReachView, type HouseMarketDistance } from "../src/ui/marketReachModel";
import { placementChipModel } from "../src/ui/placementChip";
import { buildingPlacementPrediction, virtualFacility } from "../src/ui/placementPrediction";
import { WALL_EXPANSION_COPY } from "../src/ui/wallExpansionCopy.ko";
import { cachedExpansionPreview, expansionDraftFootprints, expansionLines, expansionStartCandidate, pendingPastureWarning } from "../src/ui/wallExpansionModel";
import { dragPalisadeRun, type PalisadePath } from "../src/world/palisadeGeometry";

// UX-0b2: MARKET-1 and WALL-2 on screen — a house's road steps to the market on the placement chip, a market's road
// reach (placement preview, a selected market), and widening a standing wall (the draft, its preview lines, the fields
// it takes in and, after it, the pasture warning).

const marketTown = (() => { const raw = JSON.parse(readFileSync("fixtures/determinism/seed1/final-state.json", "utf8")) as GameState; return advanceTick(raw); })();
const markets = marketTown.buildings.filter(building => building.kind === "market");

test("UX-0b2 a house's placement chip says its road steps to the nearest market against the reach (40)", () => {
  assert.ok(markets.length >= 2);
  const home = marketTown.buildings.find(building => building.kind === "house" && markets.some(market => (marketRoadDistance(marketTown)(building, market) ?? 99) <= MARKET_ROAD_REACH))!;
  const distance = houseMarketDistance(marketTown, home)!;
  const nearest = Math.min(...markets.map(market => marketRoadDistance(marketTown)(home, market) ?? Infinity));
  assert.deepEqual(distance, { steps: nearest, reach: MARKET_ROAD_REACH });
  const chip = (market: HouseMarketDistance | null) => placementChipModel(marketTown, { tool: "house", reachHouses: null, market }).market;
  assert.deepEqual(chip({ steps: 12, reach: 40 }), { text: "시장까지 길 12걸음 / 40", far: false });
  assert.deepEqual(chip({ steps: 52, reach: 40 }), { text: "시장까지 길 52걸음 / 40 — 닿지 않음", far: true });
  assert.deepEqual(chip({ steps: null, reach: 40 }), { text: "시장까지 이어진 길 없음", far: true });
  assert.equal(chip(null), null, "no market in town: no line");
  assert.equal(houseMarketDistance({ ...marketTown, buildings: marketTown.buildings.filter(building => building.kind !== "market") }, home), null);
  // A house far from every road joined to a market: no road.
  const lone = virtualFacility(marketTown, "house", { tx: 1, ty: 1 });
  assert.equal(houseMarketDistance(marketTown, lone)?.steps, null);
});

test("UX-0b2 a market's placement preview is its road reach (tiles and homes), not a radius; a selected market shows the same", () => {
  const market = markets[0]!;
  // The preview at the standing market's own place: the reach the engine gives that market.
  const prediction = buildingPlacementPrediction({ ...marketTown, buildings: marketTown.buildings.filter(building => building.id !== market.id) }, "market", { tx: market.tx, ty: market.ty });
  assert.equal(prediction.range, null);
  assert.ok((prediction.reachTiles?.length ?? 0) > 0 && prediction.houseIds.length > 0);
  assert.match(prediction.lines.map(line => line.text).join("\n"), new RegExp(`길 ${MARKET_ROAD_REACH}걸음 안 · 닿는 길 \\d+칸 · 집 ${prediction.houseIds.length}채`));
  const chip = placementChipModel(marketTown, { tool: "market", reachHouses: prediction.houseIds.length });
  assert.equal(chip.reach, `길 ${MARKET_ROAD_REACH}걸음 안 집 ${prediction.houseIds.length}채`);
  // Selected: the engine's reach, cached per state.
  const view = marketReachView(marketTown, market.id)!;
  assert.deepEqual(view, marketReach(marketTown, market));
  assert.equal(marketReachView(marketTown, market.id), view, "the same state: the cached view");
  assert.equal(marketReachLine(marketTown, market.id), `길 ${MARKET_ROAD_REACH}걸음 안 집 ${view.homeIds.length}채`);
  assert.equal(marketReachView(marketTown, marketTown.buildings.find(building => building.kind === "house")!.id), null);
});

function walled(): { readonly state: GameState; readonly path: PalisadePath } {
  const state = loadAutoplayFixture("fixtures/autoplay/seed3-792000.json.gz");
  const action = runAutoplaySearch(() => autoplayWallExpansionAction(state, 30));
  assert.equal(action.kind, "proclaim_era");
  return { state, path: (action as { candidatePath: PalisadePath }).candidatePath };
}

test("UX-0b2 widening the wall: the draft starts from the standing wall; the console shows cost, area and the fields it takes in", () => {
  const { state, path } = walled();
  const start = expansionStartCandidate(state)!;
  assert.ok(start.runs.length > 0);
  const draft = initialExpansionDraft(start);
  assert.equal(draft.purpose, "expand");
  // Unchanged ring: nothing to proclaim ("not larger"); the console offers the entry only without a draft.
  const idle = buildEraConsoleModel({ state, draft: null });
  assert.equal(idle.expansion.available, true);
  const unchanged = buildEraConsoleModel({ state, draft });
  assert.deepEqual([unchanged.expansion.editing, unchanged.expansion.ok, unchanged.action.enabled, unchanged.action.reason], [true, false, false, WALL_EXPANSION_COPY.failure.not_larger]);
  // The bot's accepted widening as the draft's ring.
  const widened = { ...draft, candidate: { ...start, path }, path };
  const model = buildEraConsoleModel({ state, draft: widened });
  const preview = previewPalisadeExpansion(state, path);
  assert.ok(preview.ok);
  assert.deepEqual([model.expansion.ok, model.action.enabled, model.action.label], [true, true, WALL_EXPANSION_COPY.confirm]);
  const lines = model.expansion.lines.map(line => line.text);
  assert.equal(lines[0], WALL_EXPANSION_COPY.cost(preview.newSteps, preview.timber));
  assert.equal(lines[1], WALL_EXPANSION_COPY.area(preview.interiorBefore, preview.interiorAfter));
  assert.ok(preview.enclosedArableCells.length > 0, "this widening takes fields in");
  assert.equal(model.expansion.lines[2]!.severity, "warn");
  assert.match(lines[2]!, new RegExp(`밭 ${preview.enclosedArableCells.length}칸이 성 안에 들어갑니다 — \\d+년 (봄|여름|가을|겨울)에 목초지로`));
  assert.deepEqual(expansionLines(state, { ok: false, reason: "not_containing" }).map(line => [line.severity, line.text]), [["block", WALL_EXPANSION_COPY.failure.not_containing]]);
  assert.equal(cachedExpansionPreview(state, path), cachedExpansionPreview(state, path), "the same wall, zones and ring: one preview");
  // Dragging a side outward one tile at a time, past refused positions: the side follows once a position is valid.
  const side = start.runs.findIndex(run => run.steps >= 4 && (run.normal.x === 0 || run.normal.y === 0)
    && [1, 2, 3, 4, 5, 6].some(steps => { const moved = dragPalisadeRun(state, start, start.runs.indexOf(run), steps, expansionDraftFootprints(state).footprints, expansionDraftFootprints(state).enclosure, 1); return moved.ok && previewPalisadeExpansion(state, moved.candidate.path).ok; }));
  const run = start.runs[side]!;
  const a = start.path[run.startIndex]!; const b = start.path[run.endIndex]!;
  const middle = { tx: Math.round((a.x + b.x) / 2), ty: Math.round((a.y + b.y) / 2) };
  let dragging: PalisadeDraftState = { ...draft, selectedRunIndex: side, dragStartTile: middle };
  for (let step = 1; step <= 6 && !buildEraConsoleModel({ state, draft: dragging }).expansion.ok; step += 1) {
    dragging = dragDraftRunByTiles({ grid: state, draft: dragging, startTile: dragging.dragStartTile!, currentTile: { tx: middle.tx + run.normal.x * step, ty: middle.ty + run.normal.y * step },
      footprints: expansionDraftFootprints(state).footprints, enclosureFootprints: expansionDraftFootprints(state).enclosure, minimumEnclosureRatio: 1 });
  }
  assert.equal(buildEraConsoleModel({ state, draft: dragging }).expansion.ok, true, "a tile-by-tile drag reaches an accepted widening");
  // Esc with nothing to undo ends an expansion (there is no open drawing to fall back to).
  assert.equal(applyPalisadeIntent({ state, draft, intent: { type: "cancel" } }), null);
  const markup = renderToStaticMarkup(createElement(EraConsole, { model, onBeginProposal: () => undefined, onConfirmProposal: () => undefined, onCancelProposal: () => undefined,
    onBeginExpansion: () => undefined, onConfirmExpansion: () => undefined }));
  assert.match(markup, /data-expansion-line="expansion-cost"/);
  assert.match(markup, new RegExp(WALL_EXPANSION_COPY.cancel));
  assert.match(renderToStaticMarkup(createElement(EraConsole, { model: idle, onBeginProposal: () => undefined, onConfirmProposal: () => undefined, onCancelProposal: () => undefined,
    onBeginExpansion: () => undefined })), /data-action="begin-expansion"/);
});

test("UX-0b2 after the expansion: the fields still to turn, when (a calendar season), in the console and as a caution row", () => {
  const { state, path } = walled();
  const preview = previewPalisadeExpansion(state, path);
  assert.ok(preview.ok);
  const after = expandPalisade(state, path);
  const pending = pendingPastureWarning(after);
  assert.ok(pending !== null && pending.cells.length > 0);
  assert.match(pending.date, /^\d+년 (봄|여름|가을|겨울)$/);
  assert.equal(buildEraConsoleModel({ state: after, draft: null }).expansion.pending, pending.line);
  const row = pastureAlertEntry(after)!;
  assert.deepEqual([row.key, row.title, row.cause, row.severity], ["caution|story|pasture", WALL_EXPANSION_COPY.alertTitle,
    WALL_EXPANSION_COPY.alertCause(pending.cells.length, pending.date), "caution"]);
  assert.equal(after.buildings.find(building => building.id === row.targetId)?.kind, "farmstead");
  // This town's stack is full of larger cautions (bread for many houses): the three rows it shows are theirs.
  assert.equal(alertStackRows(after).length, 3);
  assert.equal(pastureAlertEntry(state), null, "no expansion yet: no row");
});
