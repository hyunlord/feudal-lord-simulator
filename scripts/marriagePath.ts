// LM-E3 human path (spec docs/design/negotiation.md NG-10): a lord-mode town from 1300 on one land and seed, played by
// commands only — the chapters' answers as the bot gives them, then the marriage: offered as soon as a groom of the house
// is of age (FIX-12: again a year after a refusal) (a small portion, the counterpart's word on the inheritance, the bride's residence), its counter taken, every
// promise kept before its deadline, the will-change answered (`favour` by default, or `let_it_be` to sue), a contested
// estate sued for (the marriage deed, witnesses, the charter, the bishop as patron) and its possession enforced — to the
// inheritance or its loss. Reads only what the screens show (the APIs), never edits the state.
//   tsx scripts/marriagePath.ts <seed> [willAnswer=favour|support_promise|let_it_be] [archetypeId] > path.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { autoplayActionToGameAction } from "../src/engine/autoplayActions";
import { chapterDecisionAction } from "../src/engine/autoplayEvents";
import type { Term } from "../src/engine/diplomacy.types";
import type { GameState } from "../src/engine/engine.types";
import { estateById, estatesOf, LORD } from "../src/engine/estates";
import { historySummary } from "../src/engine/history";
import { marriageCandidates, marriageDecisionDue, MARRIAGE_ESTATE_ID } from "../src/engine/marriage";
import { diplomacyOf } from "../src/engine/negotiation";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { initialAgency } from "../src/engine/townAgency";
import { treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";
import { createGrowthOpening } from "./phase21OpeningTranslation";

/** The player's first offer: a small portion, and the counterpart's word on the inheritance and the bride's residence. */
export const FIRST_OFFER: readonly Term[] = [
  { kind: "cash", giver: "proposer", amount: 200 },
  { kind: "inheritance_non_infringement", giver: "counterpart" },
  { kind: "residence", giver: "counterpart" },
];

export interface MarriagePathOptions {
  readonly seed: number;
  readonly willAnswer?: "favour" | "support_promise" | "let_it_be";
  readonly archetypeId?: string;
  readonly lastYear?: number;
  /** LM-E4: hand back the state at the end too (the stewardship's path and comparison start from the inheritance). */
  readonly keepState?: boolean;
}

export function marriagePath(options: MarriagePathOptions) {
  let state: GameState = { ...(createGrowthOpening(options.seed, options.archetypeId ?? "core:open_field").state as GameState), agency: initialAgency() };
  const commands: { year: number; command: string }[] = [];
  const send = (action: Parameters<typeof gameReducer>[1], label: string) => {
    const next = gameReducer(state, action);
    if (next !== state) commands.push({ year: stateCalendar(next).year, command: label });
    state = next;
  };
  const lastYear = options.lastYear ?? 1325;
  let offers = 0;
  // FIX-12: a refused offer is made again a year later (the lord's estates' year may carry a counter's yearly dues then).
  let lastOffer = -Infinity;
  while (stateCalendar(state).year <= lastYear) {
    const stage = diplomacyOf(state).marriage?.stage;
    // FIX-13: the path ends with the estate's fate and the lord's promises settled (a debt repaid after the inheritance).
    const owing = diplomacyOf(state).promises.some(entry => entry.status === "open" && entry.promisor === LORD);
    if ((stage === "inherited" || stage === "lost") && !owing) break;
    // The chapters' answers, as the bot gives them (commands).
    const answer = chapterDecisionAction(state, "relief", "accept", "pay");
    const answered = answer === null ? null : autoplayActionToGameAction(answer, state);
    if (answered !== null) send(answered, answered.type);
    if (state.tick % 78 === 2) {
      const diplomacy = diplomacyOf(state);
      const countered = diplomacy.negotiations.find(entry => entry.status === "countered");
      if (countered !== undefined) send({ type: "answer_counter", negotiationId: countered.id, accept: true }, "answer_counter");
      else if (diplomacy.marriage === undefined && offers < 8 && state.tick - lastOffer >= 4000 && marriageCandidates(state).groom !== null && marriageCandidates(state).bride !== null) {
        offers += 1;
        lastOffer = state.tick;
        const cash = Math.min(200 * offers, Math.max(0, treasuryBalance(state) - 100));
        send({ type: "propose_marriage", terms: FIRST_OFFER.map(term => term.kind === "cash" ? { ...term, amount: cash } : term) }, `propose_marriage(${cash})`);
      }
      // Every promise kept as soon as the treasury carries it (support at once).
      for (const promise of diplomacyOf(state).promises.filter(entry => entry.status === "open" && entry.promisor === LORD && (entry.amount ?? 0) <= treasuryBalance(state))) {
        send({ type: "keep_promise", promiseId: promise.id }, `keep_promise(${promise.term})`);
      }
      if (marriageDecisionDue(state) === "will_change") send({ type: "answer_will_change", choice: options.willAnswer ?? "favour" }, `answer_will_change(${options.willAnswer ?? "favour"})`);
      if (marriageDecisionDue(state) === "contested") {
        const plan = diplomacyOf(state).marriage!;
        const suit = estatesOf(state).suits.find(entry => entry.claimId === plan.claimId);
        if (suit === undefined) send({ type: "file_suit", claimId: plan.claimId }, "file_suit");
        else if (suit.stage === "filed" || suit.stage === "evidence") {
          for (const evidence of ["deed", "witnesses", "charter"] as const) send({ type: "add_suit_evidence", suitId: suit.id, evidence }, `add_suit_evidence(${evidence})`);
        } else if (suit.stage === "patronage" && suit.patron === undefined) send({ type: "seek_suit_patron", suitId: suit.id, factionId: "bishop" }, "seek_suit_patron(bishop)");
        else if (suit.stage === "enforcing") send({ type: "enforce_possession", suitId: suit.id }, "enforce_possession");
      }
    }
    state = advanceTick(state);
  }
  const diplomacy = diplomacyOf(state);
  const estate = estateById(state, MARRIAGE_ESTATE_ID)!;
  const year = (tick: number) => stateCalendar({ ...state, tick }).year;
  return {
    seed: options.seed, willAnswer: options.willAnswer ?? "favour",
    stage: diplomacy.marriage?.stage ?? null,
    events: Object.fromEntries(Object.entries(diplomacy.marriage?.events ?? {}).filter(([, tick]) => tick !== undefined && tick >= 0).map(([event, tick]) => [event, year(tick!)])),
    estate: { titleHolder: estate.titleHolder, possessor: estate.possessor },
    negotiations: diplomacy.negotiations.map(entry => ({ id: entry.id, status: entry.status, tier: entry.acceptance.tier, score: entry.acceptance.score,
      top: entry.acceptance.top.map(reason => `${reason.name}${reason.value >= 0 ? "+" : ""}${reason.value}`).join(" "),
      counter: entry.counter === undefined ? null : { tier: entry.counter.acceptance.tier, score: entry.counter.acceptance.score, changes: entry.counter.changes } })),
    promises: diplomacy.promises.map(entry => ({ id: entry.id, term: entry.term, promisor: entry.promisor, amount: entry.amount ?? 0, status: entry.status })),
    commands,
    ledger: (state.history?.records ?? []).filter(record => /^(negotiation|promise|marriage|estate)\./.test(record.template))
      .map(record => `${year(record.tick)} ${historySummary(record)}`),
    finalYear: stateCalendar(state).year,
    ...(options.keepState === true ? { state } : {}),
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed, willAnswer, archetypeId] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(marriagePath({ seed: Number(seed ?? 1), ...(willAnswer === undefined ? {} : { willAnswer: willAnswer as "favour" }),
    ...(archetypeId === undefined ? {} : { archetypeId }) }), null, 1)}\n`);
}
