/**
 * DEC-TRACE §3 (docs/design/dec-trace.md, A1·A3·A6, the user's decision 2026-10-06): a faction's mind becomes an act.
 * At a season's end in lord mode, each faction past ±30 that has moved on by 10 that way since its last act acts small
 * (once a year at most); past ±60, large (once in ten years at most). The acts (`FACTION_ACTS`) are real: households
 * come to the vacant houses or leave, an actor's purse grows or shrinks, the treasury gets a gift or pays a demand, the
 * lord's claims gain the overlord's favour, a neighbour raises a claim or sues. Each act is kept in the thread with the
 * decisions behind it (the faction's memories of the last three years that moved it that way, the largest first), and
 * the history writes it. The neighbour houses act by the same table (A3).
 */
import { FACTION_ACT_BALANCE as B, FACTION_ACTS, type FactionActDef, type FactionActEffect } from "../content/factionActConfig";
import { BALANCE, PRESSURE_BALANCE } from "../content/balanceConfig";
import { houseLotArea } from "../geometry/buildingFootprint";
import { postLedgerEntries } from "../ledger/ledger";
import type { SourceRef } from "../contracts";
import { becauseOf, traceOf, TRACE_LIVE_TICKS } from "./decisionTrace";
import { appendHistoryRecords } from "./history";
import type { FactionAct } from "./decisionTrace.types";
import type { GameState } from "./engine.types";
import { estatesOf, LORD, raiseClaim } from "./estates";
import { fileSuit } from "./estateSuits";
import type { FactionRecord } from "./faction.types";
import { estateYearIncome } from "./negotiation";
import { hashSeed } from "./prng";
import { settleNewcomers, vacantForNewcomers } from "./recovery";
import { abandonHouse } from "./seasonPressure";

const SEASON = PRESSURE_BALANCE.seasonTicks;
const YEAR = BALANCE.TICKS_PER_YEAR;

/** The decisions behind a faction's turn: its memories of the last three years that moved it this way, by size. */
export function actCauses(faction: FactionRecord, direction: 1 | -1, tick: number): { readonly causes: readonly string[]; readonly partial: boolean } {
  const shares = new Map<string, number>();
  let other = 0;
  for (const memory of faction.memory) {
    if (tick - memory.tick > TRACE_LIVE_TICKS || Math.sign(memory.delta) !== direction) continue;
    if (memory.decisionId === undefined) other += Math.abs(memory.delta);
    else shares.set(memory.decisionId, (shares.get(memory.decisionId) ?? 0) + Math.abs(memory.delta));
  }
  const causes = [...shares.entries()].sort((left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : 1)).map(([id]) => id);
  return { causes, partial: other > 0 || causes.length > 1 };
}

const money = (state: GameState, size: "small" | "large") => size === "small"
  ? Math.max(B.smallMoneyFloor, Math.round(estateYearIncome(state) * B.smallMoneyPermille / 1000))
  : Math.max(B.largeMoneyFloor, Math.round(estateYearIncome(state) * B.largeMoneyPermille / 1000));

/** The neighbour estate a neighbour faction's house holds (`neighbour_1` → `estate-neighbour-1`). */
const neighbourEstate = (factionId: string) => factionId.startsWith("neighbour_") ? `estate-neighbour-${factionId.slice("neighbour_".length)}` : null;

interface Applied { readonly state: GameState; readonly detail: Readonly<Record<string, string | number>> }

/** One effect, or null when it cannot be done now. */
function applyEffect(state: GameState, faction: FactionRecord, effect: FactionActEffect, causes: readonly string[]): Applied | null {
  const tick = state.tick;
  switch (effect.effect) {
    case "arrive": {
      const want = effect.households === "one" ? 1 : B.largeHouseholds;
      const lots = new Map(state.buildings.map(building => [building.id, building]));
      const vacant = state.houses.map((house, index) => ({ house, index })).filter(({ house }) => vacantForNewcomers(house, tick))
        .sort((left, right) => (left.house.abandonedTick ?? Infinity) - (right.house.abandonedTick ?? Infinity) || left.house.buildingId.localeCompare(right.house.buildingId))
        .slice(0, want);
      if (vacant.length === 0) return null;
      const houses = [...state.houses];
      for (const { house, index } of vacant) houses[index] = settleNewcomers(house, houseLotArea(lots.get(house.buildingId)), tick);
      return { state: { ...state, houses }, detail: { households: vacant.length } };
    }
    case "depart": {
      const want = effect.households === "one" ? 1 : B.largeHouseholds;
      const lived = state.houses.map((house, index) => ({ house, index }))
        .filter(({ house }) => house.residents > 0 && house.abandonedTick === undefined && house.leavingSinceTick === undefined)
        .sort((left, right) => hashSeed(state.seed, `faction-act:${faction.id}:${left.house.buildingId}`, tick) - hashSeed(state.seed, `faction-act:${faction.id}:${right.house.buildingId}`, tick)
          || left.house.buildingId.localeCompare(right.house.buildingId))
        .slice(0, want);
      if (lived.length === 0) return null;
      const houses = [...state.houses];
      for (const { house, index } of lived) houses[index] = abandonHouse(house, tick);
      return { state: { ...state, houses }, detail: { households: lived.length } };
    }
    case "actor_funds": {
      const agency = state.agency;
      const actor = agency?.actors.find(entry => entry.kind === effect.actor);
      if (agency === undefined || actor === undefined) return null;
      const amount = money(state, effect.size);
      const funds = Math.max(0, actor.funds + effect.sign * amount);
      if (funds === actor.funds) return null;
      return { state: { ...state, agency: { ...agency, actors: agency.actors.map(entry => entry === actor ? { ...entry, funds } : entry) } },
        detail: { actor: effect.actor, money: funds - actor.funds } };
    }
    case "treasury": {
      const amount = effect.sign * money(state, effect.size);
      const sources: [SourceRef, ...SourceRef[]] = [{ type: "actor", id: faction.id }, ...causes.slice(0, 3).map(id => ({ type: "decision" as const, id }))];
      const posted = postLedgerEntries(state, [{ account: "cash", category: amount > 0 ? "faction_gift" : "faction_demand", amount, sourceRefs: sources }]);
      return { state: { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin }, detail: { money: amount } };
    }
    case "claim_strength": {
      const estates = estatesOf(state);
      const open = estates.claims.filter(claim => claim.claimant === LORD && (claim.status === "open" || claim.status === "suing"));
      if (open.length === 0) return null;
      const add = effect.size === "small" ? B.favourStrength : B.confirmStrength;
      const claims = estates.claims.map(claim => open.includes(claim) ? { ...claim, strength: Math.min(100, claim.strength + add) } : claim);
      return { state: { ...state, estates: { ...estates, claims } }, detail: { claims: open.length, strength: add } };
    }
    case "claim_against": {
      const estateId = neighbourEstate(faction.id);
      const estate = estateId === null ? undefined : estatesOf(state).estates.find(entry => entry.id === estateId);
      if (estate === undefined || estate.titleHolder === LORD) return null;
      const taken = estate.pieces.filter(piece => piece.titleHolder === LORD);
      const already = estatesOf(state).claims.some(claim => claim.claimant === estate.titleHolder && claim.estateId === estate.id && (claim.status === "open" || claim.status === "suing"));
      if (taken.length === 0 || already) return null;
      const piece = taken[hashSeed(state.seed, `faction-act-claim:${estate.id}`, tick) % taken.length]!;
      let next = raiseClaim(state, { claimant: estate.titleHolder, estateId: estate.id, pieceId: piece.id, basis: "inheritance" });
      const claim = estatesOf(next).claims.find(entry => entry.claimant === estate.titleHolder && entry.estateId === estate.id && entry.pieceId === piece.id && entry.status === "open");
      if (claim === undefined) return null;
      if (effect.sue) next = fileSuit(next, claim.id);
      return { state: next, detail: { claim: claim.id, sued: effect.sue ? 1 : 0 } };
    }
  }
}

function act(state: GameState, faction: FactionRecord, def: FactionActDef, size: "small" | "large", direction: 1 | -1): GameState {
  const { causes, partial } = actCauses(faction, direction, state.tick);
  let applied: Applied | null = null;
  for (const effect of def.effects) {
    applied = applyEffect(state, faction, effect, causes);
    if (applied !== null) break;
  }
  // When nothing else can be done now, the mind still shows: a small gift or demand.
  applied ??= applyEffect(state, faction, { effect: "treasury", sign: direction, size: "small" }, causes)!;
  const trace = traceOf(applied.state);
  const record: FactionAct = { factionId: faction.id, tick: state.tick, size, direction, act: def.id, relation: faction.relation };
  const next: GameState = { ...applied.state, trace: { ...trace, acts: [...trace.acts, record] } };
  // The act in the history: the faction's, with the decisions that turned it (none when its mind moved by other causes, A2).
  return appendHistoryRecords(next, [{ tick: state.tick, kind: "faction", template: "faction.act", subject: { type: "faction", id: faction.id }, severity: 1,
    params: { faction: faction.id, name: faction.name, act: def.id, size, relation: faction.relation, ...applied.detail },
    ...(causes.length === 0 ? {} : { because: becauseOf(causes, "faction_act", partial) }) }]);
}

/** DEC-TRACE §3: the season's acts (lord mode, at a season's end), the factions in their order. */
export function advanceFactionActs(state: GameState): GameState {
  if (state.agency === undefined || state.factions === undefined || state.tick <= 0 || state.tick % SEASON !== 0) return state;
  let next = state;
  for (const faction of state.factions.factions) {
    const direction: 1 | -1 | 0 = faction.relation >= B.smallAt ? 1 : faction.relation <= -B.smallAt ? -1 : 0;
    if (direction === 0) continue;
    const row = FACTION_ACTS[faction.kind];
    const acts = traceOf(next).acts.filter(entry => entry.factionId === faction.id);
    const lastLarge = [...acts].reverse().find(entry => entry.size === "large");
    if (Math.abs(faction.relation) >= B.largeAt && (lastLarge === undefined || next.tick - lastLarge.tick >= B.largeEveryYears * YEAR)) {
      next = act(next, faction, direction > 0 ? row.favourLarge : row.grudgeLarge, "large", direction);
      continue;
    }
    const last = acts.at(-1);
    const lastThisWay = [...acts].reverse().find(entry => entry.direction === direction);
    if (last !== undefined && next.tick - last.tick < B.smallEveryYears * YEAR) continue;
    if (lastThisWay !== undefined && (faction.relation - lastThisWay.relation) * direction < B.smallStep) continue;
    next = act(next, faction, direction > 0 ? row.favourSmall : row.grudgeSmall, "small", direction);
  }
  return next;
}
