import type { GameState } from "../../../engine/engine.types";
import { estatesOf, LORD } from "../../../engine/estates";
import type { Claim, Suit, SuitStage } from "../../../engine/estates.types";
import { nextSuitStage, suitActions, suitFilingOutlook, suitHearing, type SuitHearing } from "../../../engine/estateSuits";
import { moneyShort } from "../../money.ko";
import { LORD_LEDGER_COPY as COPY } from "./ledgerCopy.ko";
import { dateLabel, holderName, onWhat, shut, would, type Shut } from "./ledgerWords";
import { defenceRow, evidenceRows, settledLine, type DefenceEvidenceRow, type DefenceRow } from "./suitDefenceModel";

// LM-R2 (ledger area) the suit track as rows: the lord's claims with the engine's filing outlook, his suits stage by stage,
// and the houses' suits against him. SUIT-THREAD (the engine's request render-suit-defence-lordplay2.md §1, §2, §4, §9):
// a claim's filing from `suitFilingOutlook` — its cost said even when refused (DTR-22: the writ's 60d), the refusal, the
// hearing it would open; a hearing's line from `suitHearing`'s `verdictNow` and `reachable`; the stages still ahead with
// their costs (`suitActions.stageCosts`) and each kind of evidence's cost and weight; the track a suit's own
// (`nextSuitStage`: a novel disseisin goes from its filing to the hearing); a suit against the lord with his defence
// (suitDefenceModel.ts) and its outcome named by who won and lost. No cost, weight or rule is copied here (P-D4).

/** The stages of a suit's track in order: the engine's next stage from the filing to the judgment, then enforcement. */
function trackStages(fast: boolean): readonly SuitStage[] {
  const stages: SuitStage[] = ["filed"];
  for (let stage = nextSuitStage({ stage: "filed", ...(fast ? { fast: true as const } : {}) }); stage !== undefined;
    stage = nextSuitStage({ stage, ...(fast ? { fast: true as const } : {}) })) stages.push(stage);
  return [...stages, "enforcing", "closed"];
}
/** The ordinary suit's track (ES-7). */
export const SUIT_TRACK: readonly SuitStage[] = trackStages(false);

/** `cost`: the treasury the filing takes (said even when refused); `hearing`: the hearing it would open, or null. */
export type ClaimRow = Readonly<{ id: string; what: string; line: string; novel: string | null; refusal: string | null; cost: string; hearing: string | null; focused: boolean }>;
export type TrackStep = Readonly<{ stage: SuitStage; label: string; at: "done" | "now" | "ahead" }>;
export type EvidenceRow = DefenceEvidenceRow;
export type PatronRow = Readonly<{ factionId: string; name: string; relation: string }>;
export type SuitRow = Readonly<{
  id: string; claimId: string; what: string; party: string; stage: SuitStage; since: string; track: readonly TrackStep[];
  costs: string; hearing: string | null; verdict: string | null;
  /** The concord that ended a suit against the lord (the engine's sentence and its date), or null. */
  settled: string | null;
  /** Evidence: every kind with what was given (its weight) or its cost, weight and refusal; null once judged or not the lord's. */
  evidence: readonly EvidenceRow[] | null;
  evidenceShut: string | null;
  /** The chosen patron, or the factions the engine would take now (patronage stage), or null outside it. */
  patron: Readonly<{ chosen: string | null; options: readonly PatronRow[] }> | null;
  enforce: Readonly<{ lines: readonly string[]; button: Shut | null }> | null;
  /** The stages still ahead and what each takes from the treasury (the lord's suits), or null. */
  stageCosts: string | null;
  /** The lord's defence in a suit against him while it stands, or null. */
  defence: DefenceRow | null;
  focused: boolean; neighbour: boolean;
}>;

function track(stage: SuitStage, fast: boolean): readonly TrackStep[] {
  const stages = trackStages(fast);
  const now = stages.indexOf(stage);
  return stages.map((entry, index) => ({ stage: entry, label: COPY.stages[entry], at: index < now ? "done" : index === now ? "now" : "ahead" }));
}

const hearingWords = (sides: SuitHearing) => COPY.hearing(sides.plaintiff, sides.defence, sides.verdictNow, sides.reachable);

/** The lord's open claim: the filing as it would go now (the engine's outlook). */
export function claimRow(state: GameState, claim: Claim, focus: string | null): ClaimRow {
  const outlook = suitFilingOutlook(state, claim.id);
  return { id: claim.id, what: onWhat(state, claim.estateId, claim.pieceId), line: COPY.claimLine(COPY.basis[claim.basis], claim.strength),
    novel: claim.novel === true ? COPY.novelLine : null, refusal: outlook.refusal === null ? null : COPY.refusals[outlook.refusal],
    cost: moneyShort(outlook.cost), hearing: outlook.hearing === null ? null : COPY.hearingIfFiled(hearingWords(outlook.hearing)), focused: focus === claim.id };
}

function stageCostLine(state: GameState, suit: Suit): string | null {
  if (suit.stage === "closed") return null;
  const parts = (suitActions(state, suit.id)?.stageCosts ?? []).filter(entry => entry.cost > 0)
    .map(entry => (entry.stage === "enforcing" ? COPY.stageCostEach : COPY.stageCost)(COPY.stages[entry.stage], moneyShort(entry.cost)));
  return parts.length === 0 ? null : COPY.stageCosts(parts.join(" · "));
}

export function suitRow(state: GameState, suit: Suit, claim: Claim | undefined, focus: string | null): SuitRow {
  const lords = suit.plaintiff === LORD;
  const judged = suit.verdict !== undefined;
  const sides = judged || suit.stage === "closed" ? null : suitHearing(state, suit.id);
  const house = holderName(state, suit.plaintiff);
  const defence = lords ? null : defenceRow(state, suit);
  const actions = lords && !judged ? suitActions(state, suit.id) : null;
  const evidence = actions === null ? null : evidenceRows(actions.evidence, claim?.evidence ?? []);
  const factions = state.factions?.factions ?? [];
  const options = !lords || suit.patron !== undefined || suit.stage !== "patronage" ? [] : factions
    .filter(entry => would(state, { type: "seek_suit_patron", suitId: suit.id, factionId: entry.id }))
    .map(entry => ({ factionId: entry.id, name: holderName(state, entry.id), relation: COPY.patronRelation(entry.relation) }));
  const patron = !lords ? null : suit.patron !== undefined ? { chosen: COPY.patronChosen(holderName(state, suit.patron), suit.patronSupport), options: [] }
    : suit.stage === "patronage" ? { chosen: null, options } : null;
  const enforcing = suit.stage === "enforcing" || suit.enforcements > 0;
  const enforce = !enforcing ? null : lords ? {
    lines: [...(suit.hold === undefined ? [] : [COPY.hold(suit.hold)]), COPY.patronForce(suit.patronSupport), COPY.attempts(suit.enforcements),
      ...(suit.enforced === true ? [COPY.enforced] : [])],
    button: suit.stage === "enforcing" ? shut(would(state, { type: "enforce_possession", suitId: suit.id })) : null,
  } : { lines: [COPY.attempts(suit.enforcements), ...(suit.enforced === true ? [COPY.enforcedBy(house)] : [])], button: null };
  return {
    id: suit.id, claimId: suit.claimId, what: onWhat(state, suit.estateId, suit.pieceId),
    party: lords ? COPY.against(holderName(state, suit.defendant)) : COPY.byNeighbour(house),
    stage: suit.stage, since: COPY.stageSince(COPY.stages[suit.stage], dateLabel(state, suit.stageSince)), track: track(suit.stage, suit.fast === true),
    costs: COPY.costs(moneyShort(suit.costs)),
    hearing: sides === null ? null : lords ? hearingWords(sides) : COPY.hearingAgainst(sides.plaintiff, sides.defence, sides.verdictNow, sides.reachable, defence?.open ?? false),
    verdict: suit.verdict === undefined ? null : lords ? COPY.verdict[suit.verdict] : COPY.verdictAgainst[suit.verdict](house),
    settled: settledLine(state, suit),
    evidence: evidence?.rows ?? null, evidenceShut: evidence?.shut ?? null, patron, enforce,
    stageCosts: lords ? stageCostLine(state, suit) : null, defence, neighbour: !lords,
    focused: focus !== null && (focus === suit.id || focus === suit.claimId),
  };
}

/** The lord's open claims, his suits (under way first, then the closed, newest first) and the houses' suits against him. */
export function suitsView(state: GameState, focus: string | null): Readonly<{ claims: readonly ClaimRow[]; suits: readonly SuitRow[]; neighbourSuits: readonly SuitRow[] }> {
  const estates = estatesOf(state);
  const claims = estates.claims.filter(claim => claim.claimant === LORD && claim.status === "open").map(claim => claimRow(state, claim, focus));
  const claimOf = (suit: Suit) => estates.claims.find(claim => claim.id === suit.claimId);
  const order = (a: Suit, b: Suit) => Number(a.stage === "closed") - Number(b.stage === "closed") || b.stageSince - a.stageSince;
  const suits = estates.suits.filter(suit => suit.plaintiff === LORD).slice().sort(order).map(suit => suitRow(state, suit, claimOf(suit), focus));
  const neighbourSuits = estates.suits.filter(suit => suit.plaintiff !== LORD && suit.defendant === LORD).slice().sort(order)
    .map(suit => suitRow(state, suit, claimOf(suit), focus));
  return { claims, suits, neighbourSuits };
}
