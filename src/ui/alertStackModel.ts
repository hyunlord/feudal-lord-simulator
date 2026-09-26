import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { constructionSiteAnchor } from "../economy/construction";
import type { GameState } from "../engine/engine.types";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { InputIntent } from "../input/inputIntent";
import type { TileCoordinate } from "../world/grid";
import { ALERT_STACK_COPY } from "./alertStackCopy.ko";
import { CAUSE_REGISTRY, type CauseDetail, type CauseId } from "./causeRegistry";
import { constructionAccessModel, type ConstructionAccessCause } from "./constructionAccessModel";
import { buildingCauseSnapshot, type BuildingCausePresentation } from "./houseProgressModel";

// Warning stack (right side, under the goal cards). Rows come from the same per-building cause model the cause map
// draws (`buildingCauseSnapshot`: houses and facilities, status + blocker `CauseDetail`) plus the construction-site
// access cause (`constructionAccessModel`). Same cause across buildings folds into one row; immediate rows first,
// then by how many buildings share the cause. At most three rows.

export type AlertSeverity = "immediate" | "caution";

export type AlertRow = Readonly<{
  /** Stable aggregation key (severity + cause). */
  id: string;
  severity: AlertSeverity;
  /** ▲ immediate / ◆ caution. */
  shape: string;
  /** Bold title, e.g. `밀 공급 없음`. */
  title: string;
  /** Count of affected buildings, e.g. `방앗간 2`. */
  countLabel: string;
  count: number;
  /** One-line cause of the first affected building, e.g. `곡창에 밀 재고가 없습니다`. */
  cause: string;
  causeId: CauseId | null;
  /** Affected building or construction-site ids, in state order; `[보기]` inspects the first. */
  targetIds: readonly string[];
  /** Tile of the first affected building (camera `lookAt` target). */
  focusTile: TileCoordinate;
}>;

export const ALERT_STACK_MAX_ROWS = 3;
/** Before this tick water and bread supply have not been computed yet (the audit saw `우물이 필요합니다` at tick 0). */
export const ALERT_STACK_MIN_TICK = 20;

/** problemCauseModel's in-transit wording (`…운반을 기다리는 중`, `…옮기기를 기다리는 중`): supply exists and is on its way. */
export const IN_TRANSIT_CAUSE_MARK = "기다리는 중";
const IMMEDIATE_SITE_CAUSES: ReadonlySet<ConstructionAccessCause> = new Set([
  "road_disconnected", "no_route", "wall_blocked", "no_material", "reserve_deadlock",
]);
const NO_ROWS: readonly AlertRow[] = Object.freeze([]);

type AlertEntry = Readonly<{
  key: string;
  severity: AlertSeverity;
  title: string;
  cause: string;
  causeId: CauseId | null;
  name: string;
  targetId: string;
  tile: TileCoordinate;
}>;

function footprintCentre(building: Building): TileCoordinate {
  const size = buildingFootprint(building);
  return { tx: building.tx + Math.floor((size.width - 1) / 2), ty: building.ty + Math.floor((size.height - 1) / 2) };
}

function facilityTitle(building: Building, blocker: CauseDetail): string {
  const production = BUILDING_CONFIG_BY_KIND[building.kind].production;
  const copy = ALERT_STACK_COPY.facility;
  switch (blocker.reason) {
    case "no_input": return production?.input == null ? copy.inputMissing(CAUSE_REGISTRY[blocker.causeId].shortLabel)
      : copy.inputMissing(ALERT_STACK_COPY.resource[production.input]);
    case "output_full": return production === null ? CAUSE_REGISTRY[blocker.causeId].shortLabel
      : copy.outputFull(ALERT_STACK_COPY.resource[production.output]);
    case "no_road": return copy.noRoad;
    case "understaffed": return copy.understaffed;
    case "paused": return copy.paused;
    case "upkeep_unpaid": return copy.upkeepUnpaid;
    case "storage_overflow": return copy.storageOverflow;
    default: return CAUSE_REGISTRY[blocker.causeId].shortLabel;
  }
}

function buildingEntry(building: Building, cause: BuildingCausePresentation): AlertEntry | null {
  const blocker = cause.blocker;
  if (blocker === null || blocker.label === "" || (cause.status !== "blocked" && cause.status !== "risk")) return null;
  const house = building.kind === "house";
  const severity: AlertSeverity = house
    ? cause.status === "risk" ? "immediate" : "caution"
    : blocker.label.includes(IN_TRANSIT_CAUSE_MARK) ? "caution" : "immediate";
  const title = house ? ALERT_STACK_COPY.house[blocker.requirement] : facilityTitle(building, blocker);
  // Labels carry per-building numbers (거리 5 / 범위 4, 12/20): the same wording with other numbers is the same cause.
  const wording = blocker.label.replace(/\d+/g, "#");
  return {
    key: `${severity}|building|${blocker.causeId}|${blocker.requirement}|${blocker.reason}|${title}|${wording}`,
    severity, title, cause: blocker.label, causeId: blocker.causeId,
    name: house ? ALERT_STACK_COPY.houseName : BUILDING_CONFIG_BY_KIND[building.kind].name,
    targetId: building.id, tile: footprintCentre(building),
  };
}

function siteEntries(state: GameState): readonly AlertEntry[] {
  return state.constructionSites.flatMap((site) => {
    const access = constructionAccessModel(state, site);
    if (access.cause === "none") return [];
    const severity: AlertSeverity = IMMEDIATE_SITE_CAUSES.has(access.cause) ? "immediate" : "caution";
    const copy = ALERT_STACK_COPY.site[access.cause];
    const causeId: CauseId = access.cause === "reserve_deadlock" ? "reserve_deadlock" : "construction_access";
    return [{
      key: `${severity}|site|${access.cause}`, severity, title: copy.title,
      cause: access.cause === "reserve_deadlock" ? access.label : copy.cause, causeId,
      name: ALERT_STACK_COPY.siteName, targetId: site.id, tile: constructionSiteAnchor(site),
    }];
  });
}

/** UI-4: a house on fire (immediate) and a household getting ready to leave (caution), as crisis rows. */
function storyEntries(state: GameState): readonly AlertEntry[] {
  const at = (id: string) => state.buildings.find(building => building.id === id);
  const copy = ALERT_STACK_COPY.story;
  const fires = (state.events?.burning ?? []).flatMap(entry => { const building = at(entry.buildingId); return building === undefined ? [] : [{
    key: "immediate|story|fire", severity: "immediate" as const, title: copy.fireTitle, cause: copy.fireCause, causeId: null,
    name: ALERT_STACK_COPY.houseName, targetId: building.id, tile: footprintCentre(building) }]; });
  const leaving = state.houses.flatMap(house => { const building = house.leavingSinceTick !== undefined && house.abandonedTick === undefined ? at(house.buildingId) : undefined;
    return building === undefined ? [] : [{ key: "caution|story|leaving", severity: "caution" as const, title: copy.leavingTitle, cause: copy.leavingCause, causeId: null,
      name: ALERT_STACK_COPY.houseName, targetId: building.id, tile: footprintCentre(building) }]; });
  return [...fires, ...leaving];
}

function deriveRows(state: GameState): readonly AlertRow[] {
  const snapshot = buildingCauseSnapshot(state);
  const entries = [
    ...storyEntries(state),
    ...state.buildings.flatMap((building) => {
      const cause = snapshot.get(building.id);
      const entry = cause === undefined ? null : buildingEntry(building, cause);
      return entry === null ? [] : [entry];
    }),
    ...siteEntries(state),
  ];
  const groups = new Map<string, { readonly first: AlertEntry; readonly ids: string[]; readonly names: Set<string>; readonly order: number }>();
  for (const entry of entries) {
    const group = groups.get(entry.key);
    if (group === undefined) groups.set(entry.key, { first: entry, ids: [entry.targetId], names: new Set([entry.name]), order: groups.size });
    else { group.ids.push(entry.targetId); group.names.add(entry.name); }
  }
  return [...groups.values()]
    .sort((a, b) => (a.first.severity === b.first.severity ? 0 : a.first.severity === "immediate" ? -1 : 1)
      || b.ids.length - a.ids.length || a.order - b.order)
    .slice(0, ALERT_STACK_MAX_ROWS)
    .map(({ first, ids, names }) => ({
      id: first.key,
      severity: first.severity,
      shape: ALERT_STACK_COPY.shape[first.severity],
      title: first.title,
      countLabel: ALERT_STACK_COPY.count(names.size === 1 ? first.name : ALERT_STACK_COPY.mixedName, ids.length),
      count: ids.length,
      cause: first.cause,
      causeId: first.causeId,
      targetIds: ids,
      focusTile: first.tile,
    }));
}

// Cache (AGENTS rule 10).
// (a) Key: the GameState object. Every tick and every player action returns a new state object (immutable updates),
//     so a hit always means "same world"; a WeakMap lets old states go.
// (b) Nothing outside `state` is read: the cause snapshot and the site access model are pure functions of the state,
//     so no input is missing from the key.
// (c) Measured with `tsx` on seed 2 (78 buildings; wheat removed and every other well dropped: 10 blocked mills,
//     5 houses at risk), 200 state objects: before (every call derives) 0.37 ms per call; after, a repeated call for
//     the same state (React re-render between ticks) is a WeakMap hit at < 0.001 ms. The first call per state is unchanged.
const rowCache = new WeakMap<GameState, readonly AlertRow[]>();

/** Warning-stack rows for `state` (empty while `state.tick < ALERT_STACK_MIN_TICK`). */
export function alertStackRows(state: GameState): readonly AlertRow[] {
  if (state.tick < ALERT_STACK_MIN_TICK) return NO_ROWS;
  const cached = rowCache.get(state);
  if (cached !== undefined) return cached;
  const rows = deriveRows(state);
  rowCache.set(state, rows);
  return rows;
}

/** `[보기]`: move the camera to the first affected building. */
export function alertRowLookAtIntent(row: AlertRow): InputIntent {
  return { kind: "lookAt", tile: row.focusTile };
}
