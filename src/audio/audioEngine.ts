import { platformServices } from "../platform/platform";

// F0-V sound (visibility design 6절, P0 15) and AUDIO-1 (P1: the world is alive): Web Audio, browser only (Node and a
// page without AudioContext play nothing and log nothing). Three buses (ui, alert, world), each with the player's own
// level, under one master gain; world sounds fade with their distance from the view's centre and pan left / right. Loops
// are of two sorts: positional ones (buildings at work, walkers, a fire — at most MAX_LOOPS at once, the loudest kept)
// and beds (the season's ambience, the rain) that fill the whole view. Loop levels glide (a season's ambience
// crossfades with the next in about LOOP_GLIDE_S × 3), and a loop that has faded out stops. The context starts on the
// player's first press or key (browser autoplay rule). Levels and mute are the player's preference (platform
// preferences, not the save).
export type SoundBus = "ui" | "alert" | "world";
export type SoundId = "place_ok" | "place_cancel" | "place_blocked" | "alert_info" | "alert_warn" | "alert_urgent"
  | "hammer_1" | "hammer_2" | "hammer_3" | "unload_wood" | "unload_stone" | "stage_thud" | "complete" | "cart_loop" | "spring_ambience"
  // AUDIO-1 (P1)
  | "summer_ambience" | "autumn_ambience" | "winter_ambience"
  | "mill_loop" | "oven_loop" | "saw_loop" | "quarry_loop" | "market_loop" | "church_bell"
  | "ox_loop" | "sheep_loop"
  | "fire_loop" | "rain_loop" | "famine_omen_bell" | "petition_arrival" | "great_famine"
  | "season_spring" | "season_summer" | "season_autumn" | "season_winter" | "unlock_banner" | "fanfare";

/** The sounds: file (public/audio, scripts/buildAudio.sh), bus and base gain (docs/AUDIO_LICENSES.md for each). */
export const SOUND_BANK: Readonly<Record<SoundId, { readonly file: string; readonly bus: SoundBus; readonly gain: number }>> = {
  place_ok: { file: "audio/place_ok.mp3", bus: "ui", gain: 0.55 },
  place_cancel: { file: "audio/place_cancel.mp3", bus: "ui", gain: 0.5 },
  place_blocked: { file: "audio/place_blocked.mp3", bus: "ui", gain: 0.45 },
  alert_info: { file: "audio/alert_info.mp3", bus: "alert", gain: 0.5 },
  alert_warn: { file: "audio/alert_warn.mp3", bus: "alert", gain: 0.45 },
  alert_urgent: { file: "audio/alert_urgent.mp3", bus: "alert", gain: 0.4 },
  hammer_1: { file: "audio/hammer_1.mp3", bus: "world", gain: 0.35 },
  hammer_2: { file: "audio/hammer_2.mp3", bus: "world", gain: 0.35 },
  hammer_3: { file: "audio/hammer_3.mp3", bus: "world", gain: 0.35 },
  unload_wood: { file: "audio/unload_wood.mp3", bus: "world", gain: 0.5 },
  unload_stone: { file: "audio/unload_stone.mp3", bus: "world", gain: 0.45 },
  stage_thud: { file: "audio/stage_thud.mp3", bus: "world", gain: 0.55 },
  complete: { file: "audio/complete.mp3", bus: "world", gain: 0.6 },
  cart_loop: { file: "audio/cart_loop.mp3", bus: "world", gain: 0.3 },
  spring_ambience: { file: "audio/spring_ambience.mp3", bus: "world", gain: 0.22 },
  summer_ambience: { file: "audio/summer_ambience.mp3", bus: "world", gain: 0.2 },
  autumn_ambience: { file: "audio/autumn_ambience.mp3", bus: "world", gain: 0.2 },
  winter_ambience: { file: "audio/winter_ambience.mp3", bus: "world", gain: 0.2 },
  mill_loop: { file: "audio/mill_loop.mp3", bus: "world", gain: 0.3 },
  oven_loop: { file: "audio/oven_loop.mp3", bus: "world", gain: 0.25 },
  saw_loop: { file: "audio/saw_loop.mp3", bus: "world", gain: 0.25 },
  quarry_loop: { file: "audio/quarry_loop.mp3", bus: "world", gain: 0.3 },
  market_loop: { file: "audio/market_loop.mp3", bus: "world", gain: 0.3 },
  church_bell: { file: "audio/church_bell.mp3", bus: "world", gain: 0.45 },
  ox_loop: { file: "audio/ox_loop.mp3", bus: "world", gain: 0.3 },
  sheep_loop: { file: "audio/sheep_loop.mp3", bus: "world", gain: 0.25 },
  fire_loop: { file: "audio/fire_loop.mp3", bus: "world", gain: 0.45 },
  rain_loop: { file: "audio/rain_loop.mp3", bus: "world", gain: 0.25 },
  famine_omen_bell: { file: "audio/famine_omen_bell.mp3", bus: "alert", gain: 0.5 },
  petition_arrival: { file: "audio/petition_arrival.mp3", bus: "alert", gain: 0.5 },
  great_famine: { file: "audio/great_famine.mp3", bus: "alert", gain: 0.55 },
  season_spring: { file: "audio/season_spring.mp3", bus: "ui", gain: 0.4 },
  season_summer: { file: "audio/season_summer.mp3", bus: "ui", gain: 0.4 },
  season_autumn: { file: "audio/season_autumn.mp3", bus: "ui", gain: 0.4 },
  season_winter: { file: "audio/season_winter.mp3", bus: "ui", gain: 0.4 },
  unlock_banner: { file: "audio/unlock_banner.mp3", bus: "alert", gain: 0.45 },
  fanfare: { file: "audio/fanfare.mp3", bus: "world", gain: 0.45 },
};
/** Positional loops at once (the loudest kept); beds (ambience, rain) are not counted. */
export const MAX_LOOPS = 4;
/** A loop's level glides with this time constant (s): a crossfade is about three of them. */
export const LOOP_GLIDE_S = 1;
const PREFERENCE_KEY = "feudal-lord-simulator:audio:v1";
export type BusLevels = Readonly<Record<SoundBus, number>>;
export type AudioSettings = Readonly<{ volume: number; muted: boolean; buses: BusLevels }>;
const FULL_BUSES: BusLevels = { ui: 1, alert: 1, world: 1 };

type Loop = { readonly id: SoundId; readonly source: AudioBufferSourceNode; readonly gain: GainNode; readonly panner: StereoPannerNode; readonly bed: boolean; level: number; stopAt: number | null };
let context: AudioContext | null = null;
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
const buses = new Map<SoundBus, GainNode>();
const buffers = new Map<SoundId, AudioBuffer>();
const loops = new Map<string, Loop>();
let listener = { x: 0, y: 0, reach: 800 };
let settings: AudioSettings = readSettings();
const played: { id: SoundId; atMs: number }[] = [];

const clamp01 = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

function readSettings(): AudioSettings {
  try {
    const raw = platformServices().preferences.get(PREFERENCE_KEY);
    if (raw !== null) {
      const value = JSON.parse(raw) as Partial<AudioSettings> & { buses?: Partial<Record<SoundBus, unknown>> };
      return { volume: clamp01(value.volume, 0.7), muted: value.muted === true,
        buses: { ui: clamp01(value.buses?.ui, 1), alert: clamp01(value.buses?.alert, 1), world: clamp01(value.buses?.world, 1) } };
    }
  } catch { /* no stored choice */ }
  return { volume: 0.7, muted: false, buses: FULL_BUSES };
}

export function audioSettings(): AudioSettings { return settings; }
export function setAudioSettings(next: Omit<AudioSettings, "buses"> & { readonly buses?: BusLevels }): void {
  const levels = next.buses ?? settings.buses;
  settings = { volume: clamp01(next.volume, 0.7), muted: next.muted,
    buses: { ui: clamp01(levels.ui, 1), alert: clamp01(levels.alert, 1), world: clamp01(levels.world, 1) } };
  try { platformServices().preferences.set(PREFERENCE_KEY, JSON.stringify(settings)); } catch { /* keep in memory */ }
  if (master !== null) master.gain.value = settings.muted ? 0 : settings.volume;
  for (const [bus, gain] of buses) gain.gain.value = settings.buses[bus];
}

/** Starts the context and loads the bank (call from a user gesture; later calls do nothing). */
export function unlockAudio(baseUrl = "/"): void {
  if (context !== null || typeof AudioContext !== "function") return;
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = settings.muted ? 0 : settings.volume;
  analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  master.connect(analyser);
  analyser.connect(context.destination);
  for (const bus of ["ui", "alert", "world"] as const) {
    const gain = context.createGain(); gain.gain.value = settings.buses[bus]; gain.connect(master); buses.set(bus, gain);
  }
  for (const [id, entry] of Object.entries(SOUND_BANK) as [SoundId, typeof SOUND_BANK[SoundId]][]) {
    void fetch(`${baseUrl}${entry.file}`).then(response => response.arrayBuffer()).then(data => context!.decodeAudioData(data))
      .then(buffer => { buffers.set(id, buffer); }).catch(() => undefined);
  }
}

/** Where the view is (world screen coordinates) and how far a world sound still carries (half the view's diagonal). */
export function setAudioListener(x: number, y: number, reach: number): void { listener = { x, y, reach: Math.max(200, reach) }; }

/** How loud and where a world sound at `at` is heard (1 and centre without a place). */
export function spatial(at: { readonly x: number; readonly y: number } | undefined, from = listener): { readonly gain: number; readonly pan: number } {
  if (at === undefined) return { gain: 1, pan: 0 };
  const dx = at.x - from.x, dy = at.y - from.y;
  const falloff = Math.max(0, 1 - Math.hypot(dx, dy) / (from.reach * 1.25));
  return { gain: falloff * falloff, pan: Math.max(-1, Math.min(1, dx / from.reach)) };
}

/** Plays a one-shot; `at` (world screen coordinates) makes it a world sound heard by distance. */
export function playSound(id: SoundId, at?: { readonly x: number; readonly y: number }): boolean {
  const buffer = buffers.get(id);
  const bus = buses.get(SOUND_BANK[id].bus);
  if (context === null || buffer === undefined || bus === undefined) return false;
  const { gain, pan } = spatial(at);
  if (gain < 0.03) return false;
  const source = context.createBufferSource(); source.buffer = buffer;
  const level = context.createGain(); level.gain.value = SOUND_BANK[id].gain * gain;
  const panner = context.createStereoPanner(); panner.pan.value = pan;
  source.connect(level).connect(panner).connect(bus);
  source.start();
  played.push({ id, atMs: performance.now() });
  if (played.length > 200) played.shift();
  return true;
}

/**
 * Keeps a loop at `level` (0..1 of its base gain) and `pan`, gliding there; 0 fades it out and then stops it. A bed
 * (ambience, rain) is not counted against MAX_LOOPS; a positional loop past the cap does not start.
 */
export function setLoop(key: string, id: SoundId, level: number, options: { readonly pan?: number; readonly bed?: boolean } = {}): void {
  const current = loops.get(key);
  const now = context?.currentTime ?? 0;
  if (current !== undefined) {
    if (current.id !== id) { current.source.stop(); loops.delete(key); setLoop(key, id, level, options); return; }
    const target = level <= 0.01 ? 0 : level;
    if (Math.abs(target - current.level) > 0.005) {
      current.gain.gain.setTargetAtTime(SOUND_BANK[id].gain * target, now, LOOP_GLIDE_S);
      current.level = target;
    }
    current.panner.pan.setTargetAtTime(options.pan ?? 0, now, 0.2);
    current.stopAt = target === 0 ? current.stopAt ?? now + LOOP_GLIDE_S * 4 : null;
    if (current.stopAt !== null && now >= current.stopAt) { current.source.stop(); loops.delete(key); }
    return;
  }
  if (level <= 0.01) return;
  const buffer = buffers.get(id);
  const bus = buses.get(SOUND_BANK[id].bus);
  const bed = options.bed === true;
  if (context === null || buffer === undefined || bus === undefined) return;
  if (!bed && [...loops.values()].filter(loop => !loop.bed && loop.stopAt === null).length >= MAX_LOOPS) return;
  const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
  const gain = context.createGain(); gain.gain.value = 0;
  gain.gain.setTargetAtTime(SOUND_BANK[id].gain * level, now, bed ? LOOP_GLIDE_S : 0.15);
  const panner = context.createStereoPanner(); panner.pan.value = options.pan ?? 0;
  source.connect(gain).connect(panner).connect(bus);
  source.start(0, Math.random() * buffer.duration);
  loops.set(key, { id, source, gain, panner, bed, level, stopAt: null });
  played.push({ id, atMs: performance.now() });
}

/** Stops every loop the frame no longer asks for (keys not in `keep`), fading them out. */
export function releaseLoops(keep: ReadonlySet<string>): void {
  for (const [key, loop] of loops) if (!keep.has(key)) setLoop(key, loop.id, 0);
}

/** The loops now (key, sound, the level asked, bed or not), for the evidence probe. */
export function loopLevels(): readonly { readonly key: string; readonly id: SoundId; readonly level: number; readonly bed: boolean }[] {
  return [...loops.entries()].filter(([, loop]) => loop.stopAt === null).map(([key, loop]) => ({ key, id: loop.id, level: Math.round(loop.level * 1000) / 1000, bed: loop.bed }));
}
/** How long each loaded sound is (s), for the evidence probe. */
export function loadedSounds(): Readonly<Record<string, number>> {
  return Object.fromEntries([...buffers.entries()].map(([id, buffer]) => [id, Math.round(buffer.duration * 100) / 100]));
}

/** Sounds played so far this session (the last 200), for the evidence probe. */
export function playedSounds(): readonly { readonly id: SoundId; readonly atMs: number }[] { return played; }
export function activeLoops(): readonly string[] { return [...loops.entries()].filter(([, loop]) => loop.stopAt === null).map(([key]) => key); }

/** Evidence probe: the master output's spectrum now, in eight octave bands (dB), and its overall level. */
export function audioProbe(): { readonly running: boolean; readonly bandsDb: readonly number[]; readonly rmsDb: number } | null {
  if (context === null || analyser === null) return null;
  const bins = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(bins);
  const hz = context.sampleRate / analyser.fftSize;
  const edges = [63, 125, 250, 500, 1_000, 2_000, 4_000, 8_000, 16_000];
  const bandsDb = edges.slice(0, -1).map((low, index) => {
    const from = Math.floor(low / hz), to = Math.max(from + 1, Math.floor(edges[index + 1]! / hz));
    let power = 0; for (let bin = from; bin < to && bin < bins.length; bin += 1) power += 10 ** (bins[bin]! / 10);
    return Math.round(10 * Math.log10(power + 1e-12) * 10) / 10;
  });
  const wave = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(wave);
  let sum = 0; for (const sample of wave) sum += sample * sample;
  return { running: context.state === "running", bandsDb, rmsDb: Math.round(10 * Math.log10(sum / wave.length + 1e-12) * 10) / 10 };
}
