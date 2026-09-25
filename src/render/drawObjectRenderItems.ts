import { causeBuildingAlpha } from "./causeMapOverlay";
import type { GameState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import type { CameraState } from "./camera";
import { drawBuildings } from "./drawBuildings";
import { drawConstructionSite } from "./drawConstructionSites";
import { wallBaselinesFor } from "./wallBaselineCache";
import { drawPalisadeSegment } from "./drawPalisadeSegments";
import type { HouseMaterialWave } from "./buildingMaterialWave";
import type { RenderQueueItem } from "./objectRenderOrder";
import { getObjectRenderViewMode } from "./objectRenderViewMode";
import type { TileRange, ViewportSize } from "./renderer";
import type { TileCoordinate } from "../world/grid";
import { drawRoadReadabilityOverlay } from "./roadReadabilityOverlay";
import { bridgeRailPieces, drawBridgeRail } from "./drawBridges";
import { bridgeAt } from "../world/bridges";
import { sortRenderItems } from "./objectRenderSort";
import { renderStageProbe, stageForRenderItem } from "./renderStageProbe";
import { boundaryV2Enabled } from "./renderBoundaryFlag";
import { wallStripsEnabled } from "./renderWallStripsFlag";
import { beginBuildingVariantFrame } from "./buildingVariants";

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
  readonly hoveredTile?: TileCoordinate | null;
  readonly selectionMode?: boolean;
};

export function drawObjectRenderItems(
  context: CanvasRenderingContext2D,
  input: DrawObjectRenderItemsInput,
): void {
  const probe = renderStageProbe.current;
  probe?.enter("farmland");
  beginBuildingVariantFrame(input.state);
  const walkerItems: Extract<RenderQueueItem, { readonly kind: "walker" }>[] = [];
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
  const queue = sortRenderItems([...input.objectRenderItems, ...rails]);
  for (const item of queue) {
    probe?.enter(stageForRenderItem(item.kind));
    if (item.kind === "bridge_rail") {
      drawBridgeRail(context, item.piece);
      continue;
    }
    if (item.kind === "walker" && !stoneGates.some(gate =>
      Math.hypot(item.walker.position.tx - gate.x, item.walker.position.ty - gate.y) < 1.5)
      && bridgeAt(input.state, { tx: Math.round(item.walker.position.tx), ty: Math.round(item.walker.position.ty) }) === null) {
      walkerItems.push(item);
      continue;
    }
    if (item.kind === "construction_site") {
      const presentationProgress = input.constructionProgress?.get(item.id)
        ?? item.presentationProgress;
      const drawInput = presentationProgress === undefined
        ? { site: item.site, state: input.state, schedule: item.schedule, zoom: input.zoom, viewMode }
        : {
            site: item.site,
            state: input.state,
            schedule: item.schedule,
            zoom: input.zoom,
            presentationProgress,
            viewMode,
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
      });
      continue;
    }
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
      viewMode,
    });
    context.restore();
  }
  probe?.enter("walkers");
  for (const item of walkerItems) {
    context.save();
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
      viewMode,
    });
    context.restore();
  }
}

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
  return { slice: own ? slice : null, nodes: own ? walls.nodes.filter(node => node.owner === key) : [], pillars: own ? walls.pillars.filter(pillar => pillar.owner === key) : [] };
}
