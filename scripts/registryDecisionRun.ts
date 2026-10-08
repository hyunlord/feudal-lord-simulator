// LM-E9 gates (spec docs/design/registry.md ER-5, ER-6): the lord's slice played by the lord-mode bot for twenty years
// (LM-E8's run), and every decision the lord took in order (tick, kind, command), the home petitions (kind, amount,
// party, who answered and how), and by the year the home petitions that reached the lord and those answered by
// precedent. Run it on two commits to compare their decision lists.
//   tsx scripts/registryDecisionRun.ts <seed> [years] > run.json
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRegistryDecisionObservation } from "./registryDecisionObservation";
import { createRegistryOccurrenceCollector } from "./registryDecisionOccurrences";
import { createRegistryPresentationCollector } from "./registryDecisionPresentations";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { ASKED_KINDS, lordBotCommands, type LordDecisionKind } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

export function registryDecisionRun(seed: number, years = 20) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const startYear = stateCalendar(state).year;
  const archive = createRegistryOccurrenceCollector();
  const presentations = createRegistryPresentationCollector();
  const observation = createRegistryDecisionObservation();
  archive.observe(state.registry?.occurrences ?? []);
  presentations.observe(state);
  observation.observe(state);
  const decisions: { tick: number; kind: LordDecisionKind; command: string }[] = [];
  while (stateCalendar(state).year < startYear + years) {
    for (const { kind, command } of lordBotCommands(state)) {
      const next = gameReducer(state, command);
      if (next === state) continue;
      state = next;
      archive.observe(state.registry?.occurrences ?? []);
      presentations.observe(state);
      observation.observe(state);
      decisions.push({ tick: state.tick, kind, command: JSON.stringify(command) });
    }
    state = advanceTick(state);
    archive.observe(state.registry?.occurrences ?? []);
    presentations.observe(state);
    observation.observe(state);
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
  const allOccurrences = archive.snapshot();
  const presentationRecords = presentations.snapshot().map(record => ({ ...record,
    firstObservedYear: stateCalendar({ ...state, tick: record.firstObservedTick }).year,
    lastObservedYear: stateCalendar({ ...state, tick: record.lastObservedTick }).year }));
  const endYearExclusive = startYear + years;
  const annualDensity = Array.from({ length: years }, (_, offset) => {
    const year = startYear + offset;
    const commands = decisions.filter(decision => stateCalendar({ ...state, tick: decision.tick }).year === year);
    const arrivals = presentationRecords.filter(record => record.firstObservedYear === year);
    return { year, allCommands: commands.length, askedCommandResponses: commands.filter(command => ASKED_KINDS.has(command.kind)).length,
      arrivedDecisionItems: arrivals.length, townRequestEpisodes: arrivals.filter(record => record.identityBasis === "observed_episode").length };
  });
  const finalOccurrences = state.registry?.occurrences ?? [];
  const retainedIds = new Set(finalOccurrences.map(occurrence => occurrence.id));
  const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
  return { seed, years, startYear, endYearExclusive, gp7Observation: observation.snapshot(),
    presentationObservation: { scope: "arrived_decision_queue_items", observation: "initial_and_each_successful_command_and_tick",
      townIdentity: "continuous_kind_and_payload_episode_not_engine_occurrence_id", statuses: "observed_presence_only_not_settlement_reason",
      boundaryItems: presentationRecords.filter(record => record.firstObservedYear < startYear || record.firstObservedYear >= endYearExclusive).length },
    presentations: presentationRecords, annualDensity, decisions: decisions.length, decisionsHash: hash(decisions), homes: homes.length, homesHash: hash(homes), byYear,
    homeDecisions: decisions.filter(decision => decision.kind === "estate_petition").length, decisionList: decisions, homeList: homes,
    registryOffers: allOccurrences.length,
    occurrenceRetention: { scope: "entire_run_observed", statuses: "latest_observed", observation: "initial_and_each_successful_command_and_tick",
      observed: allOccurrences.length, finalStateRetained: finalOccurrences.length,
      absentFromFinalState: allOccurrences.filter(occurrence => !retainedIds.has(occurrence.id)).length,
      openWhenLastObservedAndAbsent: allOccurrences.filter(occurrence => !retainedIds.has(occurrence.id) && occurrence.status === "offered").length },
    occurrences: allOccurrences.map(occurrence => ({ id: occurrence.id, source: occurrence.source ?? "legacy", offeredTick: occurrence.offeredTick,
      settledTick: occurrence.settledTick ?? null, entry: occurrence.entryId, year: stateCalendar({ ...state, tick: occurrence.offeredTick }).year,
      status: occurrence.status, choice: occurrence.choiceId ?? "", bound: occurrence.boundId })),
    decisionsByYear: Object.fromEntries([...new Set(decisions.map(decision => stateCalendar({ ...state, tick: decision.tick }).year))]
      .map(year => [year, decisions.filter(decision => stateCalendar({ ...state, tick: decision.tick }).year === year).length])) };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed, years] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(registryDecisionRun(Number(seed ?? 1), years === undefined ? 20 : Number(years)), null, 1)}\n`);
}
