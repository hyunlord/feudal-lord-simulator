import assert from "node:assert/strict";
import test from "node:test";
import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { palisadeFootprintsForState } from "../src/engine/palisadeFootprints";
import { computePalisadeProposal, palisadePathHasBuildingClearance, validatePalisadeCandidate } from "../src/world/palisadeGeometry";

test("original seed 3 opening admits a wall without moving its shoreline logging camp", () => {
  const { state, provenance } = createGrowthOpening(3);
  assert.deepEqual(provenance.offset, { tx: -33, ty: -34 });
  const footprints = palisadeFootprintsForState(state);
  assert.equal(footprints.length, 8);
  const before = structuredClone(state);
  const proposal = computePalisadeProposal(state, footprints);
  assert.equal(proposal.ok, true, proposal.ok ? undefined : proposal.reason);
  const validation = validatePalisadeCandidate(state, proposal.path, footprints);
  assert.equal(validation.ok, true);
  assert.equal(validation.candidate.enclosedFootprints, 7);
  assert.equal(validation.candidate.enclosureRatio, 7 / 8);
  assert.equal(palisadePathHasBuildingClearance(proposal.path, footprints, 1), true);
  assert.deepEqual(computePalisadeProposal(state, [...footprints].reverse()), proposal);
  assert.deepEqual(state, before);
});
