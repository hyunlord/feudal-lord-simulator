import { GREAT_FAMINE_EVENT_ID } from "../content/eventConfig";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { GameState } from "../engine/engine.types";
import { eventForecast } from "../engine/eventSchedule";
import { curacyVacant, plagueStage } from "../engine/plague";
import { famineStatus, openPetitions } from "../engine/politics";
import { stateCalendar } from "../engine/scenarioState";
import { wetSummer } from "../render/wetSummer";
import { beaconSpot, raidQuaySpot } from "../render/warWorldProps";
import { EVENT_STORY_COPY } from "./eventStoryCopy.ko";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import { reorganisationOf } from "../engine/reorganisation";
import { CHURCH_REBUILDING_PETITION_ID, GUILD_DISPUTE_PETITION_ID, LEGACY_BALANCE, type LegacyInterludeId, type LegacyStepId } from "../content/legacyConfig";
import { legacyEnding, legacyForecast, legacyInterludes, legacyOf, legacyWord } from "../engine/legacy";
import { lordshipOf } from "../engine/lordshipState";
import { interludeImageId } from "./wave33Art";
import { SEASON_STRIP_COPY } from "./seasonStripCopy.ko";
import { beaconLit, conscriptsAway, warForecast, warOf } from "../engine/war";
import { moneyShort } from "./money.ko";
import { petitionPresentation } from "./petitionPresentation";
import type { StoryIllustration } from "./storyArt";

// UI-4 (world before UI): what the town is living through now, as story beats. Each beat is read from the engine's
// state (F0-B events and forecast, F0-C1 politics) — nothing here decides anything. The app shows a beat's card only
// after the world has shown it (EVENT_WORLD_FIRST_MS after it is first seen): a burning roof and smoke first, then the
// chip; blighted fields and rain first, then the chip. Decisions (the famine's answer, a petition) open as modals the
// same way. A beat's `id` is stable for as long as the beat lasts (the card is not re-announced).
export type StoryKind = "fire" | "fire_aftermath" | "fire_warning" | "wet_summer" | "bad_harvest" | "famine_omen" | "famine"
  | "first_winter" | "petition" | "market_charter" | "market_town" | "palisade"
  | "war_messenger" | "beacon" | "raid" | "raid_aftermath" | "conscripts_away" | "stone_wall"
  // UI-8: nine plague beats (F3-A PL-1…PL-10).
  | "plague_rumour" | "plague_arrival" | "plague_priest_death" | "plague_new_graves" | "plague_empty_streets"
  | "plague_abandoned_fields" | "plague_ordinance" | "plague_resettlement" | "plague_second"
  // UI-9: seven reorganisation informational beats (F4-A RG-1…RG-9; guild/charter petition beats share the "petition" kind).
  | "reorg_wage_competition" | "reorg_textile_street" | "reorg_alehouse" | "reorg_petitions_surge"
  | "reorg_overlord_warning" | "reorg_poll_tax" | "reorg_rebellion"
  // UI-10: chapter 5's eight steps (F5-A LG-1; its four petitions share the "petition" kind) and the interlude's five (LG-13).
  | "legacy_mayor_demand" | "legacy_royal_tax" | "legacy_succession" | "legacy_city_seal" | "legacy_charter"
  | "legacy_departure" | "legacy_record" | "legacy_last_market"
  | "interlude_staple" | "interlude_guild_dispute" | "interlude_market_fire" | "interlude_church_rebuilding" | "interlude_deposition";
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
  // UI-8: the four plague petitions use Wave 21 event illustrations and a fitting plague-specific advice line.
  const petition = openPetitions(state)[0];
  if (petition !== undefined) {
    const presentation = petitionPresentation(state, petition);
    const war = WAR_DEMAND_ART[petition.defId];
    const plaguePetition = PLAGUE_DEMAND_ART[petition.defId];
    const reorgPetition = REORG_DEMAND_ART[petition.defId];
    const legacyPetition = LEGACY_DEMAND_ART[petition.defId];
    const merchants = war === undefined && plaguePetition === undefined && reorgPetition === undefined && legacyPetition === undefined && petition.defId === "market_charter";
    beats.push({ id: `petition:${petition.id}`, kind: "petition",
      illustration: war ?? plaguePetition ?? reorgPetition ?? legacyPetition ?? "event_market_petition", tile: keepTile(state), decision: "petition",
      title: merchants ? copy.petition.title : presentation.title,
      line: merchants ? copy.petition.line : presentation.demand,
      // UI-10: the Crown's tax is chapter 5's (its silence is not the war's refusal).
      advice: legacyPetition !== undefined ? copy.legacy.demand.advice
        : petition.petitioner === "crown" ? copy.war.demand.advice
        : plaguePetition !== undefined ? copy.plague.demand.advice
        : reorgPetition !== undefined ? copy.reorg.demand.advice
        : copy.petition.advice, facts: [] });
  }
  beats.push(...warBeats(state));
  beats.push(...plagueBeats(state));
  beats.push(...reorgBeats(state));
  beats.push(...legacyBeats(state));
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

/** UI-8: the plague petitions' chip illustrations (Wave 21 event art; the card shows the Wave 21 decision picture). */
const PLAGUE_DEMAND_ART: Readonly<Record<string, StoryIllustration>> = {
  vacant_priest: "ch3_event_priest_death", wages: "ch3_event_wage_demand",
  land_redistribution: "ch3_event_abandoned_fields", cash_rent: "ch3_event_resettlement",
};
/** UI-9: the reorganisation petitions' chip illustrations (Wave 21 event art; the card shows the Wave 21 decision picture). */
const REORG_DEMAND_ART: Readonly<Record<string, StoryIllustration>> = {
  guild_charter: "ch4_event_guild_foundation", tax_collection: "ch4_event_petitions",
  cloth_or_grain: "ch4_event_textile_growth", borough_charter: "ch4_event_autonomy_request",
};

/** UI-10: chapter 5's petitions' chip illustrations (Wave 21 event art, Wave 33 for the interlude's two). */
const LEGACY_DEMAND_ART: Readonly<Record<string, StoryIllustration>> = {
  royal_tax: "ch5_event_royal_tax_envoy", heir_choice: "ch5_event_succession", borough_autonomy: "ch5_event_charter_sealing",
  legacy_choice: "ch5_event_legacy_record", guild_dispute: interludeImageId("guild_dispute"), church_rebuilding: interludeImageId("church_rebuilding"),
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
    beats.push({ id: `beacon:${war.messengerTick}`, kind: "beacon", illustration: "event_beacon_warning", tile: spotTile(beaconSpot(state)), decision: null,
      title: copy.beacon.title, line: copy.beacon.line, advice: copy.beacon.advice,
      facts: when === null ? [] : [copy.raidBy(when.year, SCENARIO_COPY.seasons[when.season as 0 | 1 | 2 | 3])] });
  }
  const raid = war.raid;
  if (raid !== undefined && state.tick - raid.tick < 2 * SEASON) {
    const facts = [copy.losses(raid.losses.burntHouses, raid.losses.looted, moneyShort(raid.losses.coin), Math.round(raid.defencePermille / 10))];
    beats.push(state.tick - raid.tick < SEASON
      ? { id: `raid:${raid.tick}`, kind: "raid", illustration: "event_coastal_raid", tile: spotTile(raidQuaySpot(state)), decision: null, title: copy.raid.title, line: copy.raid.line, advice: copy.raid.advice, facts }
      : { id: `raid_after:${raid.tick}`, kind: "raid_aftermath", illustration: "event_raid_aftermath", tile: spotTile(raidQuaySpot(state)), decision: null,
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

/**
 * UI-8 (F3-A PL-1…PL-10, world before UI): the plague's beats — the harbour fever rumour, the arrival raging, the
 * priest's death while the curacy is empty, the new graves and empty streets during the spread, the abandoned fields
 * when it ends, the Crown's Statute of Labourers, the resettlement, and the second pestilence of 1361.
 * Respects the world-first delay (eventWorldFirstMs / useStoryPresentation) exactly as warBeats does: each beat has
 * a stable `id` so the card is not re-announced.
 */
function plagueBeats(state: GameState): readonly StoryBeat[] {
  const stage = plagueStage(state);
  if (stage === null) return [];
  const plague = state.plague!;
  const copy = EVENT_STORY_COPY.plague;
  const beats: StoryBeat[] = [];

  // 1. 소문 (rumour): harbour fever heard of, before the pestilence arrives.
  if (stage === "rumour") {
    beats.push({ id: `plague_rumour:${plague.eraTick}`, kind: "plague_rumour", illustration: "ch3_event_harbour_fever",
      tile: keepTile(state), decision: null, title: copy.rumour.title, line: copy.rumour.line, advice: copy.rumour.advice, facts: [] });
  }

  // 2. 도래 (arrival): while the first pestilence rages (no own art — shares priest_death).
  if (stage === "arrival" && plague.first !== undefined) {
    beats.push({ id: `plague_arrival:${plague.first.arrivalTick}`, kind: "plague_arrival", illustration: "ch3_event_priest_death",
      tile: keepTile(state), decision: null, title: copy.arrival.title, line: copy.arrival.line, advice: copy.arrival.advice,
      facts: plague.first.dead > 0 ? [copy.arrival.dead(plague.first.dead)] : [] });
  }

  // 3. 사제의 죽음 (priest_death): while the curacy is empty (curacyVacant spans arrival and early recovery).
  if (curacyVacant(state)) {
    beats.push({ id: `plague_priest:${plague.curacy!.vacantSince}`, kind: "plague_priest_death", illustration: "ch3_event_priest_death",
      tile: churchTile(state), decision: null, title: copy.priestDeath.title, line: copy.priestDeath.line, advice: copy.priestDeath.advice, facts: [] });
  }

  // 4. 새 무덤 (new_graves): first deaths visible during the spread.
  if (stage === "arrival" && plague.first !== undefined && plague.first.dead > 0) {
    beats.push({ id: `plague_new_graves:${plague.first.arrivalTick}`, kind: "plague_new_graves", illustration: "ch3_event_new_graves",
      tile: churchTile(state), decision: null, title: copy.newGraves.title, line: copy.newGraves.line, advice: copy.newGraves.advice,
      facts: [copy.newGraves.dead(plague.first.dead)] });
  }

  // 5. 빈 거리 (empty_streets): vacant houses while the pestilence spreads or the town recovers.
  if (plague.vacantHouseIds.length > 0 && (stage === "arrival" || stage === "recovery")) {
    beats.push({ id: `plague_empty_streets:${plague.first?.arrivalTick ?? plague.eraTick}`, kind: "plague_empty_streets",
      illustration: "ch3_event_empty_streets", tile: null, decision: null, title: copy.emptyStreets.title, line: copy.emptyStreets.line,
      advice: copy.emptyStreets.advice, facts: [copy.emptyStreets.houses(plague.vacantHouseIds.length)] });
  }

  // 6. 버려진 밭 (abandoned_fields): within 2 seasons of the first pestilence ending.
  if (plague.first?.endTick !== undefined && state.tick - plague.first.endTick < 2 * SEASON) {
    beats.push({ id: `plague_abandoned:${plague.first.endTick}`, kind: "plague_abandoned_fields",
      illustration: "ch3_event_abandoned_fields", tile: arableTile(state), decision: null, title: copy.abandonedFields.title,
      line: copy.abandonedFields.line, advice: copy.abandonedFields.advice, facts: [] });
  }

  // 7. 조례 (ordinance): within 1 season of the Statute of Labourers being read.
  if (plague.ordinanceTick !== undefined && state.tick - plague.ordinanceTick < SEASON) {
    beats.push({ id: `plague_ordinance:${plague.ordinanceTick}`, kind: "plague_ordinance",
      illustration: "ch3_event_ordinance_reading", tile: keepTile(state), decision: null, title: copy.ordinance.title,
      line: copy.ordinance.line, advice: copy.ordinance.advice, facts: [] });
  }

  // 8. 재정착 (resettlement): while resettlement is ongoing and the chapter has not ended.
  if (stage === "recovery" && plague.resettled > 0 && plague.endedTick === undefined) {
    beats.push({ id: `plague_resettlement:${plague.eraTick}`, kind: "plague_resettlement",
      illustration: "ch3_event_resettlement", tile: null, decision: null, title: copy.resettlement.title,
      line: copy.resettlement.line, advice: copy.resettlement.advice, facts: [] });
  }

  // 9. 두 번째 역병 (second): while the 1361 pestilence is active (no own art — uses new_graves).
  if (plague.second !== undefined && plague.second.endTick === undefined) {
    beats.push({ id: `plague_second:${plague.second.arrivalTick}`, kind: "plague_second",
      illustration: "ch3_event_new_graves", tile: keepTile(state), decision: null, title: copy.second.title,
      line: copy.second.line, advice: copy.second.advice, facts: [copy.second.dead(plague.second.dead)] });
  }

  return beats;
}

/**
 * UI-9 (F4-A RG-1…RG-9): the reorganisation's informational beats — seven cards that are not petitions.
 * Guild demand and autonomy request show as petition beats (the open petition) rather than here.
 */
function reorgBeats(state: GameState): readonly StoryBeat[] {
  const reorg = reorganisationOf(state);
  if (reorg === undefined) return [];
  const copy = EVENT_STORY_COPY.reorg;
  const beats: StoryBeat[] = [];

  // 1. 임금 경쟁 (wage competition): within 4 seasons of wageCompetitionTick.
  if (reorg.wageCompetitionTick !== undefined && state.tick - reorg.wageCompetitionTick < 4 * SEASON) {
    beats.push({ id: `reorg_wage:${reorg.wageCompetitionTick}`, kind: "reorg_wage_competition",
      illustration: "ch4_event_wage_competition", tile: null, decision: null, title: copy.wageCompetition.title,
      line: copy.wageCompetition.line, advice: copy.wageCompetition.advice,
      facts: reorg.wageLeavers > 0 ? [copy.wageCompetition.leavers(reorg.wageLeavers)] : [] });
  }

  // 2. 직물 거리 (textile street): within 2 seasons of textileStreetTick.
  if (reorg.textileStreetTick !== undefined && state.tick - reorg.textileStreetTick < 2 * SEASON) {
    beats.push({ id: `reorg_textile:${reorg.textileStreetTick}`, kind: "reorg_textile_street",
      illustration: "ch4_event_textile_growth", tile: null, decision: null, title: copy.textileStreet.title,
      line: copy.textileStreet.line, advice: copy.textileStreet.advice, facts: [] });
  }

  // 3. 선술집 성황 (alehouse boom): within 2 seasons of alehouseBoomTick.
  if (reorg.alehouseBoomTick !== undefined && state.tick - reorg.alehouseBoomTick < 2 * SEASON) {
    beats.push({ id: `reorg_alehouse:${reorg.alehouseBoomTick}`, kind: "reorg_alehouse",
      illustration: "ch4_event_alehouse", tile: null, decision: null, title: copy.alehouseBoom.title,
      line: copy.alehouseBoom.line, advice: copy.alehouseBoom.advice, facts: [] });
  }

  // 4. 청원 물결 (petitions surge): within 2 seasons of surgeTick.
  if (reorg.surgeTick !== undefined && state.tick - reorg.surgeTick < 2 * SEASON) {
    beats.push({ id: `reorg_surge:${reorg.surgeTick}`, kind: "reorg_petitions_surge",
      illustration: "ch4_event_petitions", tile: keepTile(state), decision: null, title: copy.petitionsSurge.title,
      line: copy.petitionsSurge.line, advice: copy.petitionsSurge.advice, facts: [] });
  }

  // 5. 영주의 경고 (overlord warning): within 2 seasons of warningTick.
  if (reorg.warningTick !== undefined && state.tick - reorg.warningTick < 2 * SEASON) {
    beats.push({ id: `reorg_warning:${reorg.warningTick}`, kind: "reorg_overlord_warning",
      illustration: "ch4_event_lord_warning", tile: keepTile(state), decision: null, title: copy.overlordWarning.title,
      line: copy.overlordWarning.line, advice: copy.overlordWarning.advice, facts: [] });
  }

  // 6. 인두세 징수 (poll tax): while collections are happening and the rebellion has not occurred.
  if (reorg.collections > 0 && reorg.rebellion === undefined) {
    beats.push({ id: `reorg_poll:${reorg.startTick}`, kind: "reorg_poll_tax",
      illustration: "ch4_event_petitions", tile: keepTile(state), decision: null, title: copy.pollTax.title,
      line: copy.pollTax.line, advice: copy.pollTax.advice,
      facts: reorg.pollTax > 0 ? [copy.pollTax.collected(moneyShort(reorg.pollTax))] : [] });
  }

  // 7. 1381년 소요 (rebellion): within 2 seasons of the rebellion's tick.
  if (reorg.rebellion !== undefined && state.tick - reorg.rebellion.tick < 2 * SEASON) {
    const chased = reorg.rebellion.outcome === "chased";
    beats.push({ id: `reorg_rebellion:${reorg.rebellion.tick}`, kind: "reorg_rebellion",
      // The chase picture only when they were chased; a quiet rumour is the townsfolk talking (chronicleModel reorgRecordArt).
      illustration: chased ? "ch4_event_rebellion_1381" : "ch4_event_petitions", tile: keepTile(state), decision: null, title: copy.rebellion.title,
      line: chased ? copy.rebellion.chased : copy.rebellion.quiet, advice: copy.rebellion.advice, facts: [] });
  }

  return beats;
}

/**
 * UI-10 (F5-A LG-1…LG-8, FIX-9 LG-13): chapter 5's beats — each of the eight steps for two seasons after it came
 * (`legacyForecast`, the step's own tick in `legacy.steps`), and each interlude event for two seasons after it came
 * (`legacyInterludes`). A step or event whose petition waits shows as the petition's chip instead (the card); once
 * answered, its beat says what was answered. Names are the ledger's own (the step's `legacy.*` record's params: the
 * mayor's candidate, the old lord, the heir) and the house's.
 */
function legacyBeats(state: GameState): readonly StoryBeat[] {
  const legacy = legacyOf(state);
  if (legacy === undefined) return [];
  const copy = EVENT_STORY_COPY.legacy;
  const beats: StoryBeat[] = [];
  const open = new Set(openPetitions(state).map(petition => petition.defId));
  const recent = (tick: number | undefined): tick is number => tick !== undefined && state.tick - tick < 2 * SEASON;
  // The newest ledger record of a template (its params: the names the engine wrote).
  const params = (template: string) => { const records = state.history?.records ?? [];
    for (let index = records.length - 1; index >= 0; index -= 1) if (records[index]!.template === template) return records[index]!.params ?? {};
    return {}; };
  const text = (value: unknown) => typeof value === "string" ? value : "";
  const push = (step: LegacyStepId, kind: StoryKind, illustration: StoryIllustration, tile: StoryBeat["tile"], body: Pick<StoryBeat, "title" | "line" | "advice" | "facts">) => {
    beats.push({ id: `legacy_${step}:${legacy.steps[step]}`, kind, illustration, tile, decision: null, ...body });
  };
  const came = legacy.steps;
  const answered = (defId: string) => legacy.answers[defId];
  if (recent(came.mayor_demand)) {
    const candidate = text(params("legacy.mayor_demand").candidate);
    push("mayor_demand", "legacy_mayor_demand", "ch5_event_mayor_demand", marketTile(state), { ...copy.mayorDemand, facts: candidate === "" ? [] : [copy.mayorDemand.candidate(candidate)] });
  }
  if (recent(came.royal_tax_envoy) && !open.has("royal_tax")) {
    const answer = answered("royal_tax");
    push("royal_tax_envoy", "legacy_royal_tax", "ch5_event_royal_tax_envoy", keepTile(state), { ...copy.royalTax,
      facts: answer === undefined ? [] : legacy.royalSubsidy > 0 ? [copy.royalTax.paid(moneyShort(legacy.royalSubsidy))] : [copy.royalTax.petitioned] });
  }
  if (recent(came.succession) && !open.has("heir_choice")) {
    const called = params("legacy.succession"), seated = params("legacy.heir_seated");
    const lord = text(called.lord), heir = text(seated.heir);
    push("succession", "legacy_succession", "ch5_event_succession", keepTile(state), { ...copy.succession, facts: [
      ...(lord === "" ? [] : [copy.succession.lord(lord, Number(called.age ?? 0))]),
      legacy.heir !== undefined && heir !== "" ? copy.succession.heir(heir, text(seated.relation)) : copy.succession.candidates(legacy.candidates.length)] });
  }
  if (recent(came.city_seal)) push("city_seal", "legacy_city_seal", "ch5_event_city_seal_making", marketTile(state), { ...copy.citySeal, facts: [] });
  const charter = answered("borough_autonomy");
  if (recent(came.charter_sealing) && !open.has("borough_autonomy") && charter !== undefined) {
    const mayor = text(params("legacy.charter_sealed").mayor);
    push("charter_sealing", "legacy_charter", charter === "accept" ? "ch5_event_charter_sealing" : "ch5_decision_autonomy", marketTile(state), charter === "accept"
      ? { title: copy.charter.title, line: copy.charter.sealed, advice: copy.charter.advice, facts: mayor === "" ? [] : [copy.charter.mayor(mayor)] }
      : { title: copy.charter.title, line: copy.charter.refused, advice: copy.charter.advice, facts: [copy.charter.backlash(legacy.backlash)] });
  }
  if (recent(came.family_departure)) {
    const house = lordshipOf(state).house.name;
    const d = copy.departure;
    // The family's leaving has its own painting; a family that stays is the succession's manor hall.
    push("family_departure", "legacy_departure", legacy.family === "departed" ? "ch5_event_family_departure" : "ch5_event_succession", manorTile(state),
      legacy.family === "departed" ? { title: d.departedTitle, line: d.departed(house), advice: d.departedAdvice, facts: [] }
        : { title: d.stayedTitle, line: d.stayed(house), advice: d.stayedAdvice, facts: [] });
  }
  if (recent(came.legacy_record)) {
    const axis = legacy.legacy ?? null;
    push("legacy_record", "legacy_record", "ch5_event_legacy_record", axis === "town" ? marketTile(state) : axis === "church" ? churchTile(state) : manorTile(state),
      { ...copy.legacyRecord, facts: [axis === null ? copy.legacyRecord.none : copy.legacyRecord.chosen(legacyWord(axis))] });
  }
  if (recent(came.last_market)) {
    const ending = legacyEnding(state);
    push("last_market", "legacy_last_market", "ch5_event_last_market", marketTile(state), { ...copy.lastMarket, facts: ending === null ? [] : [copy.lastMarket.ending(ending.title)] });
  }
  beats.push(...interludeBeats(state, open, recent));
  return beats;
}

/** UI-10 (FIX-9 LG-13): the interlude's beats, each with its Wave 33 painting (the two petitions' once answered). */
function interludeBeats(state: GameState, open: ReadonlySet<string>, recent: (tick: number | undefined) => tick is number): readonly StoryBeat[] {
  const legacy = legacyOf(state)!;
  const copy = EVENT_STORY_COPY.interlude;
  const KIND: Readonly<Record<LegacyInterludeId, StoryKind>> = { staple: "interlude_staple", guild_dispute: "interlude_guild_dispute", market_fire: "interlude_market_fire",
    church_rebuilding: "interlude_church_rebuilding", deposition: "interlude_deposition" };
  const beats: StoryBeat[] = [];
  for (const entry of legacyInterludes(state)) {
    const tick = legacy.interludes?.[entry.id];
    if (!recent(tick)) continue;
    if ((entry.id === "guild_dispute" && open.has(GUILD_DISPUTE_PETITION_ID)) || (entry.id === "church_rebuilding" && open.has(CHURCH_REBUILDING_PETITION_ID))) continue;
    const body = entry.id === "staple" ? { ...copy.staple, facts: [copy.staple.fact] }
      : entry.id === "guild_dispute" ? { ...copy.guildDispute, facts: [] }
      : entry.id === "market_fire" ? { ...copy.marketFire, facts: [copy.marketFire.repair(moneyShort(LEGACY_BALANCE.marketFireRepair))] }
      : entry.id === "church_rebuilding" ? { ...copy.churchRebuilding, facts: legacy.answers[CHURCH_REBUILDING_PETITION_ID] === undefined ? []
        : [legacy.naveRebuilt === true ? copy.churchRebuilding.rebuilt : copy.churchRebuilding.deferred] }
      : { ...copy.deposition, facts: [] };
    const tile = entry.id === "church_rebuilding" ? churchTile(state) : entry.id === "deposition" ? keepTile(state) : marketTile(state);
    beats.push({ id: `interlude_${entry.id}:${tick}`, kind: KIND[entry.id], illustration: interludeImageId(entry.id), tile, decision: null,
      title: body.title, line: body.line, advice: body.advice, facts: body.facts });
  }
  return beats;
}

/**
 * UI-10: the steward's line for chapter 5 — the next step (with its date) or the interlude's next event, when it comes
 * within a season.
 */
function legacyStewardLine(state: GameState): { readonly key: string; readonly text: string } | null {
  const coming = [
    ...legacyForecast(state).filter(step => step.state === "ahead" && step.tick !== null)
      .map(step => ({ key: step.id, tick: step.tick!, label: SEASON_STRIP_COPY.legacy[step.id] })),
    ...legacyInterludes(state).filter(entry => entry.state === "ahead").map(entry => ({ key: entry.id, tick: entry.tick, label: SEASON_STRIP_COPY.interlude[entry.id] })),
  ].filter(entry => entry.tick > state.tick && entry.tick - state.tick <= SEASON).sort((a, b) => a.tick - b.tick)[0];
  return coming === undefined ? null : { key: `legacy:${coming.key}:${coming.tick}`, text: EVENT_STORY_COPY.stewardLegacy.soon(coming.label) };
}

/**
 * UI-4 forecast (the ladder's rumour and sign): the steward's one line for the nearest coming fire or dearth;
 * UI-6: the war's; UI-8: the plague's (while rumour, arrival, or second pestilence active); UI-10: chapter 5's.
 */
export function forecastStewardLine(state: GameState): { readonly key: string; readonly text: string } | null {
  const war = warOf(state);
  if (war !== undefined) {
    const lines = EVENT_STORY_COPY.stewardWar;
    if (beaconLit(state)) return { key: `war:beacon:${war.messengerTick}`, text: lines.beacon };
    if (state.tick - war.messengerTick < SEASON) return { key: `war:messenger:${war.messengerTick}`, text: lines.messenger };
    const raid = warForecast(state).find(step => step.id === "raid" && step.state === "ahead");
    if (raid !== undefined && raid.tick - state.tick < 4 * SEASON) return { key: `war:raid:${raid.tick}`, text: lines.raidAhead(stateCalendar({ ...state, tick: raid.tick }).year) };
  }
  // UI-8: plague steward line — rumour before arrival, active arrival, and the second pestilence.
  const plague = state.plague;
  if (plague !== undefined) {
    const plines = EVENT_STORY_COPY.stewardPlague;
    const stage = plagueStage(state);
    if (plague.second !== undefined && plague.second.endTick === undefined)
      return { key: `plague:second:${plague.second.arrivalTick}`, text: plines.second };
    if (stage === "arrival" && plague.first !== undefined)
      return { key: `plague:arrival:${plague.first.arrivalTick}`, text: plines.arrival };
    if (stage === "rumour" && plague.rumourTick !== undefined)
      return { key: `plague:rumour:${plague.rumourTick}`, text: plines.rumour };
  }
  // UI-10: chapter 5's next step or interlude event.
  const legacy = legacyStewardLine(state);
  if (legacy !== null) return legacy;
  const entry = eventForecast(state).find(candidate => candidate.stage === "rumour" || candidate.stage === "sign");
  if (entry === undefined) return null;
  const lines = EVENT_STORY_COPY.steward;
  const text = entry.kind === "fire" ? lines.fire(entry.stage === "sign") : entry.defId === GREAT_FAMINE_EVENT_ID ? lines.famine(entry.stage === "sign") : lines.dearth(entry.stage === "sign");
  return { key: `forecast:${entry.id}:${entry.stage}`, text };
}

/** UI-6: where the beacon or the burning quay stands (render/warWorldProps), as the chip's [위치로] tile. */
function spotTile(spot: { readonly tx: number; readonly ty: number } | null) {
  return spot === null ? null : { tx: spot.tx, ty: spot.ty };
}

function keepTile(state: GameState) {
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "chapel" || building.kind === "church");
  return keep === undefined ? null : { tx: keep.tx, ty: keep.ty };
}

/** UI-8: the church or chapel tile (for beats centred on the curacy — priest death, new graves). */
function churchTile(state: GameState) {
  const church = state.buildings.find(building => building.kind === "church" || building.kind === "chapel");
  return church === undefined ? null : { tx: church.tx, ty: church.ty };
}
/** UI-10: the lord's seat in the world — the keep, where the petitioners gather at the manor gate (null without one). */
function manorTile(state: GameState) {
  const keep = state.buildings.find(building => building.kind === "keep");
  return keep === undefined ? null : { tx: keep.tx, ty: keep.ty };
}
function marketTile(state: GameState) {
  const market = state.buildings.find(building => building.kind === "market");
  return market === undefined ? null : { tx: market.tx, ty: market.ty };
}
