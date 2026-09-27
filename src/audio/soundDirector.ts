import { operationSuspended, type Building } from "../content/buildingConfig";
import { GREAT_FAMINE_EVENT_ID } from "../content/eventConfig";
import type { GameState } from "../engine/engine.types";
import { openPetitions } from "../engine/politics";
import { stateCalendar } from "../engine/scenarioState";
import { constructionSiteFootprint, type ConstructionSite } from "../economy/construction";
import { isPalisadeConstructionSite, isStoneWallConstructionSite } from "../economy/palisadeConstruction";
import { constructionMaterialShare, constructionPhase, constructionStageIndex, constructionWorkProgress } from "../render/constructionVisibility";
import { heardFarmAnimals } from "../render/farmProps";
import { tileToScreen } from "../render/iso";
import { FAST_PRESENTATION_SPEED, presentationSpeed } from "../render/presentationSpeed";
import { millOvenBurning } from "../render/roofSmoke";
import { wetSummer } from "../render/wetSummer";
import { ZONE_VARIANTS } from "../render/zoneAssetManifest";
import { absoluteDay, residentWalkers, SUNDAY_WEEKDAY, weekday, type ResidentWalker } from "../render/presentation/residentTrips";
import { MAX_LOOPS, playSound, releaseLoops, setAudioListener, setLoop, spatial, type SoundId } from "./audioEngine";

// F0-V world sounds from what the state shows, once per drawn frame (the canvas runtime calls it), and AUDIO-1 (P1):
//  - construction (F0-V): a delivery unloads timber or stone, a stage change thuds, builders at work hammer (the two
//    sites nearest the view); a house's completion plays `complete`, any other building's the short fanfare.
//  - beds: the season's ambience (crossfading at the season's change, louder the further the view zooms out) and the
//    rain of a wet summer (the rain overlay's rule, `wetSummer`). Positional loops, heard by distance from the view: a mill's sails while it turns and its
//    oven while it bakes (the smoke's rule), a sawmill's saw and a quarry's hammers while they work, the market's
//    murmur while marketgoers crowd it (the market day), carts on the move, an ox team at the plough or the hay cart,
//    a sheep flock's bells, a house on fire. At most MAX_LOOPS of them, the loudest; paused, none; at 5x all loops sink
//    to FAST_LOOP_DAMP.
//  - moments: the season's stinger at its change, the church bell when Sunday comes (a chapel or church with its
//    churchgoers, at most one bell in BELL_GAP_MS) and at the chapter's end, the famine's omen bell (its rumour and
//    sign), the Great Famine's arrival, a petition's knock.
// `soundPlan` is pure over the state, the view and the memory; `observeSoundFrame` applies it to the engine.
const HAMMER_MS = 650;
const HAMMER_SITES = 2;
/** A mill's sails turn while its production moves; this long after the last move they are still. */
const SAIL_HOLD_MS = 1_500;
/** Real time between two Sunday bells (a calendar week is about four seconds at 1x). */
export const BELL_GAP_MS = 45_000;
/** Loop level at 5x (visibility design 5절: the fast town is heard, not loud). */
export const FAST_LOOP_DAMP = 0.35;
/** Marketgoers within this many tiles of a market make its murmur; this many fill it. */
const MARKET_REACH = 6;
const MARKET_CROWD = 6;
const SEASON_AMBIENCE = ["spring_ambience", "summer_ambience", "autumn_ambience", "winter_ambience"] as const satisfies readonly SoundId[];
const SEASON_STINGER = ["season_spring", "season_summer", "season_autumn", "season_winter"] as const satisfies readonly SoundId[];
const SHEEP: ReadonlySet<string> = new Set(ZONE_VARIANTS.sheepFlock);

type Point = { readonly x: number; readonly y: number };
type SiteMemory = { share: number; stage: number; x: number; y: number };
export type SoundMemory = {
  readonly sites: Map<string, SiteMemory>;
  readonly lastHammer: Map<string, number>;
  readonly mills: Map<string, { progress: number; movedMs: number }>;
  season: number | null; sunday: boolean | null; lastBellMs: number; chapterEnds: number | null; petitions: number | null;
  eventSeason: number | null; eventLines: number;
};
export const createSoundMemory = (): SoundMemory => ({ sites: new Map(), lastHammer: new Map(), mills: new Map(), season: null, sunday: null,
  lastBellMs: -Infinity, chapterEnds: null, petitions: null, eventSeason: null, eventLines: 0 });

export type SoundView = Readonly<{ centre: Point; reach: number; zoom: number }>;
export type LoopPlan = Readonly<{ key: string; id: SoundId; level: number; pan: number; bed: boolean }>;
export type SoundPlan = Readonly<{ loops: readonly LoopPlan[]; oneShots: readonly { readonly id: SoundId; readonly at?: Point }[] }>;

const screenOf = (tx: number, ty: number): Point => { const at = tileToScreen(tx, ty); return { x: at.sx, y: at.sy }; };
function siteScreen(site: ConstructionSite): Point {
  const footprint = constructionSiteFootprint(site);
  return screenOf(footprint.tx + (footprint.width - 1) / 2, footprint.ty + (footprint.height - 1) / 2);
}
const working = (building: Building) => building.workers > 0 && !operationSuspended(building);

/**
 * The ox teams and sheep flocks heard (`heardFarmAnimals`: pasture animals and field work, never the forest-edge pigs).
 * Cache — key: the zones array and the tick's 30-tick bucket (1.5 s at 1x; a plough team or a flock moves far more
 * slowly). Reason: the farm props cost 0.17 ms of the plan's 0.19 ms a frame on the seed 1 town (Mac, `farmProps`);
 * with the cache the plan is about 0.03 ms a frame.
 */
const ANIMAL_BUCKET_TICKS = 30;
let animals: { zones: unknown; bucket: number; props: ReturnType<typeof heardFarmAnimals> } | null = null;
function farmAnimals(state: GameState): ReturnType<typeof heardFarmAnimals> {
  const bucket = Math.floor(state.tick / ANIMAL_BUCKET_TICKS);
  if (animals === null || animals.zones !== state.zones || animals.bucket !== bucket) {
    animals = { zones: state.zones, bucket, props: heardFarmAnimals(state).filter(prop => prop.kind === "ox_plough_team" || prop.kind === "ox_cart_hay" || SHEEP.has(prop.kind)) };
  }
  return animals.props;
}

/** The season's ambience: its base level at close zoom, full when the view is zoomed out to 0.4. */
export function ambienceLevel(zoom: number): number {
  return 0.55 + 0.45 * Math.min(1, Math.max(0, (1.2 - zoom) / 0.8));
}

export function soundPlan(state: GameState, view: SoundView, memory: SoundMemory, nowMs: number, speed: number,
  residents: () => readonly ResidentWalker[] = () => residentWalkers(state)): SoundPlan {
  const oneShots: { id: SoundId; at?: Point }[] = [];
  const running = speed > 0;
  const heard = (at: Point) => spatial(at, { x: view.centre.x, y: view.centre.y, reach: view.reach });
  // Construction (F0-V).
  const live = new Set<string>();
  const sites: { readonly site: ConstructionSite; readonly at: Point }[] = [];
  for (const site of state.constructionSites) {
    if (isPalisadeConstructionSite(site) || isStoneWallConstructionSite(site)) continue;
    live.add(site.id);
    const at = siteScreen(site);
    const share = constructionMaterialShare(site);
    const stage = constructionStageIndex(constructionWorkProgress(site));
    const before = memory.sites.get(site.id);
    if (before !== undefined) {
      if (share > before.share) oneShots.push({ id: ((site.required.stone ?? 0) > 0 && (site.delivered.stone ?? 0) > 0 && (site.required.timber ?? 0) === 0) ? "unload_stone" : "unload_wood", at });
      if (stage > before.stage) oneShots.push({ id: "stage_thud", at });
    }
    memory.sites.set(site.id, { share, stage, x: at.x, y: at.y });
    if (running && constructionPhase(site) === "work" && site.assignedBuilders > 0) sites.push({ site, at });
  }
  const built = new Map(state.buildings.map(building => [building.id, building]));
  for (const [id, entry] of memory.sites) {
    if (live.has(id)) continue;
    const building = built.get(id);
    if (building !== undefined) oneShots.push({ id: building.kind === "house" ? "complete" : "fanfare", at: entry });
    memory.sites.delete(id); memory.lastHammer.delete(id);
  }
  const nearest = sites.sort((a, b) => Math.hypot(a.at.x - view.centre.x, a.at.y - view.centre.y) - Math.hypot(b.at.x - view.centre.x, b.at.y - view.centre.y)).slice(0, HAMMER_SITES);
  for (const { site, at } of nearest) {
    const last = memory.lastHammer.get(site.id) ?? 0;
    const jitter = (site.id.charCodeAt(site.id.length - 1) % 5) * 40;
    if (nowMs - last < HAMMER_MS + jitter) continue;
    memory.lastHammer.set(site.id, nowMs);
    oneShots.push({ id: (["hammer_1", "hammer_2", "hammer_3"] as const)[Math.floor(nowMs / HAMMER_MS) % 3]!, at });
  }

  // Positional loops: every candidate with how loud it is heard; the loudest MAX_LOOPS are kept.
  const candidates: LoopPlan[] = [];
  const push = (key: string, id: SoundId, level: number, pan: number) => { if (level >= 0.03) candidates.push({ key, id, level, pan, bed: false }); };
  const candidate = (key: string, id: SoundId, at: Point, intensity: number) => { const { gain, pan } = heard(at); push(key, id, gain * intensity, pan); };
  if (running) {
    for (const building of state.buildings) {
      const at = () => screenOf(building.tx, building.ty);
      if (building.kind === "mill") {
        const seen = memory.mills.get(building.id);
        if (seen === undefined || seen.progress !== building.productionProgress) memory.mills.set(building.id, { progress: building.productionProgress, movedMs: seen === undefined ? -Infinity : nowMs });
        if (working(building) && nowMs - (memory.mills.get(building.id)?.movedMs ?? -Infinity) < SAIL_HOLD_MS) candidate(`mill:${building.id}`, "mill_loop", at(), 1);
        if (millOvenBurning(building)) candidate(`oven:${building.id}`, "oven_loop", at(), 0.8);
      } else if (building.kind === "sawmill" && working(building)) candidate(`saw:${building.id}`, "saw_loop", at(), 1);
      else if (building.kind === "quarry" && working(building)) candidate(`quarry:${building.id}`, "quarry_loop", at(), 1);
    }
    const markets = state.buildings.filter(building => building.kind === "market");
    if (markets.length > 0) {
      const goers = residents().filter(walker => walker.resident.purpose === "market");
      for (const market of markets) {
        const crowd = goers.filter(walker => Math.hypot(walker.position.tx - market.tx, walker.position.ty - market.ty) <= MARKET_REACH).length;
        if (crowd > 0) candidate(`market:${market.id}`, "market_loop", screenOf(market.tx, market.ty), Math.min(1, crowd / MARKET_CROWD));
      }
    }
    // Carts (F0-V's loop): as loud as the nearest, fuller with more of them (three fill it), from where they are.
    const carts = state.walkers.filter(walker => walker.kind === "carter").map(walker => heard(screenOf(walker.position.tx, walker.position.ty)))
      .filter(cart => cart.gain > 0.03);
    if (carts.length > 0) push("cart", "cart_loop", Math.min(1, carts.length / 3) * Math.max(...carts.map(cart => cart.gain)),
      carts.reduce((sum, cart) => sum + cart.pan, 0) / carts.length);
    for (const prop of farmAnimals(state)) {
      if (prop.kind === "ox_plough_team" || prop.kind === "ox_cart_hay") candidate(`ox:${prop.id}`, "ox_loop", screenOf(prop.x, prop.y), 1);
      else if (SHEEP.has(prop.kind)) candidate(`sheep:${prop.id}`, "sheep_loop", screenOf(prop.x, prop.y), 0.8);
    }
    for (const fire of state.events?.burning ?? []) {
      const building = built.get(fire.buildingId);
      if (building !== undefined) candidate(`fire:${fire.buildingId}`, "fire_loop", screenOf(building.tx, building.ty), 1);
    }
  }
  const damp = speed >= FAST_PRESENTATION_SPEED ? FAST_LOOP_DAMP : 1;
  const loops: LoopPlan[] = candidates.sort((a, b) => b.level - a.level || a.key.localeCompare(b.key)).slice(0, MAX_LOOPS)
    .map(loop => ({ ...loop, level: Math.min(1, loop.level) * damp }));

  // Beds: the season's ambience (crossfading), the wet summer's rain.
  const calendar = stateCalendar(state);
  for (const [season, id] of SEASON_AMBIENCE.entries()) {
    loops.push({ key: `ambience:${season}`, id, level: season === calendar.season ? ambienceLevel(view.zoom) * damp : 0, pan: 0, bed: true });
  }
  loops.push({ key: "rain", id: "rain_loop", level: wetSummer(state) ? 0.8 * damp : 0, pan: 0, bed: true });

  // Moments.
  if (memory.season !== null && memory.season !== calendar.season) oneShots.push({ id: SEASON_STINGER[calendar.season] });
  memory.season = calendar.season;
  const sunday = weekday(absoluteDay(state.tick)) === SUNDAY_WEEKDAY;
  if (sunday && memory.sunday === false && speed < FAST_PRESENTATION_SPEED && nowMs - memory.lastBellMs >= BELL_GAP_MS) {
    const church = state.buildings.find(building => building.kind === "church") ?? state.buildings.find(building => building.kind === "chapel");
    if (church !== undefined && residents().some(walker => walker.resident.purpose === "church")) {
      oneShots.push({ id: "church_bell", at: screenOf(church.tx, church.ty) });
      memory.lastBellMs = nowMs;
    }
  }
  memory.sunday = sunday;
  const ends = state.politics?.chapterEnds.length ?? 0;
  if (memory.chapterEnds !== null && ends > memory.chapterEnds) { oneShots.push({ id: "church_bell" }); memory.lastBellMs = nowMs; }
  memory.chapterEnds = ends;
  const petitions = openPetitions(state).length;
  if (memory.petitions !== null && petitions > memory.petitions) oneShots.push({ id: "petition_arrival" });
  memory.petitions = petitions;
  const current = state.seasons?.current;
  const lines = current?.events ?? [];
  const known = memory.eventSeason === (current?.startTick ?? null) ? memory.eventLines : lines.length;
  for (const line of lines.slice(Math.min(known, lines.length))) {
    if (!("defId" in line) || line.defId !== GREAT_FAMINE_EVENT_ID) continue;
    if (line.kind === "event_rumour" || line.kind === "event_sign") oneShots.push({ id: "famine_omen_bell" });
    else if (line.kind === "event_arrived") oneShots.push({ id: "great_famine" });
  }
  memory.eventSeason = current?.startTick ?? null; memory.eventLines = lines.length;
  return { loops, oneShots };
}

const memory = createSoundMemory();

export function observeSoundFrame(state: GameState, camera: { readonly zoom: number; readonly panX: number; readonly panY: number },
  viewport: { readonly width: number; readonly height: number }, nowMs: number): void {
  const centre = { x: (viewport.width / 2 - camera.panX) / camera.zoom, y: (viewport.height / 2 - camera.panY) / camera.zoom };
  const reach = Math.hypot(viewport.width, viewport.height) / 2 / camera.zoom;
  setAudioListener(centre.x, centre.y, reach);
  const plan = soundPlan(state, { centre, reach, zoom: camera.zoom }, memory, nowMs, presentationSpeed());
  for (const shot of plan.oneShots) playSound(shot.id, shot.at);
  for (const loop of plan.loops) setLoop(loop.key, loop.id, loop.level, { pan: loop.pan, bed: loop.bed });
  releaseLoops(new Set(plan.loops.map(loop => loop.key)));
}

/** A placement attempt's answer: placed (an action dispatched) or refused (a failure message). */
export function playPlacementSound(attempt: { readonly action: unknown | null; readonly feedback: { readonly kind: string } | null } | null): void {
  if (attempt === null) return;
  if (attempt.action !== null) playSound("place_ok");
  else if (attempt.feedback?.kind === "failure") playSound("place_blocked");
}
