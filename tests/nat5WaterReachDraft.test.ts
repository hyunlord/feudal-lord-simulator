import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import type { GameState } from "../src/engine/engine.types";
import { projectPalisadeProclamation } from "../src/engine/palisade";
import { computePalisadeProposalForState, palisadeFootprintsForState } from "../src/engine/palisadeFootprints";
import { expansionStartCandidate, proposalDraftCandidate } from "../src/ui/wallExpansionModel";
import { pathHasWaterReach } from "../src/world/palisadeGeometry";

// NAT-5 (user 2026-10-02): FIX-15 lets a wall ring take the water as its bound where it runs through it. The screen's
// own checks (the era console's "성벽 제안" draft and the expansion start) used the strict default and refused that
// ring, so on a water-heavy land (seed 77777) the proposal did nothing.

/** The seed's opening on an island: every cell beyond its buildings' box is water (no ring can keep to land). */
function hemmed(): GameState {
  const town = createGrowthOpening(1).state as GameState;
  const footprints = palisadeFootprintsForState(town);
  const minX = Math.min(...footprints.map(footprint => footprint.tx)), maxX = Math.max(...footprints.map(footprint => footprint.tx + footprint.width - 1));
  const minY = Math.min(...footprints.map(footprint => footprint.ty)), maxY = Math.max(...footprints.map(footprint => footprint.ty + footprint.height - 1));
  return { ...town, tiles: town.tiles.map(tile => (tile.tx < minX || tile.tx > maxX || tile.ty < minY || tile.ty > maxY) && tile.buildingId === null
    ? { ...tile, terrain: "water" as const, hasRoad: false } : tile) };
}

test("Given a town hemmed by water When the era console proposes its wall Then the screen takes the water ring as a draft", () => {
  const state = hemmed();
  const proposal = computePalisadeProposalForState(state);
  assert.ok(proposal.ok, proposal.ok ? "" : proposal.reason);
  assert.ok(pathHasWaterReach(state, proposal.path), "the proposal runs through the water");
  assert.notEqual(proposalDraftCandidate(state, proposal.path, palisadeFootprintsForState(state)), null);
});

test("Given a proclaimed wall that takes the water as its bound When an expansion draft starts Then it starts from that wall", () => {
  const state = hemmed();
  const proposal = computePalisadeProposalForState(state);
  assert.ok(proposal.ok);
  const proclaimed = projectPalisadeProclamation({ ...state, era: "hamlet" }, proposal.path);
  assert.ok(proclaimed.palisade !== null);
  assert.notEqual(expansionStartCandidate(proclaimed), null);
});

test("Given a town with land around it When the era console proposes its wall Then the draft keeps its land ring", () => {
  const state = createGrowthOpening(1).state as GameState;
  const proposal = computePalisadeProposalForState(state);
  assert.ok(proposal.ok && !pathHasWaterReach(state, proposal.path));
  const candidate = proposalDraftCandidate(state, proposal.path, palisadeFootprintsForState(state));
  assert.ok(candidate !== null && !pathHasWaterReach(state, candidate.path));
});
