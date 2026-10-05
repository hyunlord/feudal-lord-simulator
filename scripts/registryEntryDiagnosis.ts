// LM-E9 (spec docs/design/registry.md ER-3, ER-10): why a registry entry is or is not offered in the lord's slice played
// by the lord-mode bot. At each season's start, for every entry outside the home cycle: in its years, a target to bind,
// its conditions held (for some target), the seed's draw under its chance, offered. With the season counts, the state the
// conditions read (market and dues, suits by stage and evidence, pending audits, delegated estates, the steward's lord
// decisions, the policy). The file is rewritten every ten years, so a long run leaves its part if it is stopped.
//   tsx scripts/registryEntryDiagnosis.ts <seed> <years> <out.json>
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf } from "../src/engine/estates";
import { lordBotCommands } from "../src/engine/lordBot";
import { hashSeed } from "../src/engine/prng";
import { boundTargets, conditionHolds, registryEntries, registryOf } from "../src/engine/registry";
import { bindEntry, registryV4Support, v4Entry } from "../src/engine/registryV4";
import { stateCalendar } from "../src/engine/scenarioState";
import { pendingAudits, stewardshipOf } from "../src/engine/stewardship";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const SEASON = 1_000;

interface Count { inYears: number; withTarget: number; conditionsHeld: number; drawPassed: number; offered: number; firstHeldYear: number | null }

export function registryEntryDiagnosis(seed: number, years: number, out?: string) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
  const startYear = stateCalendar(state).year;
  const entries = registryEntries().filter(entry => entry.generator === undefined && entry.kind !== "annual_rule");
  const counts: Record<string, Count> = Object.fromEntries(entries.map(entry => [entry.id, { inYears: 0, withTarget: 0, conditionsHeld: 0, drawPassed: 0, offered: 0, firstHeldYear: null }]));
  const world: { year: number; season: number; market: boolean; dues: number | null; suits: string[]; pendingAudits: string[]; delegated: number; lordDecided: number; policy: string | null; lordPieces: number; neighbourPieces: number; lordClaims: number }[] = [];
  let lastWritten = startYear;
  const result = () => ({ seed, years, reachedYear: stateCalendar(state).year, counts, world });
  while (stateCalendar(state).year < startYear + years) {
    for (const { command } of lordBotCommands(state)) {
      const next = gameReducer(state, command);
      if (next !== state) state = next;
    }
    state = advanceTick(state);
    if (state.tick % SEASON !== 0) continue;
    const year = stateCalendar(state).year;
    const index = Math.floor(state.tick / SEASON);
    for (const entry of entries) {
      if (year < entry.years.fromYear || year > entry.years.toYear) continue;
      const count = counts[entry.id]!;
      count.inYears += 1;
      const targets = boundTargets(state, entry);
      if (targets.length > 0) count.withTarget += 1;
      const held = targets.filter(boundId => conditionHolds(state, entry.conditions, boundId));
      if (held.length > 0) { count.conditionsHeld += 1; count.firstHeldYear ??= year; }
      if (held.some(boundId => hashSeed(state.seed, `registry:${entry.id}:${boundId}`, index) % 1000 < entry.frequency.chancePermille)) count.drawPassed += 1;
      if (registryOf(state).occurrences.some(occurrence => occurrence.entryId === entry.id && occurrence.offeredTick === state.tick)) count.offered += 1;
    }
    // LM-E9b: the canon v4's running entries — in their window, bound (conditions held), drawn under their chance, offered.
    for (const support of registryV4Support().filter(item => item.runs)) {
      const entry = v4Entry(support.id)!;
      if (year < entry.calendar.yearMinInclusive || year > entry.calendar.yearMaxInclusive) continue;
      const count = counts[entry.id] ??= { inYears: 0, withTarget: 0, conditionsHeld: 0, drawPassed: 0, offered: 0, firstHeldYear: null };
      count.inYears += 1;
      if (bindEntry(state, entry) !== null) { count.conditionsHeld += 1; count.firstHeldYear ??= year; }
      if (hashSeed(state.seed, `registry-v4:${entry.id}`, index) % 1000 < entry.frequency.chancePermille) count.drawPassed += 1;
      if (registryOf(state).occurrences.some(occurrence => occurrence.entryId === entry.id && occurrence.offeredTick === state.tick)) count.offered += 1;
    }
    const estates = estatesOf(state);
    const stewardship = stewardshipOf(state);
    world.push({ year, season: Math.floor((state.tick % 4_000) / SEASON), market: state.buildings.some(building => building.kind === "market"),
      dues: state.agency?.duesPermille ?? null,
      suits: estates.suits.filter(suit => suit.stage !== "closed")
        .map(suit => `${suit.id}:${suit.stage}:${(estates.claims.find(claim => claim.id === suit.claimId)?.evidence ?? []).map(evidence => evidence.kind).join("+")}`),
      pendingAudits: pendingAudits(state).map(audit => `${audit.id}:kept${audit.revealedKept ?? -1}`), delegated: stewardship.oversight.filter(entry => entry.mode === "steward").length,
      lordDecided: stewardship.petitions.filter(petition => petition.estateId !== "estate-home" && petition.decidedBy === "lord").length, policy: state.agency?.policy ?? null,
      // ER-21: the neighbour estates' pieces the lord holds, of all their pieces, and the lord's claims raised so far.
      lordPieces: estates.estates.filter(estate => estate.offMap).flatMap(estate => estate.pieces).filter(piece => piece.titleHolder === "lord").length,
      neighbourPieces: estates.estates.filter(estate => estate.offMap).flatMap(estate => estate.pieces).length,
      lordClaims: estates.claims.filter(claim => claim.claimant === "lord").length });
    if (out !== undefined && year >= lastWritten + 10) { lastWritten = year; writeFileSync(out, `${JSON.stringify(result())}\n`); }
  }
  if (out !== undefined) writeFileSync(out, `${JSON.stringify(result())}\n`);
  return result();
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [seed, years, out] = process.argv.slice(2);
  registryEntryDiagnosis(Number(seed ?? 1), Number(years ?? 125), out);
}
