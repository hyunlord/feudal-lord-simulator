import type { BuildingKind } from "../../content/buildingConfig";
import type { GameState } from "../../engine/engine.types";
import type { PlacementTool } from "../../render/renderer";
import type { ZoneBrushTarget } from "../../render/zoneBrushInteraction";
import { OPENING_VILLAGE_CENTER, openingVillageBuildings } from "../../state/openingVillage";
import { canPlaceRoad } from "../../world/roadGraph";
import { getTile, type TileCoordinate } from "../../world/grid";
import { canPlaceBuildingWithZones } from "../../zones/zonePlacement";
import { zonePaintAssessment, zonesOf } from "../../zones/zoneEdits";
import type { ZoneStroke } from "../../zones/zone.types";
import { ONBOARDING_ARABLE_CELLS } from "../onboardingBuildingTaskProgress";

// UX-1 first-session tutorial (research E "첫 세션 대본 0~15분", work order UX-1 section 2): thirteen steps in a fixed
// order. Pure and derived: a step is done when its game-state predicate holds (a new well, a house on a road, an
// arable zone ...), or, for the steps that only explain something, when the player acknowledged it. Acknowledgements
// live in the platform preferences (tutorialStore.ts), not in the save; a later step's predicate also closes every
// earlier acknowledgement, so a save loaded elsewhere resumes on the same card (gate 3).
//  - Unlocks: while the tutorial runs, the build categories, tools and control layers open with the steps
//    (`tutorialAccess`); with the tutorial off, or once it is finished, everything but the defence and the direction
//    layer (petitions, P2) is open, subject to the game's own era rules.
//  - Suggestions: each placing step has a spot the game picks (a buildable, road-adjacent origin near the opening
//    village; a road tile; a zone stroke that paints enough cells), so the card's second press can place it through the
//    same input intents a click or a drag sends (gate 1: the whole script plays by pressing the card buttons only).

export type TutorialStepId =
  | "greet" | "well" | "well_done" | "house" | "road" | "arable" | "arable_limits"
  | "food_chain" | "granary" | "zone_unlock" | "burgage" | "burgage_done" | "wrap_up";

export const TUTORIAL_STEP_IDS = [
  "greet", "well", "well_done", "house", "road", "arable", "arable_limits",
  "food_chain", "granary", "zone_unlock", "burgage", "burgage_done", "wrap_up",
] as const satisfies readonly TutorialStepId[];

/** Steps that close by an acknowledgement (their card button), not by a game-state predicate. */
const ACK_STEPS: ReadonlySet<TutorialStepId> = new Set(["greet", "well_done", "arable_limits", "zone_unlock", "burgage_done", "wrap_up"]);

export type BuildCategoryKey = "living" | "paths" | "trade" | "storage" | "public" | "defense";
export type ControlLayer = "direct" | "zone" | "direction";
export type TutorialZoneTarget = ZoneBrushTarget;

/** What the card button does next. `arm` opens the tool (menu, pulse, halo); `place` places at the suggested spot. */
export type TutorialAction =
  | { readonly kind: "ack"; readonly step: TutorialStepId; readonly resume?: boolean }
  | { readonly kind: "arm"; readonly tool: PlacementTool }
  | { readonly kind: "place"; readonly tool: PlacementTool; readonly tile: TileCoordinate }
  | { readonly kind: "armZone"; readonly target: TutorialZoneTarget }
  | { readonly kind: "paintZone"; readonly target: TutorialZoneTarget; readonly stroke: ZoneStroke }
  | { readonly kind: "layer"; readonly layer: ControlLayer; readonly step: TutorialStepId };

export type TutorialProgress = { readonly current: number; readonly target: number };

export type TutorialStepView = {
  readonly id: TutorialStepId;
  readonly index: number;
  readonly progress: TutorialProgress | null;
  /** The map target (halo) of the step, if it places something. */
  readonly target: { readonly tiles: readonly TileCoordinate[]; readonly focus: TileCoordinate } | null;
};

const OPENING_COUNTS: ReadonlyMap<BuildingKind, number> = openingVillageBuildings().reduce(
  (counts, building) => counts.set(building.kind, (counts.get(building.kind) ?? 0) + 1), new Map<BuildingKind, number>());
const OPENING_IDS: ReadonlySet<string> = new Set(openingVillageBuildings().map(building => building.id));

/** Buildings and construction sites of a kind (a placed site counts: the step teaches placing, not waiting). */
export function placedCount(state: Pick<GameState, "buildings" | "constructionSites">, kind: BuildingKind): number {
  return state.buildings.filter(building => building.kind === kind).length
    + state.constructionSites.filter(site => site.kind === kind).length;
}

/** Placed beyond the opening village's own (the new well, the new granary ...). */
export function newCount(state: Pick<GameState, "buildings" | "constructionSites">, kind: BuildingKind): number {
  return Math.max(0, placedCount(state, kind) - (OPENING_COUNTS.get(kind) ?? 0));
}

type Footprint = { readonly id: string; readonly tx: number; readonly ty: number };
function newHouses(state: Pick<GameState, "buildings" | "constructionSites">): readonly Footprint[] {
  return [
    ...state.buildings.filter(building => building.kind === "house" && !OPENING_IDS.has(building.id)),
    ...state.constructionSites.flatMap(site => site.kind === "house" && "tx" in site ? [site] : []),
  ];
}

const CARDINAL = [{ tx: 0, ty: -1 }, { tx: 1, ty: 0 }, { tx: 0, ty: 1 }, { tx: -1, ty: 0 }] as const;
function besideRoad(state: GameState, tile: TileCoordinate): boolean {
  return CARDINAL.some(offset => getTile(state, { tx: tile.tx + offset.tx, ty: tile.ty + offset.ty })?.hasRoad === true);
}

function zoneCells(state: Pick<GameState, "zones">, kind: string): number {
  return zonesOf(state).filter(zone => zone.kind === kind).reduce((sum, zone) => sum + zone.membership.length, 0);
}

/** The game-state predicate of a step (null: the step closes by acknowledgement only). */
function stepPredicate(id: TutorialStepId): ((state: GameState) => boolean) | null {
  switch (id) {
    case "well": return state => newCount(state, "well") >= 1;
    case "house": return state => newHouses(state).length >= 1;
    case "road": return state => newHouses(state).some(house => besideRoad(state, house));
    case "arable": return state => zoneCells(state, "arable") >= ONBOARDING_ARABLE_CELLS;
    case "food_chain": return state => placedCount(state, "farmstead") >= 1 && placedCount(state, "mill") >= 1;
    case "granary": return state => newCount(state, "granary") >= 1;
    case "burgage": return state => zoneCells(state, "burgage") > 0;
    default: return null;
  }
}

/** Progress shown on the card (0/1, 1/2 ...). */
export function stepProgress(state: GameState, id: TutorialStepId): TutorialProgress | null {
  switch (id) {
    case "well": return { current: Math.min(1, newCount(state, "well")), target: 1 };
    case "house": return { current: Math.min(1, newHouses(state).length), target: 1 };
    case "road": return { current: newHouses(state).some(house => besideRoad(state, house)) ? 1 : 0, target: 1 };
    case "arable": return { current: Math.min(ONBOARDING_ARABLE_CELLS, zoneCells(state, "arable")), target: ONBOARDING_ARABLE_CELLS };
    case "food_chain": return { current: Math.min(1, placedCount(state, "farmstead")) + Math.min(1, placedCount(state, "mill")), target: 2 };
    case "granary": return { current: Math.min(1, newCount(state, "granary")), target: 1 };
    case "burgage": return { current: zoneCells(state, "burgage") > 0 ? 1 : 0, target: 1 };
    default: return null;
  }
}

/**
 * Index of the current step (TUTORIAL_STEP_IDS.length when finished). A step is done when its predicate holds, when
 * it was acknowledged, or when any later predicate step already holds (the save got past it).
 */
export function currentStepIndex(state: GameState, acks: ReadonlySet<TutorialStepId>): number {
  const done = TUTORIAL_STEP_IDS.map(id => {
    const predicate = stepPredicate(id);
    return predicate === null ? acks.has(id) : predicate(state);
  });
  // A later predicate step that holds closes the acknowledgements before it.
  let last = -1;
  done.forEach((value, index) => { if (value && !ACK_STEPS.has(TUTORIAL_STEP_IDS[index]!)) last = index; });
  const index = done.findIndex((value, at) => !value && at > last);
  return index < 0 ? TUTORIAL_STEP_IDS.length : index;
}

/** Whether a step's predicate held already when it became current (G: "이미 갖춰짐 ✓", then it folds). */
export function stepAlreadyMet(state: GameState, id: TutorialStepId): boolean {
  return stepPredicate(id)?.(state) === true;
}

export type TutorialAccess = {
  readonly categories: Readonly<Record<BuildCategoryKey, boolean>>;
  readonly tools: (tool: PlacementTool) => boolean;
  readonly layers: Readonly<Record<ControlLayer, boolean>>;
  readonly zoneTargets: (target: TutorialZoneTarget) => boolean;
  /** Arable brush card in the trade (생업) category (direct layer). */
  readonly arableCard: boolean;
};

const ALL_OPEN: TutorialAccess = {
  categories: { living: true, paths: true, trade: true, storage: true, public: true, defense: true },
  tools: () => true,
  layers: { direct: true, zone: true, direction: false },
  zoneTargets: () => true,
  arableCard: true,
};

const stepAt = (id: TutorialStepId): number => TUTORIAL_STEP_IDS.indexOf(id);

/**
 * What is open at a step index (tutorial on). Direct building of houses, wells and roads from the start; the trade
 * category (the arable brush, then the barn and mill) at the food step; storage (the granary) at the granary step;
 * the zone layer, with plots only, at the zone step; public buildings and the other trade and storage tools when the
 * tutorial ends. Defence opens with the palisade stage (`defenseOpen`: the proclamation is possible or done); the
 * direction layer stays closed (petitions, P2).
 */
export function tutorialAccess(enabled: boolean, index: number, defenseOpen = false): TutorialAccess {
  if (!enabled) return ALL_OPEN;
  // Finished: everything is open but defence, which waits for the palisade stage (research E: "방어·권리 계속 숨김").
  if (index >= TUTORIAL_STEP_IDS.length) return defenseOpen ? ALL_OPEN : { ...ALL_OPEN, categories: { ...ALL_OPEN.categories, defense: false } };
  const reached = (id: TutorialStepId) => index >= stepAt(id);
  const trade = reached("arable"); const chain = reached("food_chain"); const storage = reached("granary");
  const zone = reached("zone_unlock");
  const openTools = new Set<PlacementTool>(["house", "well", "road"]);
  if (chain) { openTools.add("farmstead"); openTools.add("mill"); }
  if (storage) openTools.add("granary");
  return {
    categories: { living: true, paths: true, trade, storage, public: false, defense: false },
    tools: tool => openTools.has(tool),
    layers: { direct: true, zone, direction: false },
    zoneTargets: target => zone && target === "burgage",
    arableCard: trade,
  };
}

// ---- Suggested spots -------------------------------------------------------------------------------------------

const SEARCH_RADIUS = 14;
/** Candidate origins around the opening village, nearest first (ties: row, then column). */
function candidates(state: GameState): readonly TileCoordinate[] {
  const centre = OPENING_VILLAGE_CENTER;
  const list: { tile: TileCoordinate; distance: number }[] = [];
  for (let ty = centre.ty - SEARCH_RADIUS; ty <= centre.ty + SEARCH_RADIUS; ty += 1) {
    for (let tx = centre.tx - SEARCH_RADIUS; tx <= centre.tx + SEARCH_RADIUS; tx += 1) {
      if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) continue;
      list.push({ tile: { tx, ty }, distance: Math.abs(tx - centre.tx) + Math.abs(ty - centre.ty) });
    }
  }
  return list.sort((a, b) => a.distance - b.distance || a.tile.ty - b.tile.ty || a.tile.tx - b.tile.tx).map(entry => entry.tile);
}

const FOOTPRINT: Partial<Record<BuildingKind, number>> = { granary: 2, storehouse: 2, market: 2, church: 2, keep: 2, quarry: 2 };
function footprintTiles(kind: BuildingKind, origin: TileCoordinate): readonly TileCoordinate[] {
  const size = FOOTPRINT[kind] ?? 1;
  const tiles: TileCoordinate[] = [];
  for (let dy = 0; dy < size; dy += 1) for (let dx = 0; dx < size; dx += 1) tiles.push({ tx: origin.tx + dx, ty: origin.ty + dy });
  return tiles;
}

function placeable(state: GameState, kind: BuildingKind, origin: TileCoordinate): boolean {
  return canPlaceBuildingWithZones(state, kind, origin.tx, origin.ty).ok;
}

/** Keeps a tile ring free around existing buildings and sites so the suggestions leave room for roads. */
function clearOfBuildings(state: GameState, kind: BuildingKind, origin: TileCoordinate): boolean {
  return footprintTiles(kind, origin).every(tile => CARDINAL.every(offset => {
    const next = getTile(state, { tx: tile.tx + offset.tx, ty: tile.ty + offset.ty });
    return next === null || next.buildingId === null;
  }));
}

/** The spot the card places a building on: buildable, a road on a side, clear of other buildings. */
export function suggestedBuildingSpot(state: GameState, kind: BuildingKind): TileCoordinate | null {
  for (const origin of candidates(state)) {
    if (!placeable(state, kind, origin) || !clearOfBuildings(state, kind, origin)) continue;
    if (!footprintTiles(kind, origin).some(tile => besideRoad(state, tile))) continue;
    if (kind === "farmstead" && !nearZone(state, origin, "arable")) continue;
    if (kind === "mill" && !nearKind(state, origin, "farmstead", 6)) continue;
    return origin;
  }
  return null;
}

/** The house spot: one free tile off a road (so the next card links it), clear of other buildings. */
export function suggestedHouseSpot(state: GameState): { readonly house: TileCoordinate; readonly road: TileCoordinate } | null {
  for (const origin of candidates(state)) {
    if (!placeable(state, "house", origin) || !clearOfBuildings(state, "house", origin) || besideRoad(state, origin)) continue;
    for (const offset of CARDINAL) {
      const link = { tx: origin.tx + offset.tx, ty: origin.ty + offset.ty };
      if (canPlaceRoad(state, link) && besideRoad(state, link)) return { house: origin, road: link };
    }
  }
  return null;
}

/** The road tile that links the newest house to the network (a free side tile beside an existing road). */
export function suggestedRoadTile(state: GameState): TileCoordinate | null {
  for (const house of newHouses(state)) {
    if (besideRoad(state, house)) continue;
    for (const offset of CARDINAL) {
      const link = { tx: house.tx + offset.tx, ty: house.ty + offset.ty };
      if (canPlaceRoad(state, link) && besideRoad(state, link)) return link;
    }
  }
  return null;
}

function nearZone(state: GameState, origin: TileCoordinate, kind: string): boolean {
  const cells = new Set(zonesOf(state).filter(zone => zone.kind === kind).flatMap(zone => zone.membership));
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    if (cells.has((origin.ty + dy) * state.width + origin.tx + dx)) return true;
  }
  return false;
}

function nearKind(state: GameState, origin: TileCoordinate, kind: BuildingKind, radius: number): boolean {
  return [...state.buildings, ...state.constructionSites.flatMap(site => "tx" in site ? [site] : [])].some(item => item.kind === kind
    && Math.abs(item.tx - origin.tx) + Math.abs(item.ty - origin.ty) <= radius);
}

/** Open ground for a zone: grass or woodland (arable grows on both, AF-1), no road, no building, no zone yet. */
function openGround(state: GameState, tile: TileCoordinate, taken: ReadonlySet<number>): boolean {
  const value = getTile(state, tile);
  return value !== null && (value.terrain === "grass" || value.terrain === "forest") && !value.hasRoad && value.buildingId === null
    && !taken.has(tile.ty * state.width + tile.tx);
}

/**
 * The zone stroke the card paints: a brush line of `radius` through the middle row of the first open `width` x
 * `height` block beside a road (every cell open ground), checked with the game's own paint assessment so it takes at
 * least `minimum` cells.
 */
export function suggestedZoneStroke(state: GameState, kind: "arable" | "burgage", radius: number): { readonly stroke: ZoneStroke; readonly cells: readonly TileCoordinate[] } | null {
  const [width, height] = kind === "arable" ? [4, 3] : [4, 3];
  const minimum = kind === "arable" ? ONBOARDING_ARABLE_CELLS : 4;
  const taken = new Set(zonesOf(state).flatMap(zone => zone.membership));
  for (const origin of candidates(state)) {
    const cells: TileCoordinate[] = [];
    for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) cells.push({ tx: origin.tx + dx, ty: origin.ty + dy });
    if (!cells.every(cell => openGround(state, cell, taken))) continue;
    if (!cells.some(cell => besideRoad(state, cell))) continue;
    const row = origin.ty + Math.floor(height / 2);
    const stroke: ZoneStroke = { tool: "brush", radius, points: [{ x: origin.tx + 0.5 + 0.5, y: row + 0.5 }, { x: origin.tx + width - 1, y: row + 0.5 }] };
    const assessment = zonePaintAssessment(state, kind, stroke);
    if (!assessment.ok || assessment.cells.length < minimum) continue;
    return { stroke, cells };
  }
  return null;
}

/** The card button's next action at a step, given the armed tool / zone brush. */
export function stepAction(state: GameState, id: TutorialStepId, armed: { readonly tool: PlacementTool | null; readonly zone: TutorialZoneTarget | null; readonly layer: ControlLayer }, zoneRadius: number): TutorialAction | null {
  const building = (tool: BuildingKind, spot: TileCoordinate | null): TutorialAction | null =>
    armed.tool === tool ? spot === null ? null : { kind: "place", tool, tile: spot } : { kind: "arm", tool };
  switch (id) {
    case "greet": return { kind: "ack", step: id, resume: true };
    case "well": return building("well", suggestedBuildingSpot(state, "well"));
    case "house": return building("house", suggestedHouseSpot(state)?.house ?? null);
    case "road": {
      const tile = suggestedRoadTile(state);
      return armed.tool === "road" ? tile === null ? null : { kind: "place", tool: "road", tile } : { kind: "arm", tool: "road" };
    }
    case "arable": {
      if (armed.zone !== "arable") return { kind: "armZone", target: "arable" };
      const suggestion = suggestedZoneStroke(state, "arable", zoneRadius);
      return suggestion === null ? null : { kind: "paintZone", target: "arable", stroke: suggestion.stroke };
    }
    case "food_chain": {
      if (placedCount(state, "farmstead") === 0) return building("farmstead", suggestedBuildingSpot(state, "farmstead"));
      return building("mill", suggestedBuildingSpot(state, "mill"));
    }
    case "granary": return building("granary", suggestedBuildingSpot(state, "granary"));
    case "zone_unlock": return { kind: "layer", layer: "zone", step: id };
    case "burgage": {
      if (armed.zone !== "burgage") return { kind: "armZone", target: "burgage" };
      const suggestion = suggestedZoneStroke(state, "burgage", zoneRadius);
      return suggestion === null ? null : { kind: "paintZone", target: "burgage", stroke: suggestion.stroke };
    }
    default: return { kind: "ack", step: id };
  }
}

/** The map target (halo) of the current step. */
export function stepTarget(state: GameState, id: TutorialStepId, zoneRadius: number): TutorialStepView["target"] {
  const single = (tile: TileCoordinate | null, kind?: BuildingKind) => tile === null ? null
    : { tiles: kind === undefined ? [tile] : footprintTiles(kind, tile), focus: tile };
  switch (id) {
    case "well": return single(suggestedBuildingSpot(state, "well"), "well");
    case "house": return single(suggestedHouseSpot(state)?.house ?? null, "house");
    case "road": return single(suggestedRoadTile(state));
    case "arable": case "burgage": {
      const suggestion = suggestedZoneStroke(state, id, zoneRadius);
      return suggestion === null ? null : { tiles: suggestion.cells, focus: suggestion.cells[Math.floor(suggestion.cells.length / 2)]! };
    }
    case "food_chain": {
      const kind = placedCount(state, "farmstead") === 0 ? "farmstead" : "mill";
      return single(suggestedBuildingSpot(state, kind), kind);
    }
    case "granary": return single(suggestedBuildingSpot(state, "granary"), "granary");
    default: return null;
  }
}

/** Whether the step needs the zone layer (the brush lives there) or the trade card (the arable brush). */
export function stepLayer(id: TutorialStepId): ControlLayer {
  return id === "burgage" || id === "burgage_done" ? "zone" : "direct";
}
