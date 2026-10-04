/**
 * LM-E9b (spec docs/design/town-agency.md TA-13, the user's decision 2026-10-04): in a full town, a week after one that
 * started nothing reuses the walk while nothing it read has changed; a town short of its lots walks every week; the lord's change, the households, the season and the fund
 * threshold walk again; a receipt from a reused walk says so; nothing outside lord mode.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { AGENCY_WEEK_TICKS, WALK_REUSE_IDLE_WEEKS, WALK_REUSE_TICKS } from "../src/content/townAgencyConfig";
import type { GameState } from "../src/engine/engine.types";
import { advanceTownAgency, initialAgency, walkKey } from "../src/engine/townAgency";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";

const WEEK = AGENCY_WEEK_TICKS * 20;

/** A lord's full town (24 houses, chapter two) whose actors and treasury hold nothing: its walks start nothing. */
function stuckTown(start?: GameState): GameState {
  const base = start ?? decodeSave(new Uint8Array(readFileSync("fixtures/saves/v48/chapter-two-town.save.json"))).envelope.state as GameState;
  const town: GameState = { ...base, agency: initialAgency() };
  const posted = postLedgerEntries(town, [{ account: "cash", category: "opening_balance", amount: -treasuryBalance(town), sourceRefs: [{ type: "scenario", id: "test" }] }]);
  return { ...town, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin, tick: WEEK,
    agency: { ...town.agency!, actors: town.agency!.actors.map(actor => ({ ...actor, funds: -10_000 })) } };
}

const week = (state: GameState, weeks = 1): GameState => advanceTownAgency({ ...state, tick: state.tick + weeks * AGENCY_WEEK_TICKS });

/** The stuck full town after WALK_REUSE_IDLE_WEEKS weeks that started nothing, each one walked. */
function idle(): GameState {
  let state = advanceTownAgency(stuckTown());
  for (let index = 1; index < WALK_REUSE_IDLE_WEEKS; index += 1) {
    const next = week(state);
    assert.equal(next.agency!.lastWalk!.tick, next.tick, `idle week ${index + 1} still walks`);
    state = next;
  }
  return state;
}

test("TA-13 in a full town a week after one that started nothing reuses the walk: the same needs, proposals and requests", () => {
  const first = idle();
  const walk = first.agency!.lastWalk!;
  assert.equal(walk.idleWeeks, WALK_REUSE_IDLE_WEEKS);
  assert.equal(first.agency!.receipts.length, 0, "it started nothing");
  const second = week(first);
  assert.equal(second.agency!.lastWalk!.tick, walk.tick, "the next week reused the same walk");
  assert.equal(second.agency!.lastWalk!.proposals, walk.proposals);
  assert.equal(second.agency!.lastWalk!.idleWeeks, WALK_REUSE_IDLE_WEEKS + 1);
  assert.deepEqual(second.agency!.requests, first.agency!.requests);
});

test("TA-13 the lord's policy, subsidies or dues, and the households, walk again the next week", () => {
  const first = idle();
  const agency = first.agency!;
  const changes: Record<string, GameState> = {
    policy: { ...first, agency: { ...agency, policy: agency.policy === "growth" ? "stability" : "growth" } },
    subsidy: { ...first, agency: { ...agency, subsidies: [...agency.subsidies, { id: "subsidy-test", kind: "well", amount: 20 }] } },
    dues: { ...first, agency: { ...agency, duesPermille: agency.duesPermille + 100 } },
    households: { ...first, houses: first.houses.map((house, index) => index === 0 ? { ...house, residents: 0 } : house) },
  };
  for (const [what, changed] of Object.entries(changes)) {
    assert.notEqual(walkKey(changed), walkKey(first), `${what} changes the key`);
    const next = week(changed);
    assert.equal(next.agency!.lastWalk?.tick ?? next.tick, next.tick, `${what}: walked again the next week`);
  }
});

test("TA-13 a season after the walk, or a treasury that reaches the fund threshold, walks again", () => {
  const first = idle();
  const later = week(first, Math.ceil((first.agency!.lastWalk!.tick + WALK_REUSE_TICKS - first.tick) / AGENCY_WEEK_TICKS));
  assert.equal(later.agency!.lastWalk?.tick ?? later.tick, later.tick, "a season on: walked again");
  const threshold: GameState = { ...first, agency: { ...first.agency!, lastWalk: { ...first.agency!.lastWalk!, fundThreshold: 1 } } };
  const posted = postLedgerEntries(threshold, [{ account: "cash", category: "opening_balance", amount: 5, sourceRefs: [{ type: "scenario", id: "test" }] }]);
  const reached = week({ ...threshold, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin });
  assert.equal(reached.agency!.lastWalk?.tick ?? reached.tick, reached.tick, "the treasury reached the threshold: walked again");
});

test("TA-13 a project started from a reused walk carries it on its receipt; a week that starts one keeps no walk", () => {
  const first = idle();
  const walk = first.agency!.lastWalk!;
  // A road the community can lay at once: a free grass tile next to a road (the full town's own walk proposes nothing).
  const road = first.tiles.find(tile => !tile.hasRoad && tile.buildingId === null && tile.terrain === "grass"
    && first.tiles.some(other => other.hasRoad && Math.abs(other.tx - tile.tx) + Math.abs(other.ty - tile.ty) === 1))!;
  const proposal = { actor: "community" as const, what: "road", planner: "test", rank: 1, tx: road.tx, ty: road.ty,
    action: { kind: "place_road" as const, from: { tx: road.tx, ty: road.ty }, to: { tx: road.tx, ty: road.ty } },
    reasons: [{ name: "need" as const, value: 90 }], score: 90, cost: 2, subsidy: 0 };
  // The actors' purses are not in the key: with money in them the reused proposal starts.
  const rich: GameState = { ...first, agency: { ...first.agency!, lastWalk: { ...walk, proposals: [proposal] },
    actors: first.agency!.actors.map(actor => ({ ...actor, funds: 10_000 })) } };
  const next = week(rich);
  const receipt = next.agency!.receipts.at(-1);
  assert.ok(receipt !== undefined, "a project started");
  assert.equal(receipt.reusedWalk, walk.tick);
  assert.equal(next.agency!.lastWalk, undefined, "a week that started something keeps no walk");
});

test("TA-13 a town short of its housing lots walks every week", () => {
  const growing = stuckTown(createGrowthOpening(1).state as GameState);
  assert.ok(growing.houses.length < 24);
  const first = advanceTownAgency(growing);
  const second = week(first);
  assert.equal(second.agency!.lastWalk!.tick, second.tick, "walked again");
});

test("TA-13 outside lord mode nothing changes", () => {
  const sandbox = { ...(createGrowthOpening(1).state as GameState), tick: WEEK };
  assert.equal(advanceTownAgency(sandbox), sandbox);
});
