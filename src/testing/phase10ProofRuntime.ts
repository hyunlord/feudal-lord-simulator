import type { MutableRefObject } from "react";

import type { ResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import { worldToCanvas, type CameraState } from "../render/camera";
import { tileCenter } from "../render/picking";
import { buildingProblemCause } from "../ui/problemCauseModel";

type ProofLocation = {
  readonly hostname: string;
  readonly search: string;
};

type BuildingProofSummary = {
  readonly id: string;
  readonly kind: string;
  readonly tx: number;
  readonly ty: number;
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

  const port: Phase10ProofRuntimePort = {
    tileClientPoint: (tile) => tileClientPoint(input.canvas, input.cameraRef.current, tile),
    snapshot: () => snapshot(input.stateRef.current),
  };
  window.__FEUDAL_PHASE10_PROOF__ = port;

  return () => {
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
      inventory: building.inventory,
      productionProgress: building.productionProgress,
      problemCause: buildingProblemCause(state, building.id),
    })),
    constructionSites: state.constructionSites.map((site) => ({ id: site.id, kind: site.kind, stall: site.stall })),
    houses: state.houses.map((house) => ({ buildingId: house.buildingId, residents: house.residents })),
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
