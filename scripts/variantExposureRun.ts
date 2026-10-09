// ER-13 wording variants (engine B, docs/requests/engine-B-petition-variant-presentation.md): how often the five variants
// (041 · 048 · 056 on the home estate's petitions, 067 · 078 on the registry's offers 031 · 059 · 019) are on a petition or
// offer the lord is actually shown in natural play — the lord's slice played by the lord bot from a new game, as
// scripts/lordSliceRun.ts plays it (`lordBotCommands` each tick, to the slice's end or twenty years). Each tick, before the
// lord acts, the home petition its chip and card show (`homePetitionView`) and the registry offer (`registryHeadline`),
// with the engine's variant read on that very item (`estatePetitionVariantFor`, `registryVariantFor`). Counted per item
// shown: its kind, the ticks shown, the ticks its variant held. With a folder, the state of each variant's first natural
// showing is written there (`<variant>-<archetype>-s<seed>.json`) for the screens. Reads only the game's APIs.
//   tsx scripts/variantExposureRun.ts <seed> [archetypeId] [statesDir] > exposure.json
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("영주 조각 봇 판(scripts/variantExposureRun.ts)", { remote: "scripts/remote/run.sh render-VARIANTS-exposure-<sha7> --detach --keep -- bash scripts/variantExposure.sh", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { HOME_PETITION_VARIANTS, REGISTRY_VARIANT_LINKS } from "../src/content/registry/registryVariantConfig";
import { stateArchetype } from "../src/engine/archetype";
import { lordBotCommands } from "../src/engine/lordBot";
import { lordSliceOutcome } from "../src/engine/lordSlice";
import { estatePetitionVariantFor, registryVariantFor } from "../src/engine/registryVariants";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { homePetitionView } from "../src/ui/lordCardsModel";
import { openRegistryCards, registryHeadline } from "../src/ui/registryCardModel";

type Shown = { id: string; surface: "home_petition" | "registry_offer"; source: string; firstTick: number; firstYear: number; ticks: number;
  variantTicks: number; variant: string | null };

const [seedArg, archetypeId, statesDir] = process.argv.slice(2);
const seed = Number(seedArg ?? 1);
let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed, ...(archetypeId === undefined || archetypeId === "-" ? {} : { archetypeId }) });
if (state === null) throw new Error(`seed ${seed}: no game`);
const land = stateArchetype(state)?.id ?? "none";
const startYear = stateCalendar(state).year;
if (statesDir !== undefined) mkdirSync(statesDir, { recursive: true });
const shown = new Map<string, Shown>();
const saved: Record<string, { tick: number; year: number; season: number; id: string; source: string; file: string }> = {};
const started = Date.now();
const see = (surface: Shown["surface"], id: string, source: string, variant: string | null) => {
  const date = stateCalendar(state!);
  const row = shown.get(`${surface}:${id}`) ?? { id, surface, source, firstTick: state!.tick, firstYear: date.year, ticks: 0, variantTicks: 0, variant: null };
  row.ticks += 1;
  if (variant !== null) { row.variantTicks += 1; row.variant ??= variant; }
  shown.set(`${surface}:${id}`, row);
  if (variant === null || statesDir === undefined || saved[variant] !== undefined) return;
  const file = `${variant}-${land.replace(/^core:/, "")}-s${seed}.json`;
  writeFileSync(join(statesDir, file), JSON.stringify(state));
  saved[variant] = { tick: state!.tick, year: date.year, season: date.season, id, source, file };
};
let endedAt: number | null = null;
for (;;) {
  const outcome = lordSliceOutcome(state)!;
  if (outcome.ended) { endedAt = state.tick; break; }
  if (stateCalendar(state).year >= startYear + 20) break;
  // What the lord is shown this tick, before he acts (the chips' first home petition and first registry offer).
  const home = homePetitionView(state);
  if (home !== null) see("home_petition", home.petitionId, home.kind, estatePetitionVariantFor(state, home.petitionId)?.variantEntryId ?? null);
  const offer = registryHeadline(state);
  const card = offer === null ? undefined : openRegistryCards(state)[0];
  if (offer !== null && card !== undefined) see("registry_offer", offer.occurrenceId, offer.entryId, registryVariantFor(state, card.occurrence)?.variantEntryId ?? null);
  for (const { command } of lordBotCommands(state)) state = gameReducer(state, command);
  state = advanceTick(state);
}

const rows = [...shown.values()];
const sources = [...Object.keys(HOME_PETITION_VARIANTS), ...Object.keys(REGISTRY_VARIANT_LINKS)];
const bySource = Object.fromEntries(sources.map(source => {
  const items = rows.filter(row => row.source === source);
  return [source, { shown: items.length, withVariant: items.filter(row => row.variant !== null).length,
    variantEveryTickShown: items.filter(row => row.variantTicks > 0 && row.variantTicks === row.ticks).length }];
}));
const variants = [...new Set([...Object.values(HOME_PETITION_VARIANTS), ...Object.values(REGISTRY_VARIANT_LINKS).map(link => link.variantEntryId)])];
const byVariant = Object.fromEntries(variants.map(variant => [variant, rows.filter(row => row.variant === variant).length]));
process.stdout.write(`${JSON.stringify({ seed, archetypeId: land, startYear, finalYear: stateCalendar(state).year, tick: state.tick, endedAt,
  shownItems: rows.length, shownHomePetitions: rows.filter(row => row.surface === "home_petition").length,
  shownRegistryOffers: rows.filter(row => row.surface === "registry_offer").length, bySource, byVariant, saved,
  variantItems: rows.filter(row => row.variant !== null), seconds: Math.round((Date.now() - started) / 1000) }, null, 1)}\n`);
