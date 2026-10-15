/**
 * INERT (the user's rulings 2026-10-10/13): a charter request the merchants' resistance holds back is closed by the
 * steward under the lord's last refusal — no effect, one line in his report ("선례대로 거절") — and the season's slot
 * goes to another petition kind instead of standing empty. Engine B's saturated estate (merchants at −100), refused.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { stewardReport } from "../src/engine/decisionReads";
import { advanceStewardship, answerEstatePetition, stewardshipOf } from "../src/engine/stewardship";
import { delegated } from "./helpers/engineBTlinkFixtures";

function refused(): GameState {
  const state = delegated(), own = stewardshipOf(state);
  assert.ok(state.estates);
  const saturated: GameState = { ...state, tick: 1001, estates: { ...state.estates, estates: state.estates.estates.map(row => ({ ...row, annualValue: 4000 })) },
    stewardship: { ...own, oversight: own.oversight.map(row => ({ ...row, mode: "direct", merchants: -100 })),
      petitions: [{ id: "charter-test", estateId: "delegated-estate", kind: "charter_request", group: "merchants",
        amount: 100, rights: true, marriage: false, tick: 1000, deadline: 2000, status: "open", escalated: "direct" }] } };
  return answerEstatePetition(saturated, "charter-test", false);
}

test("a held-back charter request: closed by the steward by precedent, and the season's slot goes to another kind", () => {
  const before = refused();
  // The seasons within the resistance: the one whose draw is the charter request.
  const seasons = Array.from({ length: 12 }, (_, index) => 2000 + index * 1000).map(tick => ({ tick, after: advanceStewardship({ ...before, tick }) }));
  const held = seasons.find(({ tick, after }) => stewardshipOf(after).petitions.some(row => row.tick === tick && row.kind === "charter_request"));
  assert.ok(held !== undefined, "a season in the resistance draws the charter request");
  const fresh = stewardshipOf(held.after).petitions.filter(row => row.tick === held.tick && row.estateId === "delegated-estate");
  const closed = fresh.find(row => row.kind === "charter_request");
  assert.deepEqual({ status: closed?.status, decidedBy: closed?.decidedBy, precedent: closed?.precedent, amount: closed?.amount },
    { status: "refused", decidedBy: "steward", precedent: true, amount: 0 });
  assert.ok(fresh.some(row => row.kind !== "charter_request"), "the slot went to another petition kind");
  // The steward's report has its line: the charter request, by precedent, refused.
  const line = stewardReport(held.after, held.tick, held.tick + 1).handled.find(row => row.petitionId === closed?.id);
  assert.deepEqual({ policy: line?.policy, granted: line?.granted }, { policy: "precedent", granted: false });
});
