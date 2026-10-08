// SUIT-THREAD balance (A6; the user's request 2026-10-08): is going to law always the lord's gain? The lord's slice played
// by the lord-mode bot, counted by the year: the suits the lord files, judgments he enforces, the claims and suits the
// neighbours bring against him, what the suits cost (ledger `lawsuit`), what his possessions pay (`estate_income` from a
// possession), the treasury, the neighbour houses' minds. Reads only the game's state.
//   tsx scripts/suitBalanceProbe.ts <seed> [years] > out.json
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { lordBotCommands } from "../src/engine/lordBot";
import { POSSESSION_RENT_DETAIL, possessionRentLines } from "../src/engine/possessionRent";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

interface YearRow {
  year: number; suitsFiled: number; enforced: number; enforceFailed: number; claimsAgainst: number; suitsAgainst: number; lost: number;
  suitCost: number; rent: number; withheld: number; keeper: number; contestedSeasons: number; treasury: number; possessed: number; neighbours: Record<string, number>;
}

export function suitBalanceProbe(seed: number, years = 125) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const start = stateCalendar(state).year;
  const rows: YearRow[] = [];
  const blank = (year: number): YearRow => ({ year, suitsFiled: 0, enforced: 0, enforceFailed: 0, claimsAgainst: 0, suitsAgainst: 0, lost: 0, suitCost: 0, rent: 0, withheld: 0, keeper: 0, contestedSeasons: 0, treasury: 0, possessed: 0, neighbours: {} });
  let row = blank(start);
  while (stateCalendar(state).year < start + years) {
    // The commands' own lines (a suit's filing and its costs) count with the tick's.
    const before = state;
    for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
    // DTR-21: what the season's rent holds back and the keeper takes (the same lines the season posts).
    if (state.tick > 0 && (state.tick + 1) % 1_000 === 0) for (const line of possessionRentLines({ ...state, tick: state.tick + 1 })) {
      row.withheld += line.withheld; row.keeper += line.keeper; if (line.contested) row.contestedSeasons += 1;
    }
    state = advanceTick(state);
    for (const after of [state]) {
      const was = new Map(estatesOf(before).suits.map(suit => [suit.id, suit] as const));
      for (const suit of estatesOf(after).suits) {
        const old = was.get(suit.id);
        if (old === undefined) { if (suit.plaintiff === LORD) row.suitsFiled += 1; else if (suit.defendant === LORD) row.suitsAgainst += 1; continue; }
        if (suit.enforcements > old.enforcements) { if (suit.enforced === true) row.enforced += 1; else row.enforceFailed += 1; }
        if (suit.verdict !== undefined && old.verdict === undefined && ((suit.plaintiff === LORD && suit.verdict === "defendant") || (suit.defendant === LORD && suit.verdict === "plaintiff"))) row.lost += 1;
      }
      const claims = new Set(estatesOf(before).claims.map(claim => claim.id));
      for (const claim of estatesOf(after).claims) if (!claims.has(claim.id) && claim.claimant !== LORD) row.claimsAgainst += 1;
      const fresh = after.ledger === before.ledger || after.ledger === undefined ? 0 : after.ledger.nextEntryOrdinal - (before.ledger?.nextEntryOrdinal ?? 1);
      for (const entry of fresh <= 0 ? [] : after.ledger!.entries.slice(-fresh)) {
        if (entry.category === "lawsuit") row.suitCost -= entry.amount;
        if (entry.category === "estate_income" && entry.sourceRefs.some(ref => ref.type === "right" && ref.detail === POSSESSION_RENT_DETAIL)) row.rent += entry.amount;
      }
    }
    const year = stateCalendar(state).year;
    if (year !== row.year) {
      row.treasury = treasuryBalance(state);
      row.possessed = estatesOf(state).estates.filter(estate => estate.offMap && !(estate.titleHolder === LORD && estate.possessor === LORD))
        .reduce((sum, estate) => sum + (estate.possessor === LORD ? 1 : estate.pieces.filter(piece => piece.possessor === LORD).length), 0);
      for (const faction of state.factions?.factions ?? []) if (faction.id.startsWith("neighbour")) row.neighbours[faction.id] = faction.relation;
      rows.push(row);
      row = blank(year);
    }
  }
  const sum = (key: keyof YearRow) => rows.reduce((total, entry) => total + Number(entry[key]), 0);
  return { seed, years, totals: { suitsFiled: sum("suitsFiled"), enforced: sum("enforced"), enforceFailed: sum("enforceFailed"), claimsAgainst: sum("claimsAgainst"),
    suitsAgainst: sum("suitsAgainst"), lost: sum("lost"), suitCost: sum("suitCost"), rent: sum("rent"), withheld: sum("withheld"), keeper: sum("keeper"), contestedSeasons: sum("contestedSeasons") }, rows };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed = "1", years = "125"] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(suitBalanceProbe(Number(seed), Number(years)))}\n`);
}
