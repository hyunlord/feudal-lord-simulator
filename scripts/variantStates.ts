// ER-13 wording variants: the lord-mode states the variant cards' geometry rows open on (the set `variants`,
// src/ui/decisionCard/surfaces.ts), from the lord's slice as the lord bot plays it (seed 3, as scripts/lordSliceRun.ts;
// core:forest_edge for 041, the only land its pannage words read), the lord keeping the three home kinds the variants
// dress — the standing policy 영주에게 (`set_standing_policy`, DTR-1), a choice the player has — so they come to him:
//  - `home-041`, `home-048`, `home-056`: the first tick a pannage / common-pasture / road petition is the one the lord is
//    shown (`openHomePetitions(state)[0]`) with its variant's words (`estatePetitionVariantFor`), before he acts. None by
//    the slice's twenty years (or its end) → prepared: the slice's middle year on to a tick of the variant's seasons with nothing
//    waiting, one petition of the kind placed as the engine raises one (homePetitionSeason's shape, the kind's least sum),
//    for 048 the town's smallest field zone made a pasture if it has none — `prepared` in states.json; a variant that
//    holds neither way fails the script.
//  - `registry-067`, `registry-078`: prepared. A tick of the same play (from its middle year) with nothing waiting, the lord holding the first
//    neighbour estate (title and possession) under a serving steward with two candidates, as tests/registryVariants.test.ts
//    makes them (the able, merchant-minded; the loyal, peasant-minded); for 019 the estates kept direct, and all three
//    neighbours held so the lord's attention is over its capacity. The offer 031 / 019 is made as offerV4Season makes a
//    candidate (`v4Candidates`) — its conditions held, bound, two answers it can carry out — but not left to the season's
//    draw; the variant must hold on it (`registryVariantFor`).
// Beside them states.json (each: seed, land, tick, year, season, the petition or offer, natural or prepared).
//   tsx scripts/variantStates.ts <out-dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 조각 봇 판(scripts/variantStates.ts)", { remote: "scripts/remote/run.sh render-VARIANTS-captures-<sha7> --light -- bash scripts/variantCaptures.sh", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HOME_ESTATE_ID } from "../src/content/estateConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { HOME_PETITION_VARIANTS } from "../src/content/registry/registryVariantConfig";
import { HOME_PETITION_KINDS, PETITION_ANSWER_TICKS } from "../src/content/stewardshipConfig";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf } from "../src/engine/estates";
import { seasonIndexOf } from "../src/engine/eventSchedule";
import { lordBotCommands } from "../src/engine/lordBot";
import { lordSliceOutcome } from "../src/engine/lordSlice";
import { REGISTRY_ANSWER_TICKS, registryOf } from "../src/engine/registry";
import type { RegistryOccurrence } from "../src/engine/registry.types";
import { holds } from "../src/engine/registryDsl";
import { bindEntry, boundIdentities, contextKey, dedupKey, v4EnabledChoices, v4Entry } from "../src/engine/registryV4";
import { estatePetitionVariantFor, registryVariantFor } from "../src/engine/registryVariants";
import { stateCalendar } from "../src/engine/scenarioState";
import { attention, stewardshipOf } from "../src/engine/stewardship";
import type { EstatePetition, HomePetitionKind, StewardRecord } from "../src/engine/stewardship.types";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { openHomePetitions } from "../src/ui/lordCardsModel";
import { openRegistryCards } from "../src/ui/registryCardModel";

const SEED = 3;
const YEARS = 20;
const out = process.argv[2];
if (out === undefined) throw new Error("usage: tsx scripts/variantStates.ts <out-dir>");
mkdirSync(out, { recursive: true });
const about: Record<string, Record<string, unknown>> = {};
const save = (name: string, state: GameState, what: Record<string, unknown>) => {
  const date = stateCalendar(state);
  about[name] = { seed: SEED, tick: state.tick, year: date.year, season: date.season, ...what };
  writeFileSync(join(out, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick} (${date.year}): ${JSON.stringify(what)}\n`);
};
const step = (state: GameState): GameState => {
  let next = state;
  for (const { command } of lordBotCommands(next)) next = gameReducer(next, command);
  return advanceTick(next);
};

type Shown = { readonly state: GameState; readonly petitionId: string };
/** The slice on a land, the lord keeping `kinds`: per kind its first petition shown with the variant, and its first shown. */
function play(land: string | undefined, kinds: readonly HomePetitionKind[]) {
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: SEED, ...(land === undefined ? {} : { archetypeId: land }) });
  if (state === null) throw new Error(`no game on ${land ?? "the slice's land"}`);
  for (const kind of kinds) state = gameReducer(state, { type: "set_standing_policy", kind, setting: "lord" });
  const startYear = stateCalendar(state).year;
  const natural = new Map<HomePetitionKind, Shown>();
  const first = new Map<HomePetitionKind, Shown>();
  let middle: GameState | null = null;
  while (stateCalendar(state).year < startYear + YEARS && lordSliceOutcome(state)?.ended !== true && natural.size < kinds.length) {
    if (middle === null && stateCalendar(state).year >= startYear + YEARS / 2) middle = state;
    const shown = openHomePetitions(state)[0];
    if (shown !== undefined && kinds.includes(shown.kind)) {
      if (!first.has(shown.kind)) first.set(shown.kind, { state, petitionId: shown.id });
      if (!natural.has(shown.kind) && estatePetitionVariantFor(state, shown.id) !== null) natural.set(shown.kind, { state, petitionId: shown.id });
    }
    state = step(state);
  }
  // The prepared states start from the slice's middle year, well before its end page.
  return { natural, first, last: middle ?? state };
}

/** 048's words read a pasture: the town's smallest field zone made one (its cells and strokes as drawn). */
function withPasture(state: GameState): GameState {
  const zones = state.zones ?? [];
  const smallest = [...zones].filter(zone => zone.kind !== "pasture").sort((a, b) => a.membership.length - b.membership.length)[0];
  return smallest === undefined ? state : { ...state, zones: zones.map(zone => zone === smallest ? { ...zone, kind: "pasture" as const } : zone) };
}

/** A petition of the kind placed as the engine raises one, on the play's last state run on to a quiet tick of the variant's seasons. */
function placed(runs: ReturnType<typeof play>, kind: HomePetitionKind, variant: string): Shown | null {
  const seasons = v4Entry(variant)?.calendar.seasonIndices ?? [];
  let state = runs.last;
  for (let guard = 0; guard < 8_000; guard += 1) {
    if (seasons.includes(stateCalendar(state).season) && openHomePetitions(state).length === 0 && openRegistryCards(state).length === 0) break;
    state = step(state);
  }
  const stewardship = stewardshipOf(state);
  const def = HOME_PETITION_KINDS[kind];
  const petition: EstatePetition = { id: `estate-petition-${stewardship.nextPetition}`, estateId: HOME_ESTATE_ID, kind, group: def.group, amount: def.amount[0],
    rights: def.rights === true, marriage: def.marriage === true, tick: state.tick, deadline: state.tick + PETITION_ANSWER_TICKS, status: "open", escalated: "direct" };
  let next: GameState = { ...state, stewardship: { ...stewardship, petitions: [...stewardship.petitions, petition], nextPetition: stewardship.nextPetition + 1 } };
  if (kind === "common_pasture" && estatePetitionVariantFor(next, petition.id) === null) next = withPasture(next);
  return estatePetitionVariantFor(next, petition.id) === null ? null : { state: next, petitionId: petition.id };
}

function homeState(kind: HomePetitionKind, runs: ReturnType<typeof play>, land: string) {
  const variant = HOME_PETITION_VARIANTS[kind]!;
  const natural = runs.natural.get(kind);
  if (natural !== undefined) return save(`home-${variant.slice(-3)}`, natural.state, { land, petition: natural.petitionId, kind, variant, prepared: false });
  const made = placed(runs, kind, variant);
  if (made === null) throw new Error(`${variant}: its words hold on no ${kind} petition, shown in ${YEARS} years or placed, on ${land}`);
  save(`home-${variant.slice(-3)}`, made.state, { land, petition: made.petitionId, kind, variant, shownInPlay: runs.first.has(kind),
    prepared: `the petition placed${kind === "common_pasture" ? " (a pasture made of the smallest field zone if none)" : ""}` });
}

/** The lord holding neighbour estates under a serving steward and two candidates (tests/registryVariants.test.ts's). */
function withStewardedEstates(state: GameState, mode: "steward" | "direct", count: number): GameState {
  const estates = estatesOf(state);
  const held = estates.estates.filter(estate => estate.offMap).sort((a, b) => a.id < b.id ? -1 : 1).slice(0, count);
  const target = held[0];
  if (target === undefined || estates.people.length < 3) throw new Error("no neighbour estate or people to hold it with");
  const ids = new Set(held.map(estate => estate.id));
  const current: StewardRecord = { personId: "variant-steward", estateId: target.id, ability: 40, loyalty: 40, disposition: "greedy", connection: null,
    since: state.tick, kept: 0, errors: 0, status: "serving" };
  const able: StewardRecord = { ...current, personId: "variant-able", ability: 80, loyalty: 20, disposition: "merchant", status: "candidate" };
  const loyal: StewardRecord = { ...current, personId: "variant-loyal", ability: 20, loyalty: 80, disposition: "peasant", status: "candidate" };
  const year = stateCalendar(state).year;
  const people = [current, able, loyal].map((steward, index) => ({ ...estates.people[index]!, id: steward.personId, alive: true, birthYear: year - 35 - index * 4 }));
  const stewardship = stewardshipOf(state);
  return { ...state,
    estates: { ...estates, people: [...estates.people, ...people], estates: estates.estates.map(estate => !ids.has(estate.id) ? estate
      : { ...estate, titleHolder: "lord", possessor: "lord", pieces: estate.pieces.map(piece => ({ ...piece, titleHolder: "lord", possessor: "lord" })) }) },
    stewardship: { ...stewardship, stewards: [...stewardship.stewards, current, able, loyal],
      oversight: [...stewardship.oversight.filter(entry => !ids.has(entry.estateId)), ...held.map(estate => ({ estateId: estate.id, mode,
        stewardId: current.personId, auditMode: "accounts" as const, tenants: 0, merchants: 0, undetected: 0, since: state.tick }))] } };
}

function registryState(base: GameState, entryId: "ck_evt_031" | "ck_evt_019", variant: string) {
  const held = entryId === "ck_evt_031" ? withStewardedEstates(base, "steward", 1) : withStewardedEstates(base, "direct", 3);
  const registry = registryOf(held);
  const entry = v4Entry(entryId);
  const found = entry === undefined ? null : bindEntry(held, entry);
  if (entry === undefined || found === null || entry.conditions === undefined || !holds(entry.conditions, { state: held, bound: found, vars: {} })
    || v4EnabledChoices(held, entry, found).length < entry.minimumEnabledConsequentialChoices) {
    throw new Error(`${entryId}: its conditions do not hold on the prepared state (attention ${JSON.stringify(attention(held))})`);
  }
  const bound = boundIdentities(found);
  const key = dedupKey(entry, found);
  const offer: RegistryOccurrence = { id: `registry:${entryId}:${key}:${seasonIndexOf(held.tick)}`, entryId, boundId: Object.values(bound)[0] ?? "",
    offeredTick: held.tick, deadline: held.tick + REGISTRY_ANSWER_TICKS, status: "offered",
    receipt: { draw: 0, chancePermille: entry.frequency.chancePermille, conditions: [] }, source: "v4", bound, key, context: contextKey(entry, found) };
  const state: GameState = { ...held, registry: { ...registry, occurrences: [...registry.occurrences, offer] } };
  const view = registryVariantFor(state, offer);
  if (view?.variantEntryId !== variant || openRegistryCards(state)[0]?.occurrence.id !== offer.id) throw new Error(`${entryId}: ${variant} does not hold on the prepared offer`);
  save(`registry-${variant.slice(-3)}`, state, { offer: offer.id, entryId, variant,
    prepared: entryId === "ck_evt_031" ? "the first neighbour estate held under a steward with two candidates" : "the three neighbour estates held direct, a steward and two candidates on the first" });
}

const slice = play(undefined, ["common_pasture", "road_bridge"]);
homeState("common_pasture", slice, "the slice's land");
homeState("road_bridge", slice, "the slice's land");
const forest = play("core:forest_edge", ["pannage"]);
homeState("pannage", forest, "core:forest_edge");
// The registry's states: the slice's middle year played on to a tick with nothing waiting for the lord.
let quiet = slice.last;
for (let guard = 0; guard < 4_000 && (openHomePetitions(quiet).length > 0 || openRegistryCards(quiet).length > 0); guard += 1) quiet = step(quiet);
registryState(quiet, "ck_evt_031", "ck_evt_067");
registryState(quiet, "ck_evt_019", "ck_evt_078");
writeFileSync(join(out, "states.json"), JSON.stringify(about, null, 1));
