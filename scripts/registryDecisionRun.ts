// LM-E9 gates (spec docs/design/registry.md ER-5, ER-6): the lord's slice played by the lord-mode bot for twenty years
// (LM-E8's run), and every decision the lord took in order (tick, kind, command), the home petitions (kind, amount,
// party, who answered and how), and by the year the home petitions that reached the lord and those answered by
// precedent. Run it on two commits to compare their decision lists.
//   tsx scripts/registryDecisionRun.ts <seed> [years] > run.json
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

export function registryDecisionRun(seed: number, years = 20) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const startYear = stateCalendar(state).year;
  const decisions: { tick: number; kind: string; command: string }[] = [];
  while (stateCalendar(state).year < startYear + years) {
    for (const { kind, command } of lordBotCommands(state)) {
      const next = gameReducer(state, command);
      if (next === state) continue;
      state = next;
      decisions.push({ tick: state.tick, kind, command: JSON.stringify(command) });
    }
    state = advanceTick(state);
  }
  const homes = (state.stewardship?.petitions ?? []).filter(petition => petition.estateId === "estate-home")
    .map(petition => ({ tick: petition.tick, kind: petition.kind, amount: petition.amount, party: petition.party ?? "", status: petition.status,
      decidedBy: petition.decidedBy ?? "", precedent: petition.precedent === true }));
  const byYear: Record<number, { toLord: number; precedent: number }> = {};
  for (const petition of homes) {
    const year = stateCalendar({ ...state, tick: petition.tick }).year;
    byYear[year] ??= { toLord: 0, precedent: 0 };
    if (petition.precedent) byYear[year]!.precedent += 1; else byYear[year]!.toLord += 1;
  }
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
  return { seed, years, decisions: decisions.length, decisionsHash: hash(decisions), homes: homes.length, homesHash: hash(homes), byYear,
    homeDecisions: decisions.filter(decision => decision.kind === "estate_petition").length, decisionList: decisions, homeList: homes,
    registryOffers: (state.registry?.occurrences ?? []).length,
    occurrences: (state.registry?.occurrences ?? []).map(occurrence => ({ entry: occurrence.entryId, year: stateCalendar({ ...state, tick: occurrence.offeredTick }).year,
      status: occurrence.status, choice: occurrence.choiceId ?? "", bound: occurrence.boundId })),
    decisionsByYear: Object.fromEntries([...new Set(decisions.map(decision => stateCalendar({ ...state, tick: decision.tick }).year))]
      .map(year => [year, decisions.filter(decision => stateCalendar({ ...state, tick: decision.tick }).year === year).length])) };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed, years] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(registryDecisionRun(Number(seed ?? 1), years === undefined ? 20 : Number(years)), null, 1)}\n`);
}
