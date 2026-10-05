import { WEATHER_SHADOW_ART } from './art/weatherShadowArt';
import type { GameState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import { presentationPreference } from "./presentationPreferences";
import { drawWeatherSprite, weatherFrameCount, weatherImage, weatherMeanColour, weatherMeta, weatherPattern } from "./weatherArt";
import { engineWeather, RAIN_DRAW, weatherLayers, type WeatherLayer, type LegacyWeatherLayer } from "./weatherLayers";
import { CLOUD_DECKS, cloudSprites, fogAnchors, fogRect, landSpots, laneSprites, rectsMeet, type FogAnchor, type LandSpot, type Rect } from "./weatherPlacement";
import { weatherProofOverride } from "./weatherProof";

// INSTALL-23 weather drawing (the layers: weatherLayers.ts; where: weatherPlacement.ts). Two passes on the world
// canvas only — the HUD is DOM above it and never gets weather:
//  - drawWeatherGround, in the ground pass after the season decals: the wet sheen and puddle ripples, the cracked
//    ground (under the buildings, so they stay on the ground);
//  - drawWeatherSky, over the world after the objects (wetSummer.ts drawStoryWorldOverlays): tints, cloud shadows,
//    fog, mist, dust and rain.
// Each layer draws with globalAlpha = its alpha and its blend, and returns before touching the context when its art
// is not loaded (Node: never), so nothing changes where no weather is drawn. Animation by presentation time (nowMs).
export const WEATHER_GROUND_MIN_ZOOM = 0.5;
export const SHEEN_SIZE = { width: 256 * 0.5, height: 128 * 0.5 } as const;
const RIPPLE_SIZE = { width: 64, height: 32 } as const;
export const CRACK_SIZE = { width: 128, height: 64 } as const;
const RIPPLE_FRAME_MS = 170;
const WET_SPOT_SALT = 23_203, CRACK_SPOT_SALT = 23_211;
// Lanes (view px): dust gusts twice their art size so they read at a glance; two decks of cold mist.
const LANES: Readonly<Record<string, { readonly size: { readonly width: number; readonly height: number }; readonly gap: number; readonly perRow: number;
  readonly speeds: readonly number[]; readonly salt: number }>> = {
  dust_wind: { size: { width: 512, height: 256 }, gap: 262, perRow: 3, speeds: [70, 52, 86, 60], salt: 23_401 },
  cold_mist: { size: { width: 512 * 1.1, height: 256 * 1.1 }, gap: 290, perRow: 2, speeds: [11, 16, 8, 13], salt: 23_409 },
  cold_mist_high: { size: { width: 512 * 1.4, height: 256 * 1.4 }, gap: 370, perRow: 2, speeds: [-7, -10, -6], salt: 23_417 },
};
const SKY_ORDER: Readonly<Record<string, number>> = { overcast: 0, frost_tint: 0, cloud_shadows_high: 1, cloud_shadows: 1, river_fog: 2, cold_mist_high: 2,
  cold_mist: 3, dust_wind: 3, drizzle: 4, storm: 4 };

/** The layers presented now: the engine's weather (or the proof hook's), the two switches. */
export function presentedWeatherLayers(state: GameState): readonly WeatherLayer[] {
  const engine = engineWeather(state);
  const proof = weatherProofOverride();
  return weatherLayers({
    weather: proof !== null && "weather" in proof && proof.weather !== undefined ? proof.weather : engine.weather,
    seasonTick: proof?.seasonTick ?? engine.seasonTick,
    enabled: presentationPreference("weatherFx"), rain: presentationPreference("rainOverlay"),
  });
}

// Cache (AGENTS rule 10): the map's fog banks; key: the tiles array and the seed (terrain is fixed once the map is
// made; a new tiles array rescans). Reason: the shore scan walks every tile with its four neighbours and checks each
// pick against the banks kept, every frame of a wet season otherwise. Measured: 0.64 ms per scan (Node, the seed 2
// chapter-2 map, 4,096 tiles; docs/verification/install23/weather/weather.json "cost.fogAnchorsMs"), against ~0 cached.
let fogCache: { readonly tiles: readonly Tile[]; readonly seed: number; readonly anchors: readonly FogAnchor[] } | null = null;
export function mapFogAnchors(state: Pick<GameState, "tiles" | "seed" | "width" | "height">): readonly FogAnchor[] {
  if (fogCache === null || fogCache.tiles !== state.tiles || fogCache.seed !== state.seed) {
    fogCache = { tiles: state.tiles, seed: state.seed, anchors: fogAnchors(state.seed, state.tiles, state.width, state.height) };
  }
  return fogCache.anchors;
}

/** The wet spots (sheen + ripple) among `tiles`: clear of every fog bank's reach. */
export function wetSpots(state: Pick<GameState, "tiles" | "seed" | "width" | "height">, tiles: readonly Tile[]): readonly LandSpot[] {
  return landSpots(state.seed, tiles, WET_SPOT_SALT, { roads: true, size: SHEEN_SIZE, clearOf: mapFogAnchors(state).map(anchor => anchor.reach) });
}
export function crackSpots(state: Pick<GameState, "seed">, tiles: readonly Tile[]): readonly LandSpot[] {
  return landSpots(state.seed, tiles, CRACK_SPOT_SALT, { roads: false, size: CRACK_SIZE, clearOf: [] });
}

const centred = (spot: { readonly x: number; readonly y: number }, size: { readonly width: number; readonly height: number }): Rect =>
  ({ x: spot.x - size.width / 2, y: spot.y - size.height / 2, ...size });

/** Runs `draw` with the layer's alpha and blend, only when all its art is loaded. */
function withLayer(context: CanvasRenderingContext2D, layer: LegacyWeatherLayer, draw: () => void): void {
  if (layer.assets.some(key => weatherImage(key) === null)) return;
  context.save();
  context.globalAlpha = layer.alphaPermille / 1000;
  context.globalCompositeOperation = layer.blend;
  try { draw(); } finally { context.restore(); }
}

export function drawWeatherGround(context: CanvasRenderingContext2D, state: GameState, tiles: readonly Tile[], zoom: number, nowMs: number): void {
  if (zoom < WEATHER_GROUND_MIN_ZOOM) return;
  const layers = presentedWeatherLayers(state).filter(layer => layer.pass === "ground");
  for (const layer of layers) {
    if (layer.placement === "clouds") continue;
    withLayer(context, layer, () => {
      const key = layer.assets[0]!;
      if (layer.id === "cracked_ground") { for (const spot of crackSpots(state, tiles)) drawWeatherSprite(context, key, 0, centred(spot, CRACK_SIZE)); return; }
      const ripple = layer.id === "puddle_ripples";
      for (const spot of wetSpots(state, tiles)) {
        drawWeatherSprite(context, key, ripple ? Math.floor(nowMs / RIPPLE_FRAME_MS) + spot.hash : 0, centred(spot, ripple ? RIPPLE_SIZE : SHEEN_SIZE));
      }
    });
  }
}

function drawFill(context: CanvasRenderingContext2D, layer: LegacyWeatherLayer, viewport: { readonly width: number; readonly height: number }, pixelRatio: number, nowMs: number): void {
  const key = layer.assets[0]!;
  const rain = key === "drizzle_sheet" || key === "storm_rain_sheet" ? RAIN_DRAW[key] : null;
  // A tint is its flat mean colour (weatherMeanColour's cache note); rain is its sheet's cells repeated, falling.
  let style: CanvasPattern | string | null = rain === null ? weatherMeanColour(key) : null;
  if (rain !== null) {
    const pattern = weatherPattern(context, key, Math.floor(nowMs / rain.frameMs) % weatherFrameCount(key));
    if (pattern === null || typeof DOMMatrix === "undefined") return;
    const cell = weatherMeta(key);
    const fall = (nowMs / 1000) * rain.fallPxPerS;
    const size = "frames" in cell && "cellHeight" in cell.frames ? cell.frames.cellHeight : cell.height;
    // The cell is cut at its scale (weatherArt.ts); whole-pixel steps and no smoothing keep its streak share on screen.
    const span = Math.round(size * rain.scale);
    pattern.setTransform(new DOMMatrix().translate(-Math.round((fall * rain.slant) % span), Math.round(fall % span)));
    context.imageSmoothingEnabled = false;
    style = pattern;
  }
  if (style === null) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.fillStyle = style;
  context.fillRect(0, 0, viewport.width, viewport.height);
}

function drawLanes(context: CanvasRenderingContext2D, layer: LegacyWeatherLayer, viewport: { readonly width: number; readonly height: number }, pixelRatio: number, nowMs: number): void {
  const spec = LANES[layer.id];
  if (spec === undefined) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  for (const sprite of laneSprites(viewport, nowMs, spec.size, spec.gap, spec.speeds, spec.salt, spec.perRow)) {
    drawWeatherSprite(context, layer.assets[sprite.variant % layer.assets.length]!, 0, { x: sprite.x, y: sprite.y, ...spec.size });
  }
}

export function drawWeatherSky(context: CanvasRenderingContext2D, state: GameState, viewport: { readonly width: number; readonly height: number }, zoom: number, nowMs: number): void {
  const layers = presentedWeatherLayers(state).filter(layer => layer.pass === "sky");
  if (layers.length === 0 || typeof context.getTransform !== "function") return;
  const transform = context.getTransform();
  const pixelRatio = transform.a / zoom;
  // The world rect in view (world px), for the anchored layers.
  const view: Rect = { x: -transform.e / transform.a, y: -transform.f / transform.d, width: viewport.width * pixelRatio / transform.a, height: viewport.height * pixelRatio / transform.d };
  const shadows = layers.some(layer => layer.placement === 'clouds') ? WEATHER_SHADOW_ART.resolve('normal') : null;
  for (const layer of [...layers].sort((a, b) => (SKY_ORDER[a.id] ?? 0) - (SKY_ORDER[b.id] ?? 0))) {
    if (layer.placement === 'clouds') {
      if (shadows === null || shadows[layer.deck] === null) continue;
      const deck = CLOUD_DECKS[layer.deck === 'upper' ? 1 : 0];
      if (deck === undefined) continue;
      context.save();
      try {
        context.globalAlpha = layer.alphaPermille / 1000;
        context.globalCompositeOperation = layer.blend;
        for (const cloud of cloudSprites(deck, view, nowMs)) WEATHER_SHADOW_ART.drawResolved(context, shadows, layer.deck,
          { origin: { x: cloud.x, y: cloud.y }, size: deck.size });
      } finally { context.restore(); }
      continue;
    }
    withLayer(context, layer, () => {
      if (layer.placement === "fill") drawFill(context, layer, viewport, pixelRatio, nowMs);
      else if (layer.placement === "lanes") drawLanes(context, layer, viewport, pixelRatio, nowMs);
      else if (layer.placement === "shore") {
        for (const anchor of mapFogAnchors(state)) {
          if (!rectsMeet(anchor.reach, view)) continue;
          drawWeatherSprite(context, layer.assets[anchor.hash % layer.assets.length]!, 0, fogRect(anchor, nowMs));
        }
      }
    });
  }
}
