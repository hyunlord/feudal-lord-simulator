import assert from "node:assert/strict";
import test from "node:test";

import type { WeatherKind } from "../src/content/eventConfig";
import { CORE_SCENARIOS } from "../src/content/scenario/coreScenarios";
import { SCENARIOS } from "../src/content/scenario/registry";
import { setPresentationPreference } from "../src/render/presentationPreferences";
import { WAVE23_IMAGES, type Wave23Key } from "../src/render/wave23ArtManifest.generated";
import { setWeatherArtForTest } from "../src/render/weatherArt";
import { engineWeather, SEASON_TICKS, stackedPermille, WEATHER_ALPHA_CAP_PERMILLE, WEATHER_FADE_TICKS, WET_STORM_FROM, WET_STORM_TO, weatherLayers,
  type WeatherLayer } from "../src/render/weatherLayers";
import { CRACK_SIZE, crackSpots, drawWeatherGround, drawWeatherSky, mapFogAnchors, presentedWeatherLayers, SHEEN_SIZE, wetSpots } from "../src/render/weatherOverlay";
import { CLOUD_DECKS, cloudSprites, fogRect, laneSprites, LATTICE_MAX_H, LATTICE_MAX_W, rectsMeet, tileCentre, type Rect } from "../src/render/weatherPlacement";
import { parseWeatherProof } from "../src/render/weatherProof";
import { c25BoardState } from "../scripts/c25Board";
import { recordingCanvas } from "../scripts/recordingCanvas";

// INSTALL-23 weather in the world: the layer model (the artist's 0.38 cap, moving layers, four distinct looks, the
// switches), the placement that makes the cap hold per pixel, and the draw's call stream.
const KINDS: readonly WeatherKind[] = ["normal", "wet", "dry", "cold"];
const ids = (layers: readonly WeatherLayer[]) => layers.map(layer => layer.id).sort().join(",");
const on = { enabled: true, rain: true } as const;

test("Given every weather at every tick of its season When the layers are listed Then the alpha stacked on one pixel is at most 0.38 and no layer passes its art's cap", () => {
  for (const weather of KINDS) for (const rain of [true, false]) for (let seasonTick = 0; seasonTick < SEASON_TICKS; seasonTick += 1) {
    // When
    const layers = weatherLayers({ weather, seasonTick, enabled: true, rain });

    // Then
    assert.ok(stackedPermille(layers) <= WEATHER_ALPHA_CAP_PERMILLE, `${weather} at ${seasonTick}: ${stackedPermille(layers)}`);
    for (const layer of layers) for (const key of layer.assets) {
      const meta = WAVE23_IMAGES[key];
      assert.equal(meta.group, "weather", key);
      assert.ok(layer.alphaPermille <= Math.round(meta.opacityMax * 1000), `${layer.id} ${key} ${layer.alphaPermille} > ${meta.opacityMax}`);
      assert.equal(layer.blend, meta.blend === "normal" ? "source-over" : meta.blend, `${key} blend`);
    }
  }
  // The stress points named in the report: the plain wet season and the storm are exactly at the cap.
  assert.equal(stackedPermille(weatherLayers({ weather: "wet", seasonTick: 300, ...on })), 380);
  assert.equal(stackedPermille(weatherLayers({ weather: "wet", seasonTick: 575, ...on })), 380);
  assert.equal(stackedPermille(weatherLayers({ weather: "dry", seasonTick: 300, ...on })), 380);
});

test("Given each weather past its fade-in When the layers are listed Then at least one moves, with the rain on or off, and the four weathers draw distinct sets", () => {
  for (const weather of KINDS) for (const rain of [true, false]) for (let seasonTick = WEATHER_FADE_TICKS; seasonTick < SEASON_TICKS; seasonTick += 1) {
    const layers = weatherLayers({ weather, seasonTick, enabled: true, rain });
    assert.ok(layers.some(layer => layer.moving), `${weather} at ${seasonTick} (rain ${rain}) has a moving layer`);
  }
  const sets = KINDS.map(weather => ids(weatherLayers({ weather, seasonTick: 300, ...on })));
  assert.equal(new Set(sets).size, 4, sets.join(" | "));
  // Rain leads a wet season, the storm sheet at its height instead of the drizzle; never both at full strength.
  assert.ok(ids(weatherLayers({ weather: "wet", seasonTick: 300, ...on })).includes("drizzle"));
  const storm = weatherLayers({ weather: "wet", seasonTick: 575, ...on });
  assert.deepEqual(storm.filter(layer => layer.rain === true).map(layer => layer.id), ["storm"]);
  assert.ok(WET_STORM_FROM < 575 && 575 < WET_STORM_TO);
});

test("Given the switches When weather is off or the scenario has none Then no layer is drawn; the rain switch drops only the rain", () => {
  for (const weather of KINDS) {
    assert.deepEqual(weatherLayers({ weather, seasonTick: 300, enabled: false, rain: true }), []);
    assert.equal(weatherLayers({ weather, seasonTick: 300, enabled: true, rain: false }).some(layer => layer.rain === true), false);
  }
  assert.deepEqual(weatherLayers({ weather: null, seasonTick: 300, ...on }), []);
  assert.deepEqual(weatherLayers({ weather: "wet", seasonTick: 0, ...on }), [], "a season's weather fades in from nothing");
});

test("Given the proof hook's query When parsed Then it overrides the presented weather only in proof mode", () => {
  assert.equal(parseWeatherProof("?weather=wet"), null);
  assert.deepEqual(parseWeatherProof("?phase10-proof=1&weather=dry&weather-tick=300"), { weather: "dry", seasonTick: 300 });
  assert.deepEqual(parseWeatherProof("?phase10-proof=1&weather=none"), { weather: null });
  assert.equal(parseWeatherProof("?phase10-proof=1&weather=hail&weather-tick=4000"), null);
});

test("Given the seed 2 map When the weather is placed Then fog banks never meet each other or a puddle, and lattice spots, lanes and clouds never overlap", () => {
  // Given
  const state = c25BoardState();
  const anchors = mapFogAnchors(state);
  assert.ok(anchors.length > 0, "the lake's shore has fog");

  // Then: fog reaches pairwise apart; each drawn bank inside its reach at any moment.
  for (const [index, a] of anchors.entries()) for (const b of anchors.slice(index + 1)) assert.equal(rectsMeet(a.reach, b.reach), false);
  for (const anchor of anchors) for (const nowMs of [0, 3_000, 6_500, 13_000, 19_500]) {
    const drawn = fogRect(anchor, nowMs);
    assert.ok(drawn.x >= anchor.reach.x - 1e-9 && drawn.x + drawn.width <= anchor.reach.x + anchor.reach.width + 1e-9);
  }
  // Puddles (their sheen patch) clear of every fog reach, and apart from each other; cracks apart.
  const box = (spot: { x: number; y: number }, width: number, height: number): Rect => ({ x: spot.x - width / 2, y: spot.y - height / 2, width, height });
  const wet = wetSpots(state, state.tiles);
  const cracks = crackSpots(state, state.tiles);
  assert.ok(wet.length > 20 && cracks.length > 20, `${wet.length} puddles, ${cracks.length} cracks`);
  for (const spot of wet) for (const anchor of anchors) assert.equal(rectsMeet(box(spot, SHEEN_SIZE.width, SHEEN_SIZE.height), anchor.reach), false);
  assert.ok(SHEEN_SIZE.width <= LATTICE_MAX_W && SHEEN_SIZE.height <= LATTICE_MAX_H && CRACK_SIZE.width <= LATTICE_MAX_W && CRACK_SIZE.height <= LATTICE_MAX_H);
  for (const spots of [wet, cracks]) for (const [index, a] of spots.entries()) for (const b of spots.slice(index + 1)) {
    assert.equal(rectsMeet(box(a, LATTICE_MAX_W, LATTICE_MAX_H), box(b, LATTICE_MAX_W, LATTICE_MAX_H)), false);
  }
  const water = new Set(state.tiles.filter(tile => tile.terrain === "water").map(tile => `${tileCentre(tile.tx, tile.ty).x},${tileCentre(tile.tx, tile.ty).y}`));
  assert.equal(wet.some(spot => water.has(`${spot.x},${spot.y}`)), false, "puddles stand on land");
  // Lanes and clouds: one sprite per pixel.
  const size = { width: 256, height: 128 };
  for (const nowMs of [0, 1_234, 60_000, 3_600_000]) {
    const lanes = laneSprites({ width: 1280, height: 800 }, nowMs, size, 150, [64, 46, 78, 55], 1).map(sprite => ({ ...sprite, ...size }));
    for (const [index, a] of lanes.entries()) for (const b of lanes.slice(index + 1)) assert.equal(rectsMeet(a, b), false);
    for (const deck of CLOUD_DECKS) {
      const clouds = cloudSprites(deck, { x: -2_000, y: -1_000, width: 4_000, height: 2_600 }, nowMs).map(sprite => ({ ...sprite, width: deck.size, height: deck.size }));
      assert.ok(clouds.length >= 4);
      for (const [index, a] of clouds.entries()) for (const b of clouds.slice(index + 1)) assert.equal(rectsMeet(a, b), false);
    }
    const back = laneSprites({ width: 1280, height: 800 }, nowMs, size, 130, [-7, -10], 3, 3).map(sprite => ({ ...sprite, ...size }));
    for (const [index, a] of back.entries()) for (const b of back.slice(index + 1)) assert.equal(rectsMeet(a, b), false);
  }
});

function stubArt(): void {
  setWeatherArtForTest((key: Wave23Key) => ({ label: key, width: WAVE23_IMAGES[key].width, height: WAVE23_IMAGES[key].height }) as unknown as CanvasImageSource);
}
function drawBoth(state: ReturnType<typeof c25BoardState>): readonly string[] {
  const recording = recordingCanvas(1280, 800);
  recording.context.setTransform(1, 0, 0, 1, 640 - (44 - 38) * 32, 400 - (44 + 38) * 16);
  recording.canvas.ops.length = 0;
  drawWeatherGround(recording.context, state, state.tiles, 1, 5_000);
  drawWeatherSky(recording.context, state, { width: 1280, height: 800 }, 1, 5_000);
  return recording.canvas.ops;
}

test("Given loaded weather art When a weather season is drawn Then each layer draws at its alpha and blend, the same way twice; switched off or without weather nothing is drawn", () => {
  // Given: the seed 2 board in a dry summer (the proof tick of each weather through the state's own tick).
  stubArt();
  try {
    const base = c25BoardState();
    const summer = Math.floor(base.tick / 4_000) * 4_000 + 1_000 + 300;
    const state = { ...base, tick: summer };
    const layers = presentedWeatherLayers(state);
    assert.ok(layers.length > 0, `${engineWeather(state).weather}`);

    // When
    const first = drawBoth(state);
    const second = drawBoth(state);

    // Then
    assert.deepEqual(second, first);
    for (const layer of layers) {
      assert.ok(first.includes(`set globalAlpha(${layer.alphaPermille / 1000})`), `${layer.id} alpha`);
      assert.ok(first.includes(`set globalCompositeOperation(${layer.blend})`), `${layer.id} blend`);
    }
    assert.equal(first.some(op => op.startsWith("drawImage") || op.startsWith("fillRect")), true);

    // Switched off: nothing.
    setPresentationPreference("weatherFx", false);
    assert.deepEqual(presentedWeatherLayers(state), []);
    assert.deepEqual(drawBoth(state), []);
    setPresentationPreference("weatherFx", true);

    // A scenario without weather: nothing, whatever the season.
    SCENARIOS.register({ ...CORE_SCENARIOS[1]!, id: "test:no_weather", activeEvents: [] });
    const still = { ...state, scenarioId: "test:no_weather" };
    assert.equal(engineWeather(still).weather, null);
    for (let season = 0; season < 4; season += 1) assert.deepEqual(drawBoth({ ...still, tick: summer + season * 1_000 }), []);
  } finally {
    setWeatherArtForTest(null);
  }
  // Without the art (Node, the C25 board): no call at all.
  assert.deepEqual(drawBoth({ ...c25BoardState(), tick: 1_300 }), []);
});
