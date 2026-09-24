// Loads the compact seed 1-5 ground fixtures (scripts/extractBoundaryFixtures.ts) and the 12x12 fixed scene.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { Tile } from "../src/world/world.types";
import { boundaryFixtureState } from "../scripts/boundaryFixtureScene";

type GroundFixture = {
  readonly seed: number; readonly width: number; readonly height: number; readonly terrain: string; readonly roads: string;
  readonly buildingIds: readonly (readonly [number, string])[]; readonly palisade: GameState["palisade"];
  readonly farms: readonly { readonly id: string; readonly kind: "wheat_farm"; readonly tx: number; readonly ty: number }[];
};
const TERRAIN = { g: "grass", f: "forest", w: "water", r: "rock" } as const;

export function seedGroundState(seed: 1 | 2 | 3 | 4 | 5): GameState {
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/boundary/seed${seed}-ground.json.gz`, import.meta.url))).toString("utf8")) as GroundFixture;
  const ids = new Map(fixture.buildingIds);
  const tiles: Tile[] = [...fixture.terrain].map((code, index) => ({
    tx: index % fixture.width, ty: Math.floor(index / fixture.width),
    terrain: TERRAIN[code as keyof typeof TERRAIN], hasRoad: fixture.roads[index] === "1", buildingId: ids.get(index) ?? null,
  }));
  const farms: Building[] = fixture.farms.map(farm => ({ ...farm, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 }));
  return { ...DEFAULT_GAME_STATE, seed: fixture.seed, width: fixture.width, height: fixture.height, tiles, buildings: farms,
    houses: [], palisade: fixture.palisade, roadRevision: 1, pathCache: {} };
}

export function fixedSceneState(): GameState {
  return boundaryFixtureState(DEFAULT_GAME_STATE);
}

export const BOUNDARY_FIXTURES: readonly { readonly name: string; readonly state: () => GameState }[] = [
  { name: "fixed 12x12", state: fixedSceneState },
  ...([1, 2, 3, 4, 5] as const).map(seed => ({ name: `seed ${seed} final`, state: () => seedGroundState(seed) })),
];
