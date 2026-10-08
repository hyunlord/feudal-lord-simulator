/**
 * SUIT-THREAD (decision DTR-20; the user's instruction 2026-10-08): a judgment enforced puts a piece in the lord's hands,
 * and the piece's rent comes to him each season — the judgment's thread is that rent ("○○년 판결로").
 */
import assert from "node:assert/strict";
import test from "node:test";

import { HISTORY_TEMPLATES } from "../src/content/historyCopy.ko";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { advanceTrace, changedTargets, traceOf } from "../src/engine/decisionTrace";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { POSSESSION_RENT_DETAIL, possessionRentSeason } from "../src/engine/possessionRent";
import { advanceTick } from "../src/engine/tick";
import { newGameState } from "../src/state/newGame";

const lordGame = (): GameState => newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
const run = (state: GameState, ticks: number): GameState => { let next = state; for (let tick = 0; tick < ticks; tick += 1) next = advanceTick(next); return next; };
/** A neighbour's estate with one piece in the lord's hands (a judgment's possession). */
function possessing(state: GameState, share?: number): { readonly state: GameState; readonly estateId: string; readonly pieceId: string; readonly value: number } {
  const estates = estatesOf(state);
  const estate = estates.estates.find(entry => entry.offMap && entry.titleHolder !== LORD && entry.pieces.some(piece => piece.annualValue > 0))!;
  const piece = estate.pieces.find(entry => entry.annualValue > 0)!;
  const held = { ...piece, possessor: LORD, possessedSince: state.tick, ...(share === undefined ? {} : { scope: { sharePermille: share, ruledTick: state.tick, suitId: "suit-x" } }) };
  const next = { ...state, estates: { ...estates, estates: estates.estates.map(entry => entry.id !== estate.id ? entry
    : { ...entry, pieces: entry.pieces.map(other => other.id === piece.id ? held : other) }) } };
  return { state: next, estateId: estate.id, pieceId: piece.id, value: share === undefined ? piece.annualValue : Math.round(piece.annualValue * share / 1000) };
}
const rents = (state: GameState, pieceId: string) => (state.ledger?.entries ?? []).filter(entry => entry.category === "estate_income"
  && entry.sourceRefs.some(ref => ref.type === "right" && ref.id === pieceId && ref.detail === POSSESSION_RENT_DETAIL));

test("DTR-20: a piece the lord possesses of an estate he does not hold whole yields him a quarter of its year each season (a ruling's scope its share)", () => {
  const base = run(lordGame(), 10);
  const whole = possessing(base);
  const after = possessionRentSeason(whole.state);
  assert.equal(rents(after, whole.pieceId).reduce((sum, entry) => sum + entry.amount, 0), Math.round(whole.value / 4));
  assert.equal(rents(possessionRentSeason(base), whole.pieceId).length, 0, "not his: no rent");
  const part = possessing(base, 500);
  assert.equal(rents(possessionRentSeason(part.state), part.pieceId)[0]!.amount, Math.round(part.value / 4));
  const { agency: _agency, ...sandbox } = whole.state;
  assert.equal(possessionRentSeason(sandbox as GameState), sandbox, "lord mode only");
  // The season's step runs it (the stewardship's season, the tick a season starts).
  const season = run(whole.state, 1_000 - (whole.state.tick % 1_000));
  assert.equal(rents(season, whole.pieceId).length, 1);
});

test("DTR-20: a judgment enforced leaves the possession's rent as its target; the first rent after is its consequence, with the judgment's year", () => {
  const base = run(lordGame(), 10);
  const { state, estateId, pieceId } = possessing(base);
  const suit = { id: "suit-t", claimId: "claim-t", estateId, pieceId, plaintiff: LORD, defendant: "neighbour_1", stage: "enforcing", stageSince: 0,
    evidence: [], patronSupport: 0, enforcements: 0, costs: 0 } as unknown as NonNullable<GameState["estates"]>["suits"][number];
  const before: GameState = { ...base, estates: { ...estatesOf(base), suits: [suit] } };
  const enforced: GameState = { ...state, estates: { ...estatesOf(state), suits: [{ ...suit, enforced: true, stage: "closed" } as typeof suit] } };
  const target = `rent:${estateId}|${pieceId}`;
  assert.ok(changedTargets(before, enforced).includes(target));
  // A traced decision on that target, then the season's rent.
  const decided: GameState = { ...enforced, trace: { acts: [], decisions: [{ id: "h-judgment", tick: enforced.tick, by: "lord", kind: "suit", source: "enforce_possession:suit-t",
    weights: ["land"], targets: [target] }] } };
  const paid = possessionRentSeason({ ...decided, tick: decided.tick + 1 });
  const traced = advanceTrace(decided, paid);
  const record = traced.history!.records.find(entry => entry.template === "consequence" && entry.params?.key === "suit_rent")!;
  assert.ok(record !== undefined, "the rent is the judgment's consequence");
  assert.equal(record.because?.[0]?.decisionId, "h-judgment");
  assert.equal(record.params?.year, 1300);
  assert.match(HISTORY_TEMPLATES.consequence!(record.params!), /^1300년 판결로 점유한 땅에서 첫 지대 .+ 들어왔다$/);
  // Only the first.
  const again = advanceTrace(traced, possessionRentSeason({ ...traced, tick: traced.tick + 1 }));
  assert.equal(again.history!.records.filter(entry => entry.params?.key === "suit_rent").length, 1);
  assert.equal(traceOf(again).decisions.length, 1);
});
