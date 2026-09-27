// UI-5 gate states: the seed 2 chapter 1 run (the bot answers the Great Famine with relief), saving the moments the
// person captures open — the Great Famine arriving (the decision modal with the steward), the first petition waiting
// (its petitioners), a carter carrying to a building site (the walker card: who, verb + what + where + progress), a
// house where a member's portrait moves to the next picture of their aging chain within a few seconds (the crossfade)
// and the end of chapter 1. Chapter 1 of seed 2 builds no market, so no merchant household; the merchant marks come
// from the seed 1 determinism town (two staffed markets), run on until PERSON-0 has named its people and masters.
// Beside the states: moments.json (what each moment is about) and summary.json (the portrait match rates of every
// state, the arms of each seed, the merchant households).
//   tsx scripts/ui5States.ts <seed> <maxTicks> <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { persons } from "../src/engine/personsApi";
import { MANOR_HOUSEHOLD } from "../src/engine/persons.types";
import { chapterEnd, famineStatus, openPetitions } from "../src/engine/politics";
import { advanceTick } from "../src/engine/tick";
import { pickTile } from "../src/render/picking";
import { walkerVisualAnchor } from "../src/render/walkerAnchor";
import { armsKey, armsRecipe, merchantKey, merchantRecipe } from "../src/ui/heraldry/heraldry";
import { householdRows, personEmblem, portraitMatchRate, stewardPerson, walkerHeadline } from "../src/ui/persons/personModels";
import { runPhase19NaturalGrowth } from "./phase19NaturalGrowth";
import { loadSaveFile } from "./loadSaveFile";

const [seedArg, maxArg, out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const found = new Map<string, Record<string, unknown>>();
const states = new Map<string, GameState>();
const save = (name: string, state: GameState, about: Record<string, unknown> = {}) => {
  if (found.has(name)) return;
  found.set(name, { tick: state.tick, ...about });
  states.set(name, state);
  writeFileSync(join(out!, `${name}.json`), JSON.stringify(state));
  process.stderr.write(`${name} at tick ${state.tick}\n`);
};
const renderedTile = (walker: GameState["walkers"][number]) => { const anchor = walkerVisualAnchor(walker.position); return pickTile({ x: anchor.sx, y: anchor.sy }); };

/** A carter walking loaded to a building site, alone on its rendered tile (a click there selects it). */
function carrierToSite(state: GameState) {
  for (const walker of state.walkers) {
    if (walker.kind !== "carter" || walker.cargo === null || walker.phase === "returning" || walker.destination.kind !== "construction_site") continue;
    const siteId = walker.destination.siteId;
    const site = state.constructionSites.find(candidate => candidate.id === siteId);
    if (site === undefined || site.kind === "palisade_segment" || site.kind === "stone_wall_segment") continue;
    const resource = walker.cargo.resource as keyof typeof site.required;
    if ((site.required[resource] ?? 0) <= (site.delivered[resource] ?? 0)) continue;
    const tile = renderedTile(walker);
    if (tile === null) continue;
    const shared = state.walkers.some(other => other.id !== walker.id && other.kind !== "builder" && (() => { const t = renderedTile(other); return t?.tx === tile.tx && t.ty === tile.ty; })());
    if (!shared) return { walkerId: walker.id, tile, siteId, headline: walkerHeadline(state, walker.id) };
  }
  return null;
}

/** A house member whose drawn portrait changes within `ticks` (their age crosses into the next picture of the chain). */
function agingSoon(state: GameState, ticks: number) {
  const later = { ...state, tick: state.tick + ticks };
  for (const house of state.houses) {
    for (const person of persons.of(state, house.buildingId)) {
      const now = persons.portrait(state, person); const next = persons.portrait(later, person);
      if (now.stage !== next.stage) return { houseId: house.buildingId, personId: person.id, from: now.portraitId, to: next.portraitId, within: ticks };
    }
  }
  return null;
}

runPhase19NaturalGrowth({ targetLots: 24, maxTicks: Number(maxArg ?? 200_000), seed: Number(seedArg), famineResponse: "relief", onTick: state => {
  const famine = famineStatus(state);
  if (famine !== null && famine.stage === "arrival" && famine.response === null) save("famine-arrival", state, { steward: stewardPerson(state)?.id ?? null });
  const petition = openPetitions(state)[0];
  if (petition !== undefined && (petition.petitionerIds?.length ?? 0) >= 2) save("petition-open", state, { petitionId: petition.id, petitionerIds: petition.petitionerIds });
  if (!found.has("carrying") && state.tick > 3_000 && state.tick % 10 === 0) { const carrier = carrierToSite(state); if (carrier !== null) save("carrying", state, carrier); }
  if (!found.has("aging-eve") && state.tick > 8_000 && state.tick % 10 === 0) { const aging = agingSoon(state, 120); if (aging !== null) save("aging-eve", state, aging); }
  if (chapterEnd(state) !== null) save("chapter-end", state);
}, additionalAcceptance: (state: GameState) => chapterEnd(state) !== null });

// The merchant households: the seed 1 determinism town (two markets) run on until its markets have masters (PS-4).
// RES-REG: through the save codec (a bare file is schema v0: the whole migration chain), never parsed into the game.
let town = loadSaveFile("fixtures/determinism/seed1/final-state.json");
const merchants = (state: GameState) => (state.persons?.people ?? []).filter(person => person.classBand === "merchant");
for (let step = 0; step < 2_000 && merchants(town).length === 0; step += 1) town = advanceTick(town);
const merchant = merchants(town)[0];
if (merchant !== undefined) save("merchant-town", town, { merchantId: merchant.id, householdId: merchant.householdId, households: [...new Set(merchants(town).map(person => person.householdId))] });

writeFileSync(join(out!, "moments.json"), JSON.stringify(Object.fromEntries(found), null, 1) + "\n");
const summary = {
  match: Object.fromEntries([...states].map(([name, state]) => [name, portraitMatchRate(state)])),
  arms: Object.fromEntries([...new Set([...states.values()].map(state => state.seed))].map(seed => [seed, armsKey(armsRecipe(seed, MANOR_HOUSEHOLD))])),
  armsSameSeedTwice: armsKey(armsRecipe(Number(seedArg), MANOR_HOUSEHOLD)) === armsKey(armsRecipe(Number(seedArg), MANOR_HOUSEHOLD)),
  merchantMarks: merchant === undefined ? [] : [...new Set(merchants(town).map(person => person.householdId))].map(householdId => ({ householdId, mark: merchantKey(merchantRecipe(town.seed, householdId)),
    emblem: personEmblem(town, merchants(town).find(person => person.householdId === householdId)!)?.kind ?? null })),
  steward: Object.fromEntries([...states].map(([name, state]) => { const steward = stewardPerson(state); return [name, steward === null ? null : { id: steward.id, members: householdRows(state, MANOR_HOUSEHOLD).length }]; })),
};
writeFileSync(join(out!, "summary.json"), JSON.stringify(summary, null, 1) + "\n");
console.log(JSON.stringify({ moments: Object.fromEntries([...found].map(([name, about]) => [name, about.tick])), match: summary.match }));
if (!["famine-arrival", "petition-open", "carrying", "aging-eve", "chapter-end", "merchant-town"].every(name => found.has(name))) process.exit(1);
