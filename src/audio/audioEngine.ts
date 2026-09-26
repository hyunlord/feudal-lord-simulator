import { platformServices } from "../platform/platform";

// F0-V sound (visibility design 6절, P0 15): the first sounds of the game. Web Audio, browser only (Node and a page
// without AudioContext play nothing and log nothing). Three buses (ui, alert, world) under one master gain; world
// sounds fade with their distance from the view's centre and pan left / right; at most MAX_LOOPS world loops at once.
// The context starts on the player's first press or key (browser autoplay rule). Volume and mute are the player's
// preference (platform preferences, not the save).
export type SoundBus = "ui" | "alert" | "world";
export type SoundId = "place_ok" | "place_cancel" | "place_blocked" | "alert_info" | "alert_warn" | "alert_urgent"
  | "hammer_1" | "hammer_2" | "hammer_3" | "unload_wood" | "unload_stone" | "stage_thud" | "complete" | "cart_loop" | "spring_ambience";

/** The 15 sounds: file (public/audio, scripts/buildAudio.sh), bus and base gain. */
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
};
export const MAX_LOOPS = 4;
const PREFERENCE_KEY = "feudal-lord-simulator:audio:v1";
export type AudioSettings = Readonly<{ volume: number; muted: boolean }>;

let context: AudioContext | null = null;
let master: GainNode | null = null;
const buses = new Map<SoundBus, GainNode>();
const buffers = new Map<SoundId, AudioBuffer>();
const loops = new Map<string, { readonly source: AudioBufferSourceNode; readonly gain: GainNode }>();
let listener = { x: 0, y: 0, reach: 800 };
let settings: AudioSettings = readSettings();
const played: { id: SoundId; atMs: number }[] = [];

function readSettings(): AudioSettings {
  try {
    const raw = platformServices().preferences.get(PREFERENCE_KEY);
    if (raw !== null) {
      const value = JSON.parse(raw) as Partial<AudioSettings>;
      return { volume: typeof value.volume === "number" ? Math.max(0, Math.min(1, value.volume)) : 0.7, muted: value.muted === true };
    }
  } catch { /* no stored choice */ }
  return { volume: 0.7, muted: false };
}

export function audioSettings(): AudioSettings { return settings; }
export function setAudioSettings(next: AudioSettings): void {
  settings = { volume: Math.max(0, Math.min(1, next.volume)), muted: next.muted };
  try { platformServices().preferences.set(PREFERENCE_KEY, JSON.stringify(settings)); } catch { /* keep in memory */ }
  if (master !== null) master.gain.value = settings.muted ? 0 : settings.volume;
}

/** Starts the context and loads the bank (call from a user gesture; later calls do nothing). */
export function unlockAudio(baseUrl = "/"): void {
  if (context !== null || typeof AudioContext !== "function") return;
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = settings.muted ? 0 : settings.volume;
  master.connect(context.destination);
  for (const bus of ["ui", "alert", "world"] as const) { const gain = context.createGain(); gain.connect(master); buses.set(bus, gain); }
  for (const [id, entry] of Object.entries(SOUND_BANK) as [SoundId, typeof SOUND_BANK[SoundId]][]) {
    void fetch(`${baseUrl}${entry.file}`).then(response => response.arrayBuffer()).then(data => context!.decodeAudioData(data))
      .then(buffer => { buffers.set(id, buffer); }).catch(() => undefined);
  }
}

/** Where the view is (world screen coordinates) and how far a world sound still carries (half the view's diagonal). */
export function setAudioListener(x: number, y: number, reach: number): void { listener = { x, y, reach: Math.max(200, reach) }; }

function spatial(at: { readonly x: number; readonly y: number } | undefined): { readonly gain: number; readonly pan: number } {
  if (at === undefined) return { gain: 1, pan: 0 };
  const dx = at.x - listener.x, dy = at.y - listener.y;
  const falloff = Math.max(0, 1 - Math.hypot(dx, dy) / (listener.reach * 1.25));
  return { gain: falloff * falloff, pan: Math.max(-1, Math.min(1, dx / listener.reach)) };
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

/** Keeps a world loop at `level` (0..1 of its base gain); 0 stops it. At most MAX_LOOPS loops play. */
export function setLoop(key: string, id: SoundId, level: number): void {
  const current = loops.get(key);
  if (level <= 0.01) { if (current !== undefined) { current.source.stop(); loops.delete(key); } return; }
  if (current !== undefined) { current.gain.gain.value = SOUND_BANK[id].gain * level; return; }
  const buffer = buffers.get(id);
  const bus = buses.get(SOUND_BANK[id].bus);
  if (context === null || buffer === undefined || bus === undefined || loops.size >= MAX_LOOPS) return;
  const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
  const gain = context.createGain(); gain.gain.value = SOUND_BANK[id].gain * level;
  source.connect(gain).connect(bus);
  source.start();
  loops.set(key, { source, gain });
  played.push({ id, atMs: performance.now() });
}

/** Sounds played so far this session (the last 200), for the evidence probe. */
export function playedSounds(): readonly { readonly id: SoundId; readonly atMs: number }[] { return played; }
export function activeLoops(): readonly string[] { return [...loops.keys()]; }
