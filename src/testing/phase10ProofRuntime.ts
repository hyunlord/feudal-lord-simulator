import { zoneAssetStatuses } from "../render/zoneAssets";
import { burgageParcels } from "../zones/zoneFillAgent";
import type { MutableRefObject } from "react";
import { installProofFrameWork, type ProofFrameWorkSnapshot } from "./proofFrameWork";

import type { ResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import { worldToCanvas, type CameraState } from "../render/camera";
import { renderDetailLevel, type RenderDetailLevel } from "../render/buildingVisualState";
import { tileCenter } from "../render/picking";
import { worldAssetStatuses, type AssetStatus } from "../render/worldAssets";
import {
  installWorldSpriteDrawProbe,
  type WorldSpriteDrawEvent,
} from "../render/worldSpriteDiagnostics";
import { buildingProblemCause } from "../ui/problemCauseModel";
import { buildingFootprint } from "../geometry/buildingFootprint";
import { houseCompoundAssetStatuses } from "../render/houseCompoundAssets";
import { installRenderStageProbe, type RenderStageSnapshot } from "../render/renderStageProbe";
import { worldRasterCacheDiagnostics } from "../render/worldRasterCache";
import { groundBoundaryDiagnostics, resetGroundBoundaryForProof } from "../render/drawTerrainBoundaryV2";
import { groundBoundaryScene } from "../render/groundBoundaryScene";
import { setObjectPassForProof } from "../render/renderer";
import { tileToScreen } from "../render/iso";
import { APRON_TARGET_DEPTH } from "../world/boundary/buildingGrounds";
import { onboardingWorldGuidanceMemoStats } from "../ui/onboardingWorldGuidance";
import { buildingVariantAssetStatuses } from "../render/buildingVariantAssets";

type ProofLocation = {
  readonly hostname: string;
  readonly search: string;
};

type BuildingProofSummary = {
  readonly id: string;
  readonly kind: string;
  readonly tx: number;
  readonly ty: number;
  readonly width: number;
  readonly height: number;
  readonly houseLot: "horizontal" | "vertical" | null;
  readonly inventory: Partial<Record<ResourceType, number>>;
  readonly productionProgress: number;
  readonly problemCause: string | null;
};

type WalkerProofSummary = {
  readonly id: string;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly homeBuildingId: string;
  readonly phase: string | null;
  readonly cargo: { readonly resource: ResourceType; readonly amount: number } | null;
};

type ConstructionSiteProofSummary = {
  readonly id: string;
  readonly kind: string;
  readonly stall: string;
};

type HouseProofSummary = {
  readonly buildingId: string;
  readonly residents: number;
  readonly level: number;
  readonly breadStock: number;
  readonly lastServicedTick: number;
};

export type Phase10ProofSnapshot = {
  readonly tick: number;
  readonly wallTick: number;
  readonly population: number;
  readonly idleWorkers: number;
  readonly treasuryTimber: number;
  readonly roadRevision: number;
  readonly buildings: readonly BuildingProofSummary[];
  readonly constructionSites: readonly ConstructionSiteProofSummary[];
  readonly houses: readonly HouseProofSummary[];
  readonly walkers: readonly WalkerProofSummary[];
};

export type Phase10ProofRuntimePort = {
  readonly tileClientPoint: (tile: TileCoordinate) => { readonly clientX: number; readonly clientY: number };
  readonly snapshot: () => Phase10ProofSnapshot;
  readonly diagnosis: () => {
    readonly camera: { readonly zoom: number; readonly lod: RenderDetailLevel };
    readonly assets: readonly AssetStatus[];
    readonly houseCompoundAssets: ReturnType<typeof houseCompoundAssetStatuses>;
    readonly spriteDraws: { readonly recent: readonly WorldSpriteDrawEvent[] };
    readonly work: ProofFrameWorkSnapshot;
    /** Per-frame render stage times and canvas call counts (last 240 frames). */
    readonly renderStages: RenderStageSnapshot | null;
    /** Cumulative world raster cache counters of the proof canvas. */
    readonly rasterCache: ReturnType<typeof worldRasterCacheDiagnostics> | null;
    /** RENDER_BOUNDARY_V2 ground chunks and the onboarding guidance memo. */
    readonly boundary: ReturnType<typeof groundBoundaryDiagnostics> | null;
    readonly onboardingMemo: ReturnType<typeof onboardingWorldGuidanceMemoStats>;
    /** Wave 2 visual variant images (V1). */
    readonly variants: ReturnType<typeof buildingVariantAssetStatuses>;
    /** Zones (C1b evidence): kind and owned cells per zone, derived plots, zone art status. */
    readonly zones: { readonly list: readonly { readonly id: string; readonly kind: string; readonly cells: number }[]; readonly parcels: number;
      readonly assets: ReturnType<typeof zoneAssetStatuses> };
  };
  /** Gate 2 of the curved ground: rebuild from reversed tile order (true) or normal order (false), dropping rasters. */
  readonly resetBoundary: (reverseInput: boolean) => void;
  /**
   * C1d gate 1: the ground between each building's frontage and the road ribbon, as canvas pixel positions (device
   * pixels) of points every 1/32 tile from the footprint edge to the ribbon's visible edge, for aprons whose building
   * is on screen. The evidence script reads those pixels and counts grass-coloured ones.
   */
  readonly wedgeProbe: () => { readonly aprons: number; readonly samples: readonly { readonly x: number; readonly y: number; readonly building: string; readonly t: number; readonly gap: number }[];
    readonly rays: number; readonly raysWithoutRibbon: number; readonly raysBeyondTarget: number };
  /** C1d gate 1: draw frames without the object pass (true) to read the ground layer alone. */
  readonly groundOnly: (enabled: boolean) => void;
  /** C1d evidence: the current game state (read only), so a naturally played scene can be reopened in another build. */
  readonly state: () => GameState;
};

type InstallPhase10ProofRuntimeInput = {
  readonly canvas: HTMLCanvasElement;
  readonly cameraRef: MutableRefObject<CameraState>;
  readonly stateRef: MutableRefObject<GameState>;
  readonly location: ProofLocation;
};

declare global {
  interface Window {
    __FEUDAL_PHASE10_PROOF__?: Phase10ProofRuntimePort;
  }
}

export function phase10ProofEnabled(location: ProofLocation): boolean {
  const hostIsLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  const hostIsPublishedBuild = location.hostname === "hyunlord.github.io";
  return (hostIsLocal || hostIsPublishedBuild)
    && new URLSearchParams(location.search).get("phase10-proof") === "1";
}

export function installPhase10ProofRuntime(input: InstallPhase10ProofRuntimeInput): () => void {
  if (!phase10ProofEnabled(input.location)) return () => {};
  const spriteDrawProbe = installWorldSpriteDrawProbe();
  const workProbe = installProofFrameWork();
  // Test doubles of the canvas may not implement getContext; the port then works without stage timing.
  const context = typeof input.canvas.getContext === "function" ? input.canvas.getContext("2d") : null;
  // `&render-stages=0` keeps the proof port but skips stage timing, to measure the probe's own cost.
  const stagesEnabled = new URLSearchParams(input.location.search).get("render-stages") !== "0";
  const stageProbe = context === null || !stagesEnabled ? null : installRenderStageProbe(context);

  const port: Phase10ProofRuntimePort = {
    tileClientPoint: (tile) => tileClientPoint(input.canvas, input.cameraRef.current, tile),
    snapshot: () => snapshot(input.stateRef.current),
    diagnosis: () => ({
      camera: {
        zoom: input.cameraRef.current.zoom,
        lod: renderDetailLevel(input.cameraRef.current.zoom),
      },
      assets: worldAssetStatuses(),
      houseCompoundAssets: houseCompoundAssetStatuses(),
      spriteDraws: spriteDrawProbe.snapshot(),
      work: workProbe.snapshot(),
      renderStages: stageProbe?.snapshot() ?? null,
      rasterCache: context === null ? null : worldRasterCacheDiagnostics(context),
      boundary: context === null ? null : groundBoundaryDiagnostics(context),
      onboardingMemo: onboardingWorldGuidanceMemoStats(),
      variants: buildingVariantAssetStatuses(),
      zones: { list: (input.stateRef.current.zones ?? []).map(zone => ({ id: zone.id, kind: zone.kind, cells: zone.membership.length })),
        parcels: burgageParcels(input.stateRef.current).length, assets: zoneAssetStatuses() },
    }),
    resetBoundary: (reverseInput) => { if (context !== null) resetGroundBoundaryForProof(context, reverseInput); },
    wedgeProbe: () => wedgeProbe(input.canvas, input.cameraRef.current, input.stateRef.current),
    groundOnly: (enabled) => setObjectPassForProof(!enabled),
    state: () => input.stateRef.current,
  };
  window.__FEUDAL_PHASE10_PROOF__ = port;

  return () => {
    spriteDrawProbe.dispose();
    workProbe.dispose();
    stageProbe?.dispose();
    if (window.__FEUDAL_PHASE10_PROOF__ === port) {
      delete window.__FEUDAL_PHASE10_PROOF__;
    }
  };
}

function tileClientPoint(
  canvas: HTMLCanvasElement,
  camera: CameraState,
  tile: TileCoordinate,
): { readonly clientX: number; readonly clientY: number } {
  const rect = canvas.getBoundingClientRect();
  const canvasPoint = worldToCanvas(tileCenter(tile.tx, tile.ty), camera);
  return {
    clientX: rect.left + canvasPoint.x,
    clientY: rect.top + canvasPoint.y,
  };
}

function wedgeProbe(canvas: HTMLCanvasElement, camera: CameraState, state: GameState): ReturnType<Phase10ProofRuntimePort["wedgeProbe"]> {
  const rect = canvas.getBoundingClientRect();
  const dpr = rect.width > 0 ? canvas.width / rect.width : 1;
  const samples: { x: number; y: number; building: string; t: number; gap: number }[] = [];
  let aprons = 0; let rays = 0; let raysWithoutRibbon = 0; let raysBeyondTarget = 0;
  const toCanvas = (x: number, y: number): { x: number; y: number } => {
    const screen = tileToScreen(x, y);
    const point = worldToCanvas({ x: screen.sx, y: screen.sy }, camera);
    return { x: Math.round(point.x * dpr), y: Math.round(point.y * dpr) };
  };
  const inside = (point: { x: number; y: number }): boolean => point.x >= 0 && point.y >= 0 && point.x < canvas.width && point.y < canvas.height;
  for (const apron of groundBoundaryScene(state).grounds.aprons) {
    const centre = apron.edge[Math.floor(apron.edge.length / 2)];
    if (centre === undefined || !inside(toCanvas(centre.x, centre.y))) continue;
    aprons += 1;
    apron.edge.forEach((point, index) => {
      const gap = apron.ribbonGaps[index] ?? null;
      rays += 1;
      if (gap === null) { raysWithoutRibbon += 1; return; }
      if (gap > APRON_TARGET_DEPTH) raysBeyondTarget += 1;
      for (let t = 0; t <= gap + 1e-9; t += 1 / 32) {
        const at = toCanvas(point.x + apron.normal.x * t, point.y + apron.normal.y * t);
        if (inside(at)) samples.push({ ...at, building: apron.buildingId, t: Math.round(t * 1000) / 1000, gap: Math.round(gap * 1000) / 1000 });
      }
    });
  }
  return { aprons, samples, rays, raysWithoutRibbon, raysBeyondTarget };
}

function snapshot(state: GameState): Phase10ProofSnapshot {
  return {
    tick: state.tick,
    wallTick: state.wallTick,
    population: state.population,
    idleWorkers: state.idleWorkers,
    treasuryTimber: state.treasuryTimber,
    roadRevision: state.roadRevision,
    buildings: state.buildings.map((building) => ({
      id: building.id,
      kind: building.kind,
      tx: building.tx,
      ty: building.ty,
      ...buildingFootprint(building),
      houseLot: building.houseLot ?? null,
      inventory: building.inventory,
      productionProgress: building.productionProgress,
      problemCause: buildingProblemCause(state, building.id),
    })),
    constructionSites: state.constructionSites.map((site) => ({ id: site.id, kind: site.kind, stall: site.stall })),
    houses: state.houses.map((house) => ({ buildingId: house.buildingId, residents: house.residents,
      level: house.level, breadStock: house.breadStock, lastServicedTick: house.lastServicedTick })),
    walkers: state.walkers.map((walker) => ({
      id: walker.id,
      kind: walker.kind,
      x: walker.position.tx,
      y: walker.position.ty,
      homeBuildingId: walker.homeBuildingId,
      phase: walker.kind === "builder" ? null : walker.phase,
      cargo: walker.cargo,
    })),
  };
}
