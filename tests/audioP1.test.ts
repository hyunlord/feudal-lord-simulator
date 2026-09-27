import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { audioSettings, MAX_LOOPS, setAudioSettings, SOUND_BANK, type SoundId } from "../src/audio/audioEngine";
import { ambienceLevel, BELL_GAP_MS, createSoundMemory, FAST_LOOP_DAMP, soundPlan, type SoundPlan } from "../src/audio/soundDirector";
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { weatherAt } from "../src/engine/eventSchedule";
import { initialPolitics } from "../src/engine/politics";
import { tileToScreen } from "../src/render/iso";
import { decodeSave } from "../src/save/saveCodec";
import { dayStartTick, SUNDAY_WEEKDAY, type ResidentWalker } from "../src/ui/residentTrips";

// AUDIO-1 sound P1 (visibility design 6절 P1): the bank, and the director's plan over a town (fixtures v17
// population-176: two mills, a sawmill, a chapel, carts) set up for each sound.

const ROOT = join(import.meta.dirname, "..");
const loaded = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v17/population-176.save.json"))).envelope.state as GameState;
const base: GameState = { ...loaded, politics: loaded.politics ?? initialPolitics(loaded) };
const mill = base.buildings.find(building => building.kind === "mill")!;
const sawmill = base.buildings.find(building => building.kind === "sawmill")!;
const chapel = base.buildings.find(building => building.kind === "chapel")!;
const house = base.buildings.find(building => building.kind === "house")!;
const at = (building: Pick<Building, "tx" | "ty">) => { const point = tileToScreen(building.tx, building.ty); return { x: point.sx, y: point.sy }; };
const view = (building: Pick<Building, "tx" | "ty">, zoom = 1) => ({ centre: at(building), reach: 700, zoom });
const SEASON = 1_000;
const inSeason = (season: number) => Math.floor(base.tick / 4_000) * 4_000 + season * SEASON + 400;
const loop = (plan: SoundPlan, key: string) => plan.loops.find(entry => entry.key === key);
const positional = (plan: SoundPlan) => plan.loops.filter(entry => !entry.bed);
const shots = (plan: SoundPlan) => plan.oneShots.map(shot => shot.id);
const resident = (purpose: ResidentWalker["resident"]["purpose"], tx: number, ty: number, index: number) =>
  ({ id: `resident:${purpose}:${index}`, position: { tx, ty }, resident: { purpose } }) as unknown as ResidentWalker;

const P1: readonly SoundId[] = ["summer_ambience", "autumn_ambience", "winter_ambience", "mill_loop", "oven_loop", "saw_loop", "quarry_loop", "market_loop",
  "church_bell", "ox_loop", "sheep_loop", "fire_loop", "rain_loop", "famine_omen_bell", "petition_arrival", "great_famine",
  "season_spring", "season_summer", "season_autumn", "season_winter", "unlock_banner", "fanfare"];

test("AUDIO-1 bank: 37 sounds (P0 15 + P1 22) on three buses, every file installed and every one in the licences with its source", () => {
  const ids = Object.keys(SOUND_BANK) as SoundId[];
  assert.equal(ids.length, 37);
  assert.deepEqual(P1.filter(id => !ids.includes(id)), []);
  assert.deepEqual(ids.filter(id => !existsSync(join(ROOT, "public", SOUND_BANK[id].file))), []);
  const licences = readFileSync(join(ROOT, "docs/AUDIO_LICENSES.md"), "utf8");
  assert.deepEqual(ids.filter(id => !licences.includes(`\`${id}\``)), [], "each sound has its row");
  assert.ok(existsSync(join(ROOT, "public/licenses/audio/Kenney-music-jingles-License.txt")));
  assert.equal(MAX_LOOPS, 4);
});

test("AUDIO-1 beds: the season's ambience crossfades at the change (one stinger), is louder zoomed out, and sinks at 5x", () => {
  const spring = { ...base, tick: inSeason(0) };
  const memory = createSoundMemory();
  const first = soundPlan(spring, view(mill), memory, 0, 1, () => []);
  assert.deepEqual([0, 1, 2, 3].map(season => loop(first, `ambience:${season}`)!.level), [ambienceLevel(1), 0, 0, 0]);
  assert.equal(shots(first).filter(id => id.startsWith("season_")).length, 0, "no stinger on the first frame");
  const summer = soundPlan({ ...base, tick: inSeason(1) }, view(mill, 0.4), memory, 100, 1, () => []);
  assert.deepEqual([0, 1].map(season => loop(summer, `ambience:${season}`)!.level), [0, 1]);
  assert.deepEqual(shots(summer).filter(id => id.startsWith("season_")), ["season_summer"]);
  const fast = soundPlan({ ...base, tick: inSeason(1) }, view(mill), memory, 200, 5, () => []);
  assert.equal(loop(fast, "ambience:1")!.level, ambienceLevel(1) * FAST_LOOP_DAMP);
  assert.ok(ambienceLevel(2) === 0.55 && ambienceLevel(0.4) === 1);
});

test("AUDIO-1 workshops: a turning mill's sails, its oven while it bakes, the saw and the quarry while they work — by distance, at most four", () => {
  const quarry = { ...sawmill, id: "quarry-test", kind: "quarry", tx: sawmill.tx + 2, ty: sawmill.ty } as Building;
  const working = (building: Building, extra: Partial<Building> = {}): Building => ({ ...building, workers: 2, operationSuspended: false, ...extra } as Building);
  const mills = base.buildings.filter(building => building.kind === "mill");
  const town = (progress: number): GameState => ({ ...base, tick: inSeason(0), buildings: [...base.buildings.map(building =>
    building.kind === "mill" ? working(building, { productionProgress: progress, inventory: { ...building.inventory, wheat: 5 } })
      : building.id === sawmill.id ? working(building) : building), working(quarry)] });
  const memory = createSoundMemory();
  soundPlan(town(10), view(sawmill), memory, 0, 1, () => []);
  const plan = soundPlan(town(11), view(sawmill), memory, 100, 1, () => []);
  const kinds = positional(plan).map(entry => entry.id).sort();
  assert.ok(positional(plan).length <= MAX_LOOPS);
  assert.ok(kinds.includes("saw_loop") && kinds.includes("quarry_loop"), kinds.join(","));
  assert.ok(positional(plan).every((entry, index, all) => index === 0 || all[index - 1]!.level >= entry.level), "the loudest first");
  const candidates = mills.length * 2 + 2;
  assert.ok(candidates > MAX_LOOPS, "more sources than loops: the cap chose");
  // A still mill (its production has not moved for 1.5 s) is silent; its oven stays while it bakes.
  const still = soundPlan(town(11), view(mills[0]!), memory, 5_000, 1, () => []);
  assert.equal(positional(still).some(entry => entry.id === "mill_loop"), false);
  assert.ok(positional(still).some(entry => entry.id === "oven_loop"));
  assert.deepEqual(positional(soundPlan(town(12), view(sawmill), memory, 5_100, 0, () => [])), [], "paused: no loop at work");
  const fast = soundPlan(town(13), view(sawmill), memory, 5_200, 5, () => []);
  assert.ok(positional(fast).every(entry => entry.level <= FAST_LOOP_DAMP + 1e-9));
});

test("AUDIO-1 market: its murmur only while marketgoers crowd it (the market day), fuller with the crowd", () => {
  const market = { ...sawmill, id: "market-test", kind: "market" } as Building;
  const state: GameState = { ...base, tick: inSeason(0), buildings: [...base.buildings, market] };
  const memory = createSoundMemory();
  const none = soundPlan(state, view(market), memory, 0, 1, () => []);
  assert.equal(loop(none, `market:${market.id}`), undefined);
  const few = soundPlan(state, view(market), memory, 100, 1, () => [resident("market", market.tx + 1, market.ty, 0), resident("market", market.tx, market.ty + 1, 1)]);
  const crowd = soundPlan(state, view(market), memory, 200, 1, () => Array.from({ length: 8 }, (_, index) => resident("market", market.tx + (index % 3), market.ty, index)));
  assert.ok(loop(few, `market:${market.id}`)!.level < loop(crowd, `market:${market.id}`)!.level);
  const far = soundPlan(state, view(market), memory, 300, 1, () => [resident("market", market.tx + 20, market.ty, 0)]);
  assert.equal(loop(far, `market:${market.id}`), undefined, "a marketgoer still on the road is not the crowd");
});

test("AUDIO-1 church bell: when Sunday comes with churchgoers, once in BELL_GAP_MS, and at the chapter's end", () => {
  const firstSunday = Math.ceil(base.tick / 78) * 7 + 70;
  const sunday = (week: number) => dayStartTick(Math.floor(firstSunday / 7) * 7 + SUNDAY_WEEKDAY + week * 7);
  const goers = () => [resident("church", chapel.tx, chapel.ty, 0)];
  const memory = createSoundMemory();
  const plan = (tick: number, nowMs: number, residents = goers) => shots(soundPlan({ ...base, tick }, view(chapel), memory, nowMs, 1, residents));
  plan(sunday(0) - 5, 0);
  assert.ok(plan(sunday(0), 100).includes("church_bell"));
  plan(sunday(1) - 5, 4_000);
  assert.equal(plan(sunday(1), 4_100).includes("church_bell"), false, "a week later in real seconds: still ringing out");
  plan(sunday(2) - 5, 100 + BELL_GAP_MS);
  assert.ok(plan(sunday(2), 200 + BELL_GAP_MS).includes("church_bell"));
  plan(sunday(3) - 5, 300 + 2 * BELL_GAP_MS, () => []);
  assert.equal(plan(sunday(3), 400 + 2 * BELL_GAP_MS, () => []).includes("church_bell"), false, "no churchgoers, no bell");
  const ended = { ...base, politics: { ...base.politics!, chapterEnds: [...base.politics!.chapterEnds, { chapter: 1, tick: base.tick } as never] } };
  const endMemory = createSoundMemory();
  soundPlan(base, view(chapel), endMemory, 0, 1, () => []);
  assert.ok(shots(soundPlan(ended, view(chapel), endMemory, 100, 1, () => [])).includes("church_bell"));
});

test("AUDIO-1 events: the famine's omen bell, its arrival, a petition's knock, a house on fire, the wet summer's rain", () => {
  const memory = createSoundMemory();
  const season = base.seasons!.current;
  const tally = (events: NonNullable<typeof season.events>) => ({ ...base, tick: inSeason(1), seasons: { ...base.seasons!, current: { ...season, events } } });
  soundPlan(tally([]), view(house), memory, 0, 1, () => []);
  const sign = soundPlan(tally([{ kind: "event_sign", eventId: "great_famine@1315", defId: "great_famine" }]), view(house), memory, 100, 1, () => []);
  assert.ok(shots(sign).includes("famine_omen_bell"));
  const arrived = soundPlan(tally([{ kind: "event_sign", eventId: "great_famine@1315", defId: "great_famine" },
    { kind: "event_arrived", eventId: "great_famine@1315", defId: "great_famine" } as never]), view(house), memory, 200, 1, () => []);
  assert.deepEqual(shots(arrived).filter(id => id === "great_famine" || id === "famine_omen_bell"), ["great_famine"], "each line sounds once");
  const petition = { id: "petition-1", defId: "market_rights", petitioner: "merchants", arrivedTick: base.tick } as never;
  const asked = soundPlan({ ...base, politics: { ...base.politics!, petitions: [petition] } }, view(house), memory, 300, 1, () => []);
  assert.ok(shots(asked).includes("petition_arrival"));
  const burning = { ...base, tick: inSeason(1), events: { records: [], burning: [{ buildingId: house.id, eventId: "fire@1", ignitedTick: base.tick, outTick: base.tick + 200, doused: false }] } };
  assert.ok(positional(soundPlan(burning, view(house), memory, 400, 1, () => [])).some(entry => entry.id === "fire_loop"));
  // The rain bed follows the summer's weather (EV schedule): wet summers rain, dry ones do not.
  const summers = Array.from({ length: 12 }, (_, year) => year * 4_000 + SEASON + 300);
  const kinds = summers.map(tick => weatherAt({ ...base, tick }).kind);
  const wetTick = summers[kinds.indexOf("wet")];
  const dryTick = summers[kinds.findIndex(kind => kind !== "wet")];
  assert.ok(wetTick !== undefined && dryTick !== undefined, kinds.join(","));
  assert.equal(loop(soundPlan({ ...base, tick: wetTick! }, view(house), memory, 500, 1, () => []), "rain")!.level, 0.8);
  assert.equal(loop(soundPlan({ ...base, tick: dryTick! }, view(house), memory, 600, 1, () => []), "rain")!.level, 0);
});

test("AUDIO-1 completion: a house its F0-V tone, any other building the short fanfare", () => {
  const memory = createSoundMemory();
  memory.sites.set(house.id, { share: 1, stage: 3, x: 0, y: 0 });
  memory.sites.set(sawmill.id, { share: 1, stage: 3, x: 0, y: 0 });
  const plan = soundPlan({ ...base, constructionSites: [] }, view(house), memory, 0, 1, () => []);
  assert.deepEqual(shots(plan).filter(id => id === "complete" || id === "fanfare").sort(), ["complete", "fanfare"]);
});

test("AUDIO-1 mixer: each bus has its own level (clamped, kept with the volume and mute)", () => {
  const before = audioSettings();
  assert.deepEqual(Object.keys(before.buses).sort(), ["alert", "ui", "world"]);
  setAudioSettings({ volume: 0.6, muted: false, buses: { ui: 0.3, alert: 2, world: -1 } });
  assert.deepEqual(audioSettings(), { volume: 0.6, muted: false, buses: { ui: 0.3, alert: 1, world: 0 } });
  setAudioSettings({ volume: 0.5, muted: true });
  assert.deepEqual(audioSettings().buses, { ui: 0.3, alert: 1, world: 0 }, "a volume change keeps the bus levels");
  setAudioSettings(before);
});
