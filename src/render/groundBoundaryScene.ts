import type { GameState } from "../engine/engine.types";
import { roadTopologySignature } from "../world/roadTopologySignature";
import type { Tile } from "../world/world.types";
import { roadRibbonWidth, roadStripSignature } from "./roadRibbonStyle";
import { clearedCells, zoneSignature } from "./zoneLayer";
import { zonesOf } from "../zones/zoneEdits";
import type { GroundBoundaryScene } from "./groundSceneParts";
import { groundSceneSteps, runGroundSceneSteps, type GroundSceneReuse, type GroundSceneSteps } from "./groundSceneBuild";

export { GROUND_CHUNK_TILES, chunkTileBounds, type GroundBoundaryScene, type GroundChunkPlan } from "./groundSceneParts";

// Everything the V2 ground pass draws, derived once per ground change and split into 8x8-tile chunks.
//
// Cache (AGENTS rule 10):
// (a) Scene key: `tiles` identity (every road, terrain or building-footprint change replaces the tiles array),
//     the palisade signature (completed wall edges + gates + polygon, which decide road links and stone paving),
//     the seed, the wheat-farm footprint list (farm clusters), and the road ribbon width + strip set (D1a-2: the
//     ribbon layout's shoulder tufts and caps are placed from the width; the strip set is only in the road chunk key),
//     and the zone signature (C1b: id, kind and membership of every zone; plots follow roads and buildings, which
//     replace the tiles array). Building yards and aprons (C1d) follow the buildings themselves (the building
//     signature: id, kind, position and lot of every building in claim order; a construction site claims its tiles
//     when placed, so completing it leaves the tiles array alone and only this signature moves), roads (tiles), the
//     wall (palisade signature) and the ribbon width. Yard props (C1e: croft beds, hurdles) follow the yards and aprons
//     and which buildings are houses (building signature). Arable ridge layouts (C1e) follow zone membership and the
//     tiles; the crop state of each strip is read every frame and enters only the chunk content key of the chunks that
//     draw that strip (drawTerrainBoundaryV2), since it moves with farm production. The shoreline (D3a) follows the
//     water cells (tiles) and the bridges (road tiles on water: tiles, plus the palisade signature that bridgeAt reads),
//     and snaps to the water-side wall baselines (D3b: completed edges and gates are in the palisade signature, the
//     materials in the wall material signature, since a material join pins the baseline).
// (b) Left out on purpose: walkers, stocks, ticks, crop growth, house levels, construction progress. None of them is
//     read by road chains, forest or field outlines (crop state only changes what is drawn inside a field, which
//     stays in the live object pass), so they cannot change a scene.
// (c) Measured in docs/verification/d1a/REPORT.md (scene build time per fixture, and chunk-key hit rates).
//
// Chunk content keys hash exactly the primitives a chunk draws (tiles within 3 of it, every loop/chain/decal whose
// bounds reach it), so a chunk re-rasters iff something it draws changed, and never keeps a stale picture.

type SceneKey = { readonly tiles: readonly Tile[]; readonly palisade: string; readonly wallMaterials: string; readonly seed: number; readonly farms: string; readonly buildings: string;
  readonly reversed: boolean; readonly width: number; readonly strips: string; readonly zones: string };
let last: { readonly key: SceneKey; readonly scene: GroundBoundaryScene } | null = null;
let reverseInputForProof = false;

// Zone-only rebuild deferral (C1d, live canvas only): the frame that first sees a zone edit keeps the previous scene
// (its chunks and props are all still valid pictures of the ground, just without the new zones) and the next frame
// rebuilds, so the stroke-end frame does not pay the zone layer (4-8 ms on the 24-lot town) on top of its rasters.
// Off by default: tests, the Node C25 board and proof resets always see the scene of the state they pass.
let deferZoneRebuilds = false;
let sceneFrame = 0;
let deferredAtFrame: number | null = null;
let frameStartedAt: number | undefined;
export function setGroundSceneZoneDeferral(enabled: boolean): void { deferZoneRebuilds = enabled; deferredAtFrame = null; frameStartedAt = undefined; }
/** Called once at the start of every live frame. */
export function beginGroundSceneFrame(): void { sceneFrame += 1; frameStartedAt = deferZoneRebuilds ? performance.now() : undefined; }
/** When the current live frame started (undefined unless deferral is on): the chunk cache's defer budget. */
export function groundSceneFrameStart(): number | undefined { return frameStartedAt; }

// Incremental rebuild (SMOOTH-2R, live canvas only, off by default like the zone deferral): a changed ground is built
// a few steps a frame (groundSceneBuild.ts), at most BUILD_BUDGET_MS of steps per frame (a step once begun finishes, so
// one stage or one building's yard can pass it), and every caller gets the previous scene until the new one is
// complete: its chunks, props and ribbons are the ground as it was moments ago, and each chunk's key still hashes what
// that scene drew, so the new scene re-rasters exactly the chunks it changes. A change while a build runs does not
// restart it: that build finishes (its state was the newest when it began), then the next starts from the newest
// state, so a town that changes every few frames still gets a new scene every few frames. Built at once as before:
// the first scene, another map (size or seed), the proof's reverse-input flag, and everything with the flag off.
const BUILD_BUDGET_MS = 4;
let incremental = false;
let pending: { readonly key: SceneKey; readonly steps: GroundSceneSteps; readonly stageMs: Map<string, number>; readonly startFrame: number; buildMs: number } | null = null;
let budgetFrame = -1;
let spentThisFrame = 0;
export function setGroundSceneIncrementalBuild(enabled: boolean): void { incremental = enabled; pending = null; }

/** Proof hook (gate 2): build from the tiles in reverse order; the scene must not change. */
export function setGroundSceneReverseInput(value: boolean): void { reverseInputForProof = value; last = null; pending = null; }

export function groundBoundaryScene(state: GameState): GroundBoundaryScene {
  const key = sceneKey(state);
  if (last !== null && sameGround(last.key, key) && last.key.zones === key.zones) { pending = null; return last.scene; }
  const ground = last !== null && sameGround(last.key, key);
  if (ground && deferZoneRebuilds && last !== null && (deferredAtFrame === null || deferredAtFrame === sceneFrame)) {
    deferredAtFrame = sceneFrame;
    return last.scene;
  }
  deferredAtFrame = null;
  if (incremental && last !== null && last.key.seed === key.seed && !key.reversed && last.scene.width === state.width && last.scene.height === state.height) {
    return advanceBuild(state, key);
  }
  pending = null;
  const stageMs = new Map<string, number>();
  // A zone edit keeps the ground: reuse roads, forest, fields and ribbons (the costly part, 10-40 ms on the 24-lot town)
  // and derive only the zone layer and the chunk plans again.
  // A zone-only rebuild keeps every chunk's ground base key (drawTerrainBoundaryV2 may then spread the re-rasters).
  return commit(key, runGroundSceneSteps(groundSceneSteps(state, reverseInputForProof, ground ? last?.scene : undefined), stageMs), stageMs, 1);
}

/** Runs the pending build (or starts one) within this frame's budget; the previous scene until it completes. */
function advanceBuild(state: GameState, key: SceneKey): GroundBoundaryScene {
  if (budgetFrame !== sceneFrame) { budgetFrame = sceneFrame; spentThisFrame = 0; }
  pending ??= startBuild(state, key);
  while (spentThisFrame < BUILD_BUDGET_MS) {
    const started = performance.now();
    const step = pending.steps.next();
    const spent = performance.now() - started;
    spentThisFrame += spent;
    pending.buildMs += spent;
    if (step.done !== true) { pending.stageMs.set(step.value, (pending.stageMs.get(step.value) ?? 0) + spent); continue; }
    const done = commit(pending.key, { ...step.value, buildMs: pending.buildMs }, pending.stageMs, sceneFrame - pending.startFrame + 1);
    pending = null;
    if (last !== null && sameGround(last.key, key) && last.key.zones === key.zones) return done;
    pending = startBuild(state, key);
  }
  return (last as NonNullable<typeof last>).scene;
}

function startBuild(state: GameState, key: SceneKey): NonNullable<typeof pending> {
  const reuse: GroundSceneReuse | undefined = last !== null && sameGround(last.key, key) ? last.scene : undefined;
  return { key, steps: groundSceneSteps(state, false, reuse), stageMs: new Map(), startFrame: sceneFrame, buildMs: 0 };
}

let sceneBuilds = 0;
let lastStages: Readonly<Record<string, number>> = {};
let lastFrames = 0;
function commit(key: SceneKey, scene: GroundBoundaryScene, stageMs: ReadonlyMap<string, number>, frames: number): GroundBoundaryScene {
  last = { key, scene };
  sceneBuilds += 1;
  lastStages = Object.fromEntries(stageMs);
  lastFrames = frames;
  return scene;
}

/** Proof diagnostics: how many times the scene was rebuilt, what the last build cost (in all, per stage, frames spanned). */
export function groundBoundarySceneStats(): { readonly builds: number; readonly lastBuildMs: number | null; readonly lastStageMs: Readonly<Record<string, number>>;
  readonly lastBuildFrames: number; readonly building: boolean } {
  return { builds: sceneBuilds, lastBuildMs: last?.scene.buildMs ?? null, lastStageMs: lastStages, lastBuildFrames: lastFrames, building: pending !== null };
}

/** The synchronous build (tests, tools, boards): every step at once. */
export function buildGroundBoundaryScene(state: GameState, reverseInput = false, ground?: GroundSceneReuse): GroundBoundaryScene {
  return runGroundSceneSteps(groundSceneSteps(state, reverseInput, ground));
}

function sceneKey(state: GameState): SceneKey {
  const farmList = state.buildings.filter(building => building.kind === "wheat_farm");
  return {
    tiles: state.tiles,
    palisade: palisadeSignature(state.palisade),
    wallMaterials: wallMaterialSignature(state.palisade),
    seed: state.seed,
    farms: farmList.map(farm => `${farm.id}@${farm.tx},${farm.ty}`).join("|"),
    buildings: buildingSignature(state.buildings),
    reversed: reverseInputForProof,
    width: roadRibbonWidth(),
    strips: roadStripSignature(),
    zones: `${zoneSignature(zonesOf(state))}#${clearedArableSignature(state)}`,
  };
}

function sameGround(a: SceneKey, b: SceneKey): boolean {
  return a.tiles === b.tiles && a.palisade === b.palisade && a.wallMaterials === b.wallMaterials && a.seed === b.seed
    && a.farms === b.farms && a.buildings === b.buildings && a.reversed === b.reversed && a.width === b.width && a.strips === b.strips;
}

const buildingSignatures = new WeakMap<object, string>();
function buildingSignature(buildings: GameState["buildings"]): string {
  const cached = buildingSignatures.get(buildings);
  if (cached !== undefined) return cached;
  const signature = buildings.map(building => `${building.id}:${building.kind}@${building.tx},${building.ty}${building.houseLot ?? ""}`).join("|");
  buildingSignatures.set(buildings, signature);
  return signature;
}

/** Materials of the completed segments (D3b: a material join pins the wall baseline the shoreline shares). */
const wallMaterialSignatures = new WeakMap<object, string>();
function wallMaterialSignature(palisade: GameState["palisade"]): string {
  if (palisade === null) return "";
  const cached = wallMaterialSignatures.get(palisade);
  if (cached !== undefined) return cached;
  const signature = palisade.segments.filter(segment => segment.completed).map(segment => `${segment.id}:${segment.material}`).sort().join("|");
  wallMaterialSignatures.set(palisade, signature);
  return signature;
}

/**
 * The cleared forest cells inside arable zones (C1f: ridge bands are laid on them too), as part of the zones key: a
 * forest tile logged inside a field re-lays that field. Cached on the zones and forestHarvests arrays (both replaced
 * when they change).
 */
const clearedArableSignatures = new WeakMap<object, WeakMap<object, string>>();
const NO_HARVESTS: readonly unknown[] = [];
function clearedArableSignature(state: GameState): string {
  if (!(state.zones ?? []).some(zone => zone.kind === "arable")) return "";
  const zones = zonesOf(state);
  const harvests = (state.forestHarvests ?? NO_HARVESTS) as object;
  let byHarvests = clearedArableSignatures.get(zones as object);
  if (byHarvests === undefined) { byHarvests = new WeakMap(); clearedArableSignatures.set(zones as object, byHarvests); }
  const cached = byHarvests.get(harvests);
  if (cached !== undefined) return cached;
  const cleared = clearedCells(state);
  const cells: number[] = [];
  for (const zone of zones) if (zone.kind === "arable") for (const index of zone.membership) if (cleared.has(index)) cells.push(index);
  const signature = cells.sort((a, b) => a - b).join(",");
  byHarvests.set(harvests, signature);
  return signature;
}

const palisadeSignatures = new WeakMap<object, string>();
function palisadeSignature(palisade: GameState["palisade"]): string {
  if (palisade === null) return "";
  const cached = palisadeSignatures.get(palisade);
  if (cached !== undefined) return cached;
  const signature = `${roadTopologySignature(palisade)}|${palisade.polygon.map(point => `${point.x},${point.y}`).join(";")}`;
  palisadeSignatures.set(palisade, signature);
  return signature;
}

