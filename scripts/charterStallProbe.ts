// GROW-BLOCK diagnosis (the user's ruling 2026-10-09: towns frozen ~100 years at 528): the lord's slice played by the
// lord-mode bot to a year; each year the market charter's state (its requirements met, the town's search tried and
// failed, the palisade). At the first year the search has failed with every requirement met, the state is saved and
// every palisade candidate is inspected without the bot's eight-candidate budget — why each was refused: the projection
// refused (the proclamation's own rules), the service space it would take, the lots' room, the route access.
//   tsx scripts/charterStallProbe.ts <seed> <years> <outDir>
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { preservesAutoplayServiceSpace } from "../src/engine/autoplayServiceSpace";
import { wallRoom } from "../src/engine/autoplayWallRoom";
import type { GameState } from "../src/engine/engine.types";
import { canProclaimPalisadeEra } from "../src/engine/era";
import { lordBotCommands } from "../src/engine/lordBot";
import { confirmPalisadeProclamation } from "../src/engine/palisade";
import { computePalisadeProposalForState } from "../src/engine/palisadeFootprints";
import { previewPalisadeRouteAccess } from "../src/engine/palisadeRouteAccess";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { LORD_MODE_POLICY } from "../src/engine/townAgency";
import { encodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

type Path = Parameters<typeof confirmPalisadeProclamation>[1];

/** Every candidate the search would try, each with why it was refused (or accepted). */
export function inspectCharterCandidates(state: GameState) {
  const remaining = LORD_MODE_POLICY.maxHousingLots - state.houses.length;
  const rows: { perimeter: number; projected: boolean; serviceSpace: boolean; roomy: boolean; unreachable: number; unavailable: number }[] = [];
  computePalisadeProposalForState(state, (path: Path) => {
    const projected = confirmPalisadeProclamation(state, path);
    const refused = projected === state;
    const serviceSpace = !refused && preservesAutoplayServiceSpace(state, { kind: "proclaim_era" }, projected);
    const roomy = remaining <= 0 || wallRoom(state, path, remaining).roomy;
    const access = previewPalisadeRouteAccess(state, path);
    rows.push({ perimeter: path.length, projected: !refused, serviceSpace, roomy, unreachable: access.unreachableSiteIds.length, unavailable: access.unavailableSiteIds.length });
    return false;
  });
  const count = (test: (row: (typeof rows)[number]) => boolean) => rows.filter(test).length;
  return { candidates: rows.length, refusedProjection: count(row => !row.projected), serviceSpace: count(row => row.projected && !row.serviceSpace),
    notRoomy: count(row => !row.roomy), routeAccess: count(row => row.unreachable + row.unavailable > 0),
    acceptable: count(row => row.projected && row.serviceSpace && row.roomy && row.unreachable + row.unavailable === 0), rows: rows.slice(0, 40) };
}

export function charterStallProbe(seed: number, years: number, outDir: string) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const start = stateCalendar(state).year;
  const yearsLog: Record<string, unknown>[] = [];
  let stalled: { year: number; inspection: ReturnType<typeof inspectCharterCandidates> } | null = null;
  let lastYear = start;
  while (stateCalendar(state).year < start + years) {
    for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
    state = advanceTick(state);
    const year = stateCalendar(state).year;
    if (year === lastYear) continue;
    lastYear = year;
    const ready = canProclaimPalisadeEra(state);
    const tried = state.agency?.charterWallTried !== undefined;
    yearsLog.push({ year, population: state.population, houses: state.houses.length, era: state.era, ready, tried, palisade: state.palisade?.polygon?.length ?? 0,
      sites: state.constructionSites.length });
    if (stalled === null && ready && tried && state.era === "hamlet") {
      mkdirSync(outDir, { recursive: true });
      const now = new Date().toISOString();
      writeFileSync(`${outDir}/stall-seed${seed}-${year}.save.json`, encodeSave({ state, createdAt: now, savedAt: now }).bytes);
      stalled = { year, inspection: inspectCharterCandidates(state) };
    }
  }
  return { seed, years, stalled, years_: yearsLog };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed = "1", years = "30", outDir = "output/grow"] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(charterStallProbe(Number(seed), Number(years), outDir))}\n`);
}
