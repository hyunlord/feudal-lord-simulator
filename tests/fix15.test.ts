/**
 * FIX-15 (spec docs/design/water-perimeter.md WP-1…WP-4, decisions FX15-*): a wall ring may take the water as its bound
 * where it runs through it — no wall is built there, the gates stand in the wall, and the bot tries it only once no
 * ring stands on land; the hamlet's carted timber (TT-5) is dearer, one a market day, an order at most 60.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { TIMBER_TRADE_BALANCE } from "../src/content/timberTradeConfig";
import type { GameState } from "../src/engine/engine.types";
import { MARKET_CADENCE_TICKS } from "../src/engine/marketSettlement";
import { projectPalisadeProclamation } from "../src/engine/palisade";
import { computePalisadeProposalForState, palisadeFootprintsForState } from "../src/engine/palisadeFootprints";
import { palisadeRingPoints, palisadeStepPoints } from "../src/engine/palisadeSegments";
import { advanceTimberTrade, orderTimber, timberTradePoint } from "../src/engine/timberTrade";
import { computePalisadeProposal, isWaterReachStep, pathHasWaterReach, validatePalisadeCandidate } from "../src/world/palisadeGeometry";
import { treasuryBalance } from "../src/ledger/ledger";

/** The seed's opening on an island: every cell beyond its buildings' box is water (no ring can keep to land). */
function hemmed(): GameState {
  const town = createGrowthOpening(1).state as GameState;
  const footprints = palisadeFootprintsForState(town);
  const minX = Math.min(...footprints.map(footprint => footprint.tx)), maxX = Math.max(...footprints.map(footprint => footprint.tx + footprint.width - 1));
  const minY = Math.min(...footprints.map(footprint => footprint.ty)), maxY = Math.max(...footprints.map(footprint => footprint.ty + footprint.height - 1));
  return { ...town, tiles: town.tiles.map(tile => (tile.tx < minX || tile.tx > maxX || tile.ty < minY || tile.ty > maxY) && tile.buildingId === null
    ? { ...tile, terrain: "water" as const, hasRoad: false } : tile) };
}

test("WP-1·WP-2 a town hemmed by water: no ring on land, so the bot's proposal takes the water as its bound there; land rings stay preferred", () => {
  const state = hemmed();
  const footprints = palisadeFootprintsForState(state);
  assert.equal(computePalisadeProposal(state, footprints).ok, false, "no ring on land");
  const proposal = computePalisadeProposalForState(state);
  assert.ok(proposal.ok, proposal.ok ? "" : proposal.reason);
  assert.ok(pathHasWaterReach(state, proposal.path), "it runs through the water");
  // A player's own draft (the default validation) still refuses water; the engine's proclamation takes it.
  assert.equal(validatePalisadeCandidate(state, proposal.path, footprints).ok, false);
  assert.equal(validatePalisadeCandidate(state, proposal.path, footprints, footprints, 0.6, { waterReach: true }).ok, true);
  // An opening with land around it keeps its land ring (no water reach).
  const open = createGrowthOpening(1).state as GameState;
  const land = computePalisadeProposalForState(open);
  assert.ok(land.ok && !pathHasWaterReach(open, land.path));
});

test("WP-3 the proclamation builds only the land runs; the gate stands in the wall; the water reach costs nothing", () => {
  const state = hemmed();
  const proposal = computePalisadeProposalForState(state);
  assert.ok(proposal.ok);
  const proclaimed = projectPalisadeProclamation({ ...state, era: "hamlet" }, proposal.path);
  assert.notEqual(proclaimed, state);
  const palisade = proclaimed.palisade!;
  const ring = palisadeRingPoints(palisade.polygon);
  const waterSteps = ring.filter((point, index) => isWaterReachStep(state, point, ring[(index + 1) % ring.length]!)).length;
  assert.ok(waterSteps > 0);
  const built = palisade.segments.reduce((sum, segment) => sum + segment.tileCount, 0);
  assert.equal(built, ring.length - waterSteps, "every land step walled, no water step");
  for (const segment of palisade.segments) {
    const points = palisadeStepPoints(segment.edgePath);
    for (let index = 1; index < points.length; index += 1) assert.equal(isWaterReachStep(state, points[index - 1]!, points[index]!), false);
  }
  const gateIndex = ring.findIndex(point => point.x === palisade.gate.x && point.y === palisade.gate.y);
  const n = ring.length;
  assert.ok(!isWaterReachStep(state, ring[gateIndex]!, ring[(gateIndex + 1) % n]!) || !isWaterReachStep(state, ring[(gateIndex - 1 + n) % n]!, ring[gateIndex]!), "the gate in a land step");
  assert.equal(proclaimed.era, "palisade");
});

test("TT-5 the hamlet's carted timber: dearer than the market's, one a market day, an order at most 60", () => {
  const town = { ...(createGrowthOpening(1).state as GameState), treasuryCoin: 5_000 };
  assert.equal(town.era, "hamlet");
  assert.equal(timberTradePoint(town)?.kind, "storehouse");
  assert.ok(TIMBER_TRADE_BALANCE.hamletPrice > TIMBER_TRADE_BALANCE.price);
  const ordered = orderTimber(town, 400);
  assert.equal(ordered.timberOrder, TIMBER_TRADE_BALANCE.hamletMaxOrder);
  const day = { ...ordered, tick: Math.ceil((ordered.tick + 1) / MARKET_CADENCE_TICKS) * MARKET_CADENCE_TICKS };
  const delivered = advanceTimberTrade(day);
  assert.equal(delivered.treasuryTimber - day.treasuryTimber, TIMBER_TRADE_BALANCE.hamletPerMarketDay);
  assert.equal(treasuryBalance(day) - treasuryBalance(delivered), TIMBER_TRADE_BALANCE.hamletPerMarketDay * TIMBER_TRADE_BALANCE.hamletPrice);
  assert.equal(delivered.timberOrder, TIMBER_TRADE_BALANCE.hamletMaxOrder - TIMBER_TRADE_BALANCE.hamletPerMarketDay);
});
