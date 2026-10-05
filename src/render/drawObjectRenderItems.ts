import { unitEdgeKey } from "../world/boundary/wallBaseline";
import { causeBuildingAlpha } from "./causeMapOverlay";
import type { GameState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import type { CameraState } from "./camera";
import { drawBuildings } from "./drawBuildings";
import { drawConstructionSite } from "./drawConstructionSites";
import { wallBaselinesFor } from "./wallBaselineCache";
import { drawPalisadeSegment } from "./drawPalisadeSegments";
import { cornerGateModules } from "./gateCornerModules";
import { gateArmPosts } from "./gateOpeningPosts";
import type { HouseMaterialWave } from "./buildingMaterialWave";
import type { RenderQueueItem } from "./objectRenderOrder";
import { getObjectRenderViewMode } from "./objectRenderViewMode";
import type { TileRange, ViewportSize } from "./renderer";
import type { TileCoordinate } from "../world/grid";
import { drawRoadReadabilityOverlay } from "./roadReadabilityOverlay";
import { bridgeRailPieces, drawBridgeRail } from "./drawBridges";
import { bridgeDeckAt } from "./landWorksModel";
import { drawFordSplash } from "./landWorksDraw";
import { sortRenderItems } from "./objectRenderSort";
import { renderStageProbe, stageForRenderItem } from "./renderStageProbe";
import { boundaryV2Enabled } from "./renderBoundaryFlag";
import { wallStripsEnabled } from "./renderWallStripsFlag";
import { beginBuildingVariantFrame } from "./buildingVariants";
import { beginHouseVariantFrame } from "./wave26HouseArt";
import { beginGranaryVariantFrame } from "./wave32GranaryArt";
import { drawWarProp } from "./warWorldProps";
import { drawVillageLifeItem } from "./villageLifeDraw";
import { drawPlagueProp } from "./plagueWorldProps";
import { drawReorgPropAt } from "./reorgWorldProps";
import { drawAleDrinker } from "./alehouseCrowd";
import { drawCountrysideItem } from "./countrysideDraw";
import { drawTradeWorldProp } from "./tradeWorldDraw";
import { drawDoorSign } from "./doorSigns";
import { inGatePassage, placeWalkers, walkerHiddenBehind } from "./walkerOcclusion";
import { beginSpriteMipFrame, endSpriteMipFrame } from "./spriteMipCache";

type DrawObjectRenderItemsInput = {
  readonly state: GameState;
  readonly problemOnly?: boolean;
  readonly tiles: readonly Tile[];
  readonly range: TileRange;
  readonly zoom: number;
  readonly camera: CameraState;
  readonly dpr: number;
  readonly viewport: ViewportSize;
  readonly objectRenderItems: readonly RenderQueueItem[];
  readonly constructionProgress?: ReadonlyMap<string, number> | undefined;
  readonly houseMaterialWave?: HouseMaterialWave | null;
  readonly nowMs?: number;
  /** INSTALL-23b: the village life's clock (holds while paused); nowMs when absent. */
  readonly lifeClockMs?: number;
  readonly hoveredTile?: TileCoordinate | null;
  readonly selectionMode?: boolean;
  /** NAT-1: the selected walker, outlined faintly when an object in front hides it. */
  readonly selectedWalkerId?: string | null;
};

export function drawObjectRenderItems(
  context: CanvasRenderingContext2D,
  input: DrawObjectRenderItemsInput,
): void {
  const probe = renderStageProbe.current;
  const spriteOptions = { camera: input.camera, dpr: input.dpr, viewport: input.viewport }; // the site ghost's culling
  probe?.enter("farmland");
  beginBuildingVariantFrame(input.state);
  beginHouseVariantFrame(input.state); // INSTALL-26 the Wave 26 house paintings
  beginGranaryVariantFrame(input.state); // INSTALL-32 the Wave 32 granary paintings
  const viewMode = getObjectRenderViewMode();
  // RENDER_BOUNDARY_V2 draws road ribbons in the ground chunks, under frontage and objects. (The V1 wheat-farm soil
  // pass that stood here went with the retired farm art, C1f.)
  const boundaryV2 = boundaryV2Enabled();
  const wallStrips = boundaryV2 && wallStripsEnabled();
  const stoneGates = input.objectRenderItems.flatMap(item => item.kind === "palisade_segment"
    ? (item.stoneNodes ?? []).filter(node => node.kind === "gate").map(node => node.point) : []);
  // Roads are ground surfaces; repainting them after this queue cuts across roofs.
  probe?.enter("roads.overlay");
  if (!boundaryV2) drawRoadReadabilityOverlay(context, input.state, input.tiles, stoneGates);
  const rails = bridgeRailPieces(input.state, input.tiles).map(piece => ({
    kind: "bridge_rail" as const, piece, depth: piece.depth, anchorTx: piece.tx,
    id: `bridge:${piece.tx}:${piece.ty}:${piece.side}`,
  }));
  probe?.enter("objects.sort");
  // NAT-1: walkers in the same order as the objects (walkerOcclusion.ts); those in a stone gate's passage or on a bridge
  // keep the queue's own place, where the gate's arch and the bridge's rails are drawn around them by depth.
  const queue = placeWalkers(sortRenderItems([...input.objectRenderItems, ...rails]), input.state, item =>
    inGatePassage(item.walker.position, stoneGates)
    || bridgeDeckAt(input.state, { tx: Math.round(item.walker.position.tx), ty: Math.round(item.walker.position.ty) }) !== null);
  // SMOOTH-2R: the camera transform, read once for the queue; walls and walkers read it per item before (a new
  // DOMMatrix each, 113 a frame in the 1380 town). Every item restores what it changes, so it holds at each item.
  const transform = context.getTransform?.();
  // NAT-2 QA-008: the queue's world blits draw from the mip level of their device size (spriteMipCache.ts).
  if (transform !== undefined) beginSpriteMipFrame(context, Math.hypot(transform.a, transform.b));
  for (const item of queue) {
    probe?.enter(stageForRenderItem(item.kind));
    if (item.kind === "bridge_rail") {
      drawBridgeRail(context, item.piece);
      continue;
    }
    if (item.kind === "war_prop") { // UI-6 the war's beacon, burning quay and raid smoke
      if (viewMode === "normal") drawWarProp(context, item.prop, input.zoom, input.nowMs ?? 0);
      continue;
    }
    if (item.kind === "plague_prop") { // UI-8 chapter 3 fresh graves in the churchyard
      if (viewMode === "normal") drawPlagueProp(context, item.prop);
      continue;
    }
    if (item.kind === "ale_drinker") { // NAT-2 the alehouse crowd, on the village life's clock
      if (viewMode === "normal") drawAleDrinker(context, input.state, item, input.lifeClockMs ?? input.nowMs ?? 0);
      continue;
    }
    if (item.kind === "reorg_prop") { // UI-9 chapter 4 guildhall world prop
      if (viewMode === "normal") drawReorgPropAt(context, item.prop);
      continue;
    }
    if (item.kind === "countryside") { // INSTALL-28 hedges, baulks, dry-stone walls and point props outside the walls
      if (viewMode === "normal") drawCountrysideItem(context, item, input.state, input.zoom);
      continue;
    }
    if (item.kind === "trade_prop") {
      if (viewMode === "normal") drawTradeWorldProp(context, item.prop, input.zoom);
      continue;
    }
    if (item.kind === "door_sign") { // LM-R1 Wave 37 house-front signs (lord mode)
      if (viewMode === "normal") drawDoorSign(context, item.sign, input.zoom);
      continue;
    }
    if (item.kind === "village_life") { // INSTALL-23 hens, cats, dogs, birds, toys, washing lines, doorstep props
      if (viewMode === "normal") drawVillageLifeItem(context, item.life, { state: input.state, zoom: input.zoom, nowMs: input.lifeClockMs ?? input.nowMs ?? 0, camera: input.camera, viewport: input.viewport });
      continue;
    }
    if (item.kind === "construction_site") {
      const presentationProgress = input.constructionProgress?.get(item.id)
        ?? item.presentationProgress;
      const drawInput = presentationProgress === undefined
        ? { site: item.site, state: input.state, schedule: item.schedule, zoom: input.zoom, viewMode, nowMs: input.nowMs ?? 0, spriteOptions }
        : {
            site: item.site,
            state: input.state,
            schedule: item.schedule,
            zoom: input.zoom,
            presentationProgress,
            viewMode,
            nowMs: input.nowMs ?? 0,
            spriteOptions,
          };
      drawConstructionSite(context, drawInput);
      continue;
    }
    if (item.kind === "palisade_segment") {
      drawPalisadeSegment(context, {
        segment: item.segment,
        stoneNodes: item.stoneNodes,
        gate: item.gate,
        gates: item.gates,
        zoom: input.zoom,
        ...(wallStrips ? { face: wallFaceFor(input.state, item) } : {}),
      }, transform);
      continue;
    }
    if (item.kind === "walker" && viewMode === "normal") drawFordSplash(context, input.state, item.walker, input.nowMs ?? 0); // LAND-UI FD-2 wading
    context.save();
    if (item.kind === "building" && input.problemOnly && causeBuildingAlpha(input.state, item.building.id, true) < 1) context.globalAlpha *= 0.4;
    drawBuildings(context, {
      state: input.state,
      tiles: input.tiles,
      range: input.range,
      zoom: input.zoom,
      camera: input.camera,
      dpr: input.dpr,
      viewport: input.viewport,
      objectRenderItems: [item],
      houseMaterialWave: input.houseMaterialWave ?? null,
      nowMs: input.nowMs ?? 0,
      hoveredTile: input.hoveredTile ?? null,
      selectionMode: input.selectionMode ?? false,
      viewMode, transform,
    });
    context.restore();
  }
  // NAT-1: a hidden walker stays hidden, except the selected one: drawn again faintly over what hides it.
  const selectedIndex = input.selectedWalkerId === undefined || input.selectedWalkerId === null ? -1
    : queue.findIndex(item => item.kind === "walker" && item.walker.id === input.selectedWalkerId);
  const selected = queue[selectedIndex];
  if (selected !== undefined && selected.kind === "walker" && walkerHiddenBehind(queue, selectedIndex, input.state)) {
    probe?.enter("walkers");
    context.save();
    context.globalAlpha *= SELECTED_HIDDEN_ALPHA;
    drawBuildings(context, {
      state: input.state,
      tiles: input.tiles,
      range: input.range,
      zoom: input.zoom,
      camera: input.camera,
      dpr: input.dpr,
      viewport: input.viewport,
      objectRenderItems: [selected],
      houseMaterialWave: input.houseMaterialWave ?? null,
      nowMs: input.nowMs ?? 0,
      hoveredTile: input.hoveredTile ?? null,
      selectionMode: input.selectionMode ?? false,
      viewMode, transform,
    });
    context.restore();
  }
  endSpriteMipFrame();
}

/** NAT-1: the selected walker's faint silhouette over the object that hides it. */
const SELECTED_HIDDEN_ALPHA = 0.35;

/**
 * Wall strips (D3b, RENDER_WALL_STRIPS on the curved ground): the wall item's unit edge draws its stretch of the extruded face and the modules it owns (the
 * item id is `<material>:<unit edge key>`, the key wallBaseline uses). An edge whose chain has the other material (a
 * timber edge a stone segment replaced) draws nothing.
 */
function wallFaceFor(state: DrawObjectRenderItemsInput["state"], item: { readonly id: string; readonly segment: { readonly material?: string } }) {
  const { walls, slices } = wallBaselinesFor(state);
  const separator = item.id.indexOf(":");
  const key = item.id.slice(separator + 1);
  const material = item.segment.material === "stone" ? "stone" : "timber";
  const slice = slices.get(key) ?? null;
  const own = slice !== null && slice.chain.material === material;
  // A stone tower is drawn by each arm it joins (INSTALL-4e), not by its owner alone: at a corner whose arms sort to the
  // same depth the arm drawn after the owner painted its face over the tower; drawn again after that arm, it stays whole.
  const drawsNode = (node: (typeof walls.nodes)[number]): boolean => node.owner === key
    || (node.kind === "tower" && node.materials.includes("stone") && node.neighbors.some(neighbor => unitEdgeKey(node.point, neighbor) === key));
  // NAT-2 QA-003: a corner gate's art and its off-axis pier are split between its two arms (gateCornerModules); a
  // palisade gate's door post is drawn by its arm, and by the gate's art over it (gateArmPosts).
  const nodes = own ? walls.nodes.flatMap(node => { const modules = cornerGateModules(node, key) ?? (drawsNode(node) ? [node] : []);
    return modules.includes(node) ? modules : [...modules, ...gateArmPosts(node, key)]; }) : [];
  return { slice: own ? slice : null, nodes, pillars: own ? walls.pillars.filter(pillar => pillar.owner === key) : [] };
}
