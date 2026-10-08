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
import { POSSESSION_RENT_DETAIL, possessionRentLines, possessionRentSeason } from "../src/engine/possessionRent";
import { POSSESSION_RENT } from "../src/content/possessionConfig";
import { TITLE_RECOVERY_STRENGTH } from "../src/content/neighbourRulesConfig";
import { raiseClaim } from "../src/engine/estates";
import { advanceNeighbourRules } from "../src/engine/neighbourRules";
import { fileSuit, suitStageCost } from "../src/engine/estateSuits";
import { SUIT_STAGE_COST, SUIT_STAKE_PERMILLE } from "../src/content/estateConfig";
import { treasuryBalance } from "../src/ledger/ledger";
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
  // DTR-21: the keeper's share comes off (10 %).
  const quarter = Math.round(whole.value / 4);
  const net = quarter - Math.round(quarter * POSSESSION_RENT.keeperPermille / 1000);
  assert.equal(rents(after, whole.pieceId).reduce((sum, entry) => sum + entry.amount, 0), net);
  assert.equal(rents(possessionRentSeason(base), whole.pieceId).length, 0, "not his: no rent");
  const part = possessing(base, 500);
  const partQuarter = Math.round(part.value / 4);
  assert.equal(rents(possessionRentSeason(part.state), part.pieceId)[0]!.amount, partQuarter - Math.round(partQuarter * POSSESSION_RENT.keeperPermille / 1000));
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

test("DTR-21: while the title holder disputes the possession the tenants hold back half; the keeper's share is halved while the lord oversees an estate himself", () => {
  const base = run(lordGame(), 10);
  const { state, estateId, pieceId, value } = possessing(base);
  const quarter = Math.round(value / 4);
  const holder = estatesOf(state).estates.find(entry => entry.id === estateId)!.titleHolder;
  const disputed = raiseClaim(state, { claimant: holder, estateId, pieceId, basis: "inheritance" });
  const line = possessionRentLines(disputed).find(entry => entry.pieceId === pieceId)!;
  assert.equal(line.contested, true);
  assert.equal(line.withheld, Math.round(quarter * POSSESSION_RENT.contestedWithheldPermille / 1000));
  assert.equal(line.net, quarter - line.withheld - line.keeper);
  const direct: GameState = { ...state, stewardship: { ...(state.stewardship ?? { oversight: [] }) as NonNullable<GameState["stewardship"]>,
    oversight: [{ estateId: "x", mode: "direct", stewardId: "", auditMode: "visit", tenants: 0, merchants: 0, undetected: 0 } as never] } };
  assert.equal(possessionRentLines(direct).find(entry => entry.pieceId === pieceId)!.keeper, Math.round(quarter * POSSESSION_RENT.keeperDirectPermille / 1000));
});

test("DTR-21 (P-L3): the house that keeps a possessed piece's title claims its possession back and sues — a strong claim", () => {
  const base = run(lordGame(), 10);
  const { state, estateId, pieceId } = possessing(base);
  const holder = estatesOf(state).estates.find(entry => entry.id === estateId)!.titleHolder;
  // Over the years' turns the title holder claims it (a quarter's chance a year, by the seed).
  let next = state;
  let claim: ReturnType<typeof estatesOf>["claims"][number] | undefined;
  for (let year = 1; year <= 20 && claim === undefined; year += 1) {
    next = advanceNeighbourRules({ ...next, tick: year * 4_000 });
    claim = estatesOf(next).claims.find(entry => entry.claimant === holder && entry.pieceId === pieceId);
  }
  assert.ok(claim !== undefined, "the title holder claims it back within twenty years");
  assert.equal(claim!.strength, TITLE_RECOVERY_STRENGTH);
  assert.ok(estatesOf(next).suits.some(suit => suit.claimId === claim!.id && suit.defendant === LORD), "and sues the lord");
});

test("DTR-21: in lord mode a suit's stage costs a share of the stake's year (never under its fee); held against a judgment, a possession pays the lord nothing", () => {
  const base = run(lordGame(), 10);
  const { state, estateId, pieceId, value } = possessing(base);
  for (const stage of ["filed", "hearing", "enforcing"] as const) {
    assert.equal(suitStageCost(state, { estateId, pieceId }, stage), Math.max(SUIT_STAGE_COST[stage] ?? 0, Math.round(value * (SUIT_STAKE_PERMILLE[stage] ?? 0) / 1000)), stage);
  }
  const { agency: _agency, ...sandbox } = state;
  assert.equal(suitStageCost(sandbox as GameState, { estateId, pieceId }, "hearing"), SUIT_STAGE_COST.hearing, "elsewhere the fee");
  // The old house won its title back while the lord holds on: the tenants owe it, not him.
  const estates = estatesOf(state);
  const held: GameState = { ...state, estates: { ...estates, estates: estates.estates.map(entry => entry.id !== estateId ? entry
    : { ...entry, pieces: entry.pieces.map(piece => piece.id === pieceId ? { ...piece, titleHolder: entry.titleHolder, loss: "held_against_judgment" as const } : piece) }) } };
  const line = possessionRentLines(held).find(entry => entry.pieceId === pieceId)!;
  assert.deepEqual([line.net, line.withheld], [0, line.gross]);
});

test("DTR-21: sued, the lord pays his defence at the filing (what the treasury holds of it)", () => {
  const base = run(lordGame(), 10);
  const { state, estateId, pieceId } = possessing(base);
  const holder = estatesOf(state).estates.find(entry => entry.id === estateId)!.titleHolder;
  const claimed = raiseClaim(state, { claimant: holder, estateId, pieceId, basis: "inheritance" });
  const claim = estatesOf(claimed).claims.find(entry => entry.claimant === holder && entry.pieceId === pieceId)!;
  const filed = fileSuit(claimed, claim.id);
  const suit = estatesOf(filed).suits.find(entry => entry.claimId === claim.id)!;
  assert.equal(suit.defendant, LORD);
  const defence = (filed.ledger?.entries ?? []).filter(entry => entry.category === "lawsuit" && entry.sourceRefs.some(ref => String(ref.detail).includes(":defence:filed")));
  assert.equal(defence.reduce((sum, entry) => sum - entry.amount, 0), Math.min(suitStageCost(claimed, suit, "filed"), Math.max(0, treasuryBalance(claimed))));
});
