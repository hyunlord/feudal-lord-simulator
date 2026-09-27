import { GREAT_FAMINE_EVENT_ID } from "../content/eventConfig";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { GameState } from "../engine/engine.types";
import { eventForecast } from "../engine/eventSchedule";
import { famineStatus, openPetitions } from "../engine/politics";
import { stateCalendar } from "../engine/scenarioState";
import { wetSummer } from "../render/wetSummer";
import { EVENT_STORY_COPY } from "./eventStoryCopy.ko";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import { beaconLit, conscriptsAway, warForecast, warOf } from "../engine/war";
import { pence } from "./hud/hudCopy.ko";
import { petitionPresentation } from "./petitionPresentation";
import type { StoryIllustration } from "./storyArt";

// UI-4 (world before UI): what the town is living through now, as story beats. Each beat is read from the engine's
// state (F0-B events and forecast, F0-C1 politics) — nothing here decides anything. The app shows a beat's card only
// after the world has shown it (EVENT_WORLD_FIRST_MS after it is first seen): a burning roof and smoke first, then the
// chip; blighted fields and rain first, then the chip. Decisions (the famine's answer, a petition) open as modals the
// same way. A beat's `id` is stable for as long as the beat lasts (the card is not re-announced).
export type StoryKind = "fire" | "fire_aftermath" | "fire_warning" | "wet_summer" | "bad_harvest" | "famine_omen" | "famine"
  | "first_winter" | "petition" | "market_charter" | "market_town" | "palisade"
  | "war_messenger" | "beacon" | "raid" | "raid_aftermath" | "conscripts_away" | "stone_wall";
export type StoryBeat = Readonly<{
  id: string;
  kind: StoryKind;
  illustration: StoryIllustration;
  /** Where [위치로] looks (null: nowhere in particular). */
  tile: { readonly tx: number; readonly ty: number } | null;
  title: string;
  line: string;
  facts: readonly string[];
  advice: string;
  /** The beat is a decision the lord answers in a modal (the famine, a petition). */
  decision: "famine" | "petition" | null;
}>;

export const EVENT_WORLD_FIRST_MS = 1_500;
/** The delay in use: EVENT_WORLD_FIRST_MS, or the proof query `story-delay=<ms>` (evidence captures lengthen it to
 * photograph the world before the card; the order is the same). */
export function eventWorldFirstMs(): number {
  if (typeof window === "undefined") return EVENT_WORLD_FIRST_MS;
  const value = Number(new URLSearchParams(window.location.search).get("story-delay"));
  return Number.isFinite(value) && value > 0 ? value : EVENT_WORLD_FIRST_MS;
}
const YEAR = 4_000;
const SEASON = 1_000;

const centre = (state: GameState, buildingId: string | undefined) => {
  const building = buildingId === undefined ? undefined : state.buildings.find(candidate => candidate.id === buildingId);
  if (building === undefined) return null;
  const size = buildingFootprint(building);
  return { tx: building.tx + Math.floor((size.width - 1) / 2), ty: building.ty + Math.floor((size.height - 1) / 2) };
};
const arableTile = (state: GameState) => {
  const zone = (state.zones ?? []).find(candidate => candidate.kind === "arable");
  const cell = zone?.membership[Math.floor(zone.membership.length / 2)];
  return cell === undefined ? null : { tx: cell % state.width, ty: Math.floor(cell / state.width) };
};

export function storyBeats(state: GameState): readonly StoryBeat[] {
  const beats: StoryBeat[] = [];
  const copy = EVENT_STORY_COPY;
  const records = state.events?.records ?? [];
  const burning = state.events?.burning ?? [];
  // Fire: while houses burn, one beat per event; after it, the aftermath until its recovery ends.
  for (const record of records) {
    if (record.kind !== "fire") continue;
    const alight = burning.filter(entry => entry.eventId === record.id);
    if (alight.length > 0) {
      beats.push({ id: `fire:${record.id}`, kind: "fire", illustration: "event_fire", tile: centre(state, alight[0]!.buildingId), decision: null,
        title: copy.fire.title, line: copy.fire.line, advice: copy.fire.advice,
        facts: [copy.fire.burning(alight.length), ...(alight.some(entry => entry.doused) ? [copy.fire.doused(alight.filter(entry => entry.doused).length)] : [copy.fire.noWell])] });
    } else if (record.endTick !== undefined && state.tick < (record.recoveryUntilTick ?? record.endTick + SEASON)) {
      const rebuilding = state.constructionSites.filter(site => "rebuildOf" in site && site.rebuildOf !== undefined).length;
      beats.push({ id: `fire_after:${record.id}`, kind: "fire_aftermath", illustration: "event_fire_aftermath", tile: centre(state, record.originBuildingId), decision: null,
        title: copy.fireAftermath.title, line: copy.fireAftermath.line, advice: copy.fireAftermath.advice,
        facts: [copy.fireAftermath.burnt(record.losses.burntHouses), copy.fireAftermath.rebuilding(rebuilding)] });
    }
  }
  // Forecast signs (the ladder's second step): a fire risk, the famine's omens.
  for (const entry of eventForecast(state)) {
    if (entry.stage !== "sign") continue;
    if (entry.kind === "fire") beats.push({ id: `fire_sign:${entry.id}`, kind: "fire_warning", illustration: "event_fire_warning", tile: null, decision: null,
      title: copy.fireWarning.title, line: copy.fireWarning.line, advice: copy.fireWarning.advice, facts: [copy.arrival(entry.year, entry.season)] });
    else if (entry.defId === GREAT_FAMINE_EVENT_ID) beats.push({ id: `famine_sign:${entry.id}`, kind: "famine_omen", illustration: "event_famine_omen", tile: null, decision: null,
      title: copy.famineOmen.title, line: copy.famineOmen.line, advice: copy.famineOmen.advice, facts: [copy.arrival(entry.year, entry.season)] });
  }
  // A wet summer on the fields; a dearth arriving (the rehearsal; the famine is its own beat).
  if (wetSummer(state)) beats.push({ id: `wet:${Math.floor(state.tick / SEASON)}`, kind: "wet_summer", illustration: "event_wet_summer", tile: arableTile(state), decision: null,
    title: copy.wetSummer.title, line: copy.wetSummer.line, advice: copy.wetSummer.advice, facts: [copy.wetSummer.fact] });
  for (const record of records) {
    if (record.kind !== "dearth" || record.defId === GREAT_FAMINE_EVENT_ID || record.endTick !== undefined) continue;
    beats.push({ id: `dearth:${record.id}`, kind: "bad_harvest", illustration: "event_bad_harvest", tile: arableTile(state), decision: null,
      title: copy.badHarvest.title, line: copy.badHarvest.line, advice: copy.badHarvest.advice, facts: [copy.badHarvest.lost(record.losses.harvestLost)] });
  }
  const famine = famineStatus(state);
  if (famine !== null && (famine.stage === "arrival" || famine.stage === "recovery")) {
    beats.push({ id: `famine:${famine.eventId}`, kind: "famine", illustration: "decision_famine_intro", tile: arableTile(state),
      decision: famine.choices.length > 0 ? "famine" : null, title: copy.famine.title, line: famine.response === null ? copy.famine.lineOpen : copy.famine.lineAnswered(famine.response),
      advice: copy.famine.advice, facts: [copy.famine.until(famine.endTick, state)] });
  }
  // The first winter (the calendar's first winter season).
  const calendar = stateCalendar(state);
  if (state.tick < YEAR && calendar.season === 3) beats.push({ id: "first_winter", kind: "first_winter", illustration: "event_first_winter", tile: null, decision: null,
    title: copy.firstWinter.title, line: copy.firstWinter.line, advice: copy.firstWinter.advice, facts: [] });
  // The merchants' petition while it waits; the charter once granted (for a season); the town's eras.
  // UI-6: a petition's chip by its kind — the war's demands with their Wave 17 scene and the rules' numbers.
  const petition = openPetitions(state)[0];
  if (petition !== undefined) {
    const presentation = petitionPresentation(state, petition);
    const war = WAR_DEMAND_ART[petition.defId];
    beats.push({ id: `petition:${petition.id}`, kind: "petition", illustration: war ?? "event_market_petition", tile: keepTile(state), decision: "petition",
      title: war === undefined && petition.defId === "market_charter" ? copy.petition.title : presentation.title,
      line: war === undefined && petition.defId === "market_charter" ? copy.petition.line : presentation.demand,
      advice: petition.petitioner === "crown" ? copy.war.demand.advice : copy.petition.advice, facts: [] });
  }
  beats.push(...warBeats(state));
  const right = state.politics?.rights?.[0];
  if (right !== undefined && state.tick - right.grantedTick < SEASON) beats.push({ id: `charter:${right.id}`, kind: "market_charter", illustration: "event_market_charter", tile: marketTile(state), decision: null,
    title: copy.charter.title, line: copy.charter.line, advice: copy.charter.advice, facts: [] });
  if (state.era !== "hamlet" && state.palisade !== null) {
    const building = state.constructionSites.some(site => site.kind === "palisade_segment");
    const since = state.politics?.decisions.find(decision => decision.kind === "market_town")?.tick ?? state.tick;
    if (state.tick - since < SEASON) beats.push({ id: "market_town", kind: "market_town", illustration: "event_market_town", tile: marketTile(state), decision: null,
      title: copy.marketTown.title, line: copy.marketTown.line, advice: copy.marketTown.advice, facts: [] });
    if (!building && state.tick - since < 3 * SEASON) beats.push({ id: "palisade", kind: "palisade", illustration: "event_palisade", tile: null, decision: null,
      title: copy.palisade.title, line: copy.palisade.line, advice: copy.palisade.advice, facts: [] });
  }
  return beats;
}

/** UI-6: the war demands' scenes on their chips (the decision card itself shows the Wave 17 decision picture). */
const WAR_DEMAND_ART: Readonly<Record<string, StoryIllustration>> = {
  wool_payment: "event_wool_levy_edict", levy_response: "event_conscription_departure", war_funding: "event_royal_messenger_arrival",
  refugee_admission: "event_raid_aftermath", wall_or_market: "event_stonewall_charter",
};

/**
 * UI-6 (F2-A WR-1…WR-8, world before UI): the war's beats — the messenger's season, the beacon while it burns (the sign),
 * the raid's season (the arrival) and the one after it (the aftermath, with what was lost), the men away, and the
 * stone wall chosen (a season).
 */
function warBeats(state: GameState): readonly StoryBeat[] {
  const war = warOf(state);
  if (war === undefined) return [];
  const copy = EVENT_STORY_COPY.war;
  const beats: StoryBeat[] = [];
  if (state.tick - war.messengerTick < SEASON) beats.push({ id: `war_messenger:${war.messengerTick}`, kind: "war_messenger", illustration: "event_royal_messenger_arrival",
    tile: keepTile(state), decision: null, title: copy.messenger.title, line: copy.messenger.line, advice: copy.messenger.advice, facts: [] });
  if (beaconLit(state)) {
    const raid = warForecast(state).find(step => step.id === "raid");
    const when = raid === undefined ? null : stateCalendar({ ...state, tick: raid.tick });
    beats.push({ id: `beacon:${war.messengerTick}`, kind: "beacon", illustration: "event_beacon_warning", tile: null, decision: null,
      title: copy.beacon.title, line: copy.beacon.line, advice: copy.beacon.advice,
      facts: when === null ? [] : [copy.raidBy(when.year, SCENARIO_COPY.seasons[when.season as 0 | 1 | 2 | 3])] });
  }
  const raid = war.raid;
  if (raid !== undefined && state.tick - raid.tick < 2 * SEASON) {
    const facts = [copy.losses(raid.losses.burntHouses, raid.losses.looted, pence(raid.losses.coin), Math.round(raid.defencePermille / 10))];
    beats.push(state.tick - raid.tick < SEASON
      ? { id: `raid:${raid.tick}`, kind: "raid", illustration: "event_coastal_raid", tile: null, decision: null, title: copy.raid.title, line: copy.raid.line, advice: copy.raid.advice, facts }
      : { id: `raid_after:${raid.tick}`, kind: "raid_aftermath", illustration: "event_raid_aftermath", tile: null, decision: null,
        title: copy.raidAfter.title, line: copy.raidAfter.line, advice: copy.raidAfter.advice, facts });
  }
  const away = conscriptsAway(state);
  if (away > 0) beats.push({ id: `away:${war.conscripts?.returnTick ?? 0}`, kind: "conscripts_away", illustration: "event_empty_workshop", tile: null, decision: null,
    title: copy.away.title, line: copy.away.line, advice: copy.away.advice, facts: [copy.awayCount(away)] });
  const wallAnswer = (state.politics?.petitions ?? []).find(petition => petition.defId === "wall_or_market" && petition.response !== undefined && petition.response !== "refuse");
  if (wallAnswer?.respondedTick !== undefined && state.tick - wallAnswer.respondedTick < SEASON) beats.push({ id: `stone_wall:${wallAnswer.id}`, kind: "stone_wall",
    illustration: "event_stonewall_charter", tile: null, decision: null, title: copy.wall.title, line: copy.wall.line, advice: copy.wall.advice, facts: [] });
  return beats;
}

/** UI-4 forecast (the ladder's rumour and sign): the steward's one line for the nearest coming fire or dearth; UI-6: the war's. */
export function forecastStewardLine(state: GameState): { readonly key: string; readonly text: string } | null {
  const war = warOf(state);
  if (war !== undefined) {
    const lines = EVENT_STORY_COPY.stewardWar;
    if (beaconLit(state)) return { key: `war:beacon:${war.messengerTick}`, text: lines.beacon };
    if (state.tick - war.messengerTick < SEASON) return { key: `war:messenger:${war.messengerTick}`, text: lines.messenger };
    const raid = warForecast(state).find(step => step.id === "raid" && step.state === "ahead");
    if (raid !== undefined && raid.tick - state.tick < 4 * SEASON) return { key: `war:raid:${raid.tick}`, text: lines.raidAhead(stateCalendar({ ...state, tick: raid.tick }).year) };
  }
  const entry = eventForecast(state).find(candidate => candidate.stage === "rumour" || candidate.stage === "sign");
  if (entry === undefined) return null;
  const lines = EVENT_STORY_COPY.steward;
  const text = entry.kind === "fire" ? lines.fire(entry.stage === "sign") : entry.defId === GREAT_FAMINE_EVENT_ID ? lines.famine(entry.stage === "sign") : lines.dearth(entry.stage === "sign");
  return { key: `forecast:${entry.id}:${entry.stage}`, text };
}

function keepTile(state: GameState) {
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "chapel" || building.kind === "church");
  return keep === undefined ? null : { tx: keep.tx, ty: keep.ty };
}
function marketTile(state: GameState) {
  const market = state.buildings.find(building => building.kind === "market");
  return market === undefined ? null : { tx: market.tx, ty: market.ty };
}
