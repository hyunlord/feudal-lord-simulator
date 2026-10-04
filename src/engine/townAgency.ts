/**
 * LM-E1 (spec docs/design/town-agency.md TA-1…TA-9): lord mode's town agency. Each week the town's actors — the
 * households, the merchant families, the guild, the community, the church — save, propose the projects the town needs
 * (the bot's planning steps, read as needs) and the ones the lord's conditions make worth it, score each by named
 * reasons, and start the best they can pay for. Every start leaves a receipt: who, what, where, its five largest
 * reasons and the lord's decisions behind them. With no `state.agency` (sandbox, campaign) nothing here runs.
 */
import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";
import {
  ACTOR_OPENING_FUNDS, ACTOR_WEEKLY, AGENCY_ACTORS, AGENCY_WEEK_TICKS, builderOfKind, CENTRE_KINDS, CHARTER_HOLD_WEEKS, CHARTER_POPULATION, DUES_POINTS_PER_100_PERMILLE,
  FIRE_NEIGHBOUR_POINTS, LAND_REACH, LAND_STEP, MATERIAL_PENNIES, NEED_STEP, NEED_TOP, OPEN_SITES_MAX, OPPORTUNITY_KINDS, PLAN_SITE_POINTS, policyWeight,
  LOAN_NEED, OPPORTUNITY_POLICY_FACTOR, REASON_ORDER, RECEIPTS_KEPT, ROAD_TILE_PENNIES, SITE_CANDIDATES_MAX, SITE_FULL_CHECKS_MAX, SITE_SEARCH_RADIUS,
  START_SCORE, STARTS_PER_WEEK, TEMPERAMENT_SPREAD, CHOICE_SPAN, STUCK_POINTS_PER_100, SUBSIDY_POINTS_PER_10D, SUBSIDY_TREASURY_PERMILLE,
  WALK_REUSE_IDLE_WEEKS, WALK_REUSE_TICKS,
} from "../content/townAgencyConfig";
import { constructionSiteId, isBuildingConstructionSite } from "../economy/construction";
import { postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import { paintZone } from "../zones/zoneEdits";
import { planZoneFill } from "../zones/zoneFillAgent";
import { setFarmsteadCrop } from "./ale";
import { autoplayBuildAction, planningEarlyNeeds, planningNeeds, townSiteRefusal, type AutoplayPolicy, type PlanningNeed } from "./autoplay";
import { runAutoplaySearch } from "./autoplaySearchBudget";
import { preservesAutoplayServiceSpace, resetAutoplayServiceSearch } from "./autoplayServiceSpace";
import { keepsInteriorHouseSites } from "./autoplayInteriorPlots";
import { hasAutoplayBuildingClearance } from "./autoplaySetback";
import { autoplayCanPlace } from "./autoplayZones";
import type { AdvisorAction } from "./autoplayBotRecovery";
import { granaryCoverageTargetIds } from "./autoplayFoodCoverage";
import { recordMaterialPlacement } from "./autoplayMaterialLifecycle";
import type { GameState } from "./engine.types";
import { hashSeed } from "../content/seedHash";
import { rebuildBurntHouse } from "./fire";
import { placeBuilding, placeRoadLine } from "./gameActions";
import { demolishHouse } from "./houseDemolition";
import { marketStalls } from "./moneyRules";
import { canProclaimPalisadeEra } from "./era";
import { housingLotCount } from "../population/housing";
import { stuckStock } from "./stuckStock";
import { agencyDuesPermille } from "./townAgencyDues";
import { orderTimber } from "./timberTrade";
import type {
  ActorKind, AgencyActor, AgencyState, AgencyWalk, ChoiceChance, EstatePolicy, LordRequest, ProjectReceipt, ProjectSubsidy, Reason, ReceiptSites, SubsidyRefusal, Temperament,
} from "./townAgency.types";

/** TA-1: the lord mode's town at its start. */
export function initialAgency(): AgencyState {
  return { actors: AGENCY_ACTORS.map(kind => ({ kind, funds: ACTOR_OPENING_FUNDS[kind] })), policy: "growth", subsidies: [],
    duesPermille: 1000, receipts: [], nextReceipt: 1, nextSubsidy: 1 };
}

export function agencyOf(state: Pick<GameState, "agency">): AgencyState | undefined {
  return state.agency;
}

/** TA-1: lord mode — the town builds itself; the player's ordinary building is closed. */
export function lordMode(state: Pick<GameState, "agency">): boolean {
  return state.agency !== undefined;
}

/** TA-1: the kinds the lord still places himself in lord mode (public works); every other kind is the town's. */
export const LORD_PUBLIC_WORKS: readonly BuildingKind[] = ["keep"];

// --- TA-6 the lord's conditions ------------------------------------------------------------------------------------

export function setEstatePolicy(state: GameState, policy: EstatePolicy): GameState {
  const agency = state.agency;
  return agency === undefined || agency.policy === policy ? state : { ...state, agency: { ...agency, policy } };
}

/**
 * TA-6 ② API: why this subsidy would be refused — the subsidies offered, with it in place of the kind's old one, would
 * pass a quarter of the treasury (`SUBSIDY_TREASURY_PERMILLE`). Null when it may be set (a withdrawal always may).
 */
export function subsidyRefusal(state: GameState, kind: BuildingKind, amount: number): SubsidyRefusal | null {
  const agency = state.agency;
  if (agency === undefined || amount <= 0) return null;
  const total = agency.subsidies.filter(subsidy => subsidy.kind !== kind).reduce((sum, subsidy) => sum + subsidy.amount, 0) + amount;
  const limit = Math.max(0, Math.floor(treasuryBalance(state) * SUBSIDY_TREASURY_PERMILLE / 1000));
  return total <= limit ? null : { reason: "over_treasury_share", tick: state.tick, kind, amount, total, limit };
}

/** TA-6 ②: `amount` 0 withdraws the subsidy on that kind; one past a quarter of the treasury is refused with its reason. */
export function setProjectSubsidy(state: GameState, kind: BuildingKind, amount: number): GameState {
  const agency = state.agency;
  if (agency === undefined || !Number.isInteger(amount) || amount < 0) return state;
  const others = agency.subsidies.filter(subsidy => subsidy.kind !== kind);
  if (amount === 0) return others.length === agency.subsidies.length ? state : { ...state, agency: { ...agency, subsidies: others } };
  const refusal = subsidyRefusal(state, kind, amount);
  if (refusal !== null) return { ...state, agency: { ...agency, lastRefusal: refusal } };
  const subsidy: ProjectSubsidy = { id: `subsidy-${agency.nextSubsidy}`, kind, amount };
  return { ...state, agency: { ...agency, subsidies: [...others, subsidy], nextSubsidy: agency.nextSubsidy + 1 } };
}

/** TA-6 ③: the stall fee the lord asks, permille of the usual (250‰…2000‰). */
export function setMarketDues(state: GameState, permille: number): GameState {
  const agency = state.agency;
  if (agency === undefined || !Number.isInteger(permille) || permille < 250 || permille > 2000 || permille === agency.duesPermille) return state;
  return { ...state, agency: { ...agency, duesPermille: permille } };
}


// --- TA-2 the actors' savings ----------------------------------------------------------------------------------------

function weeklySavings(state: GameState, kind: ActorKind): number {
  const lived = state.houses.filter(house => house.residents > 0 && house.abandonedTick === undefined);
  switch (kind) {
    case "households": return lived.reduce((sum, house) => sum + (ACTOR_WEEKLY.householdsPerHouseByLevel[house.level] ?? 1), 0);
    case "merchants": {
      const stalls = state.buildings.filter(building => building.kind === "market").reduce((sum, market) => sum + marketStalls(state, market), 0);
      // Less dues, more kept: at the usual dues a stall keeps its share; at double dues nothing.
      return lived.length * ACTOR_WEEKLY.merchantsPerHouse
        + Math.max(0, Math.round(stalls * ACTOR_WEEKLY.merchantsPerStall * (2000 - agencyDuesPermille(state)) / 1000));
    }
    case "guild": return state.reorganisation?.guild === undefined ? 0
      : state.buildings.filter(building => building.kind === "weaver_house").length * ACTOR_WEEKLY.guildPerWeaver;
    case "community": return lived.length * ACTOR_WEEKLY.communityPerHouse;
    case "church": return lived.length * ACTOR_WEEKLY.churchPerHouse;
  }
}

// --- TA-3 proposals ----------------------------------------------------------------------------------------------------

type TownAction = Extract<AdvisorAction, { readonly kind: "place_building" | "place_road" | "paint_zone" | "demolish_house" | "rebuild_house" | "set_farmstead_crop" }>;

export interface Proposal {
  readonly actor: ActorKind;
  readonly what: string;
  readonly planner: string;
  readonly rank: number | null;
  readonly action: TownAction;
  readonly tx: number;
  readonly ty: number;
  readonly reasons: readonly Reason[];
  readonly score: number;
  readonly cost: number;
  readonly subsidy: number;
  /** TA-10: a building's candidate sites compared (absent for roads, zones, house works). */
  readonly sites?: ReceiptSites;
  /** LM-E5 (LG-2): its site drawn by chance among its sites. */
  readonly siteChance?: ChoiceChance;
}

/** LM-E5 (LG-2) API: an actor's temperament, from the game seed (the same seed, the same temperaments). */
export function actorTemperament(state: Pick<GameState, "seed">, kind: ActorKind): Temperament {
  return hashSeed(state.seed, `actor-temperament:${kind}`) % 2 === 0 ? "cautious" : "bold";
}

/**
 * LM-E5 (LG-2): a draw among scored options (best first) by the game seed's number for `salt` — each option's weight
 * exp((score − best) / its spread), only those within CHOICE_SPAN of the best. The chosen index and its chance.
 */
function drawByScore(seed: number, salt: string, values: readonly number[], spreads: readonly number[], temperament: Temperament):
  { readonly index: number; readonly chance: ChoiceChance } {
  const best = values[0] ?? 0;
  const count = Math.max(1, values.filter(value => best - value <= CHOICE_SPAN).length);
  const weights = values.slice(0, count).map((value, index) => Math.exp((value - best) / spreads[index]!));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let draw = (hashSeed(seed, salt) % 1_000_000) / 1_000_000 * total;
  let index = 0;
  while (index < count - 1 && draw >= weights[index]!) { draw -= weights[index]!; index += 1; }
  return { index, chance: { permille: Math.round(weights[index]! / total * 1000), of: count, temperament, place: index + 1 } };
}

function isTownAction(action: AdvisorAction): action is TownAction {
  return action.kind === "place_building" || action.kind === "place_road" || action.kind === "paint_zone"
    || action.kind === "demolish_house" || action.kind === "rebuild_house" || action.kind === "set_farmstead_crop";
}

function whatOf(action: TownAction): string {
  switch (action.kind) {
    case "place_building": return action.building;
    case "place_road": return "road";
    case "paint_zone": return `zone:${action.zone}`;
    case "demolish_house": return "demolish_house";
    case "rebuild_house": return "rebuild_house";
    case "set_farmstead_crop": return "farmstead_crop";
  }
}

function siteOf(state: GameState, action: TownAction): { readonly tx: number; readonly ty: number } {
  switch (action.kind) {
    case "place_building": return { tx: action.tx, ty: action.ty };
    case "place_road": return action.from;
    case "paint_zone": { const point = action.stroke.points[0]; return point === undefined ? { tx: 0, ty: 0 } : { tx: Math.floor(point.x), ty: Math.floor(point.y) }; }
    default: {
      const building = state.buildings.find(entry => entry.id === action.buildingId);
      return building === undefined ? { tx: 0, ty: 0 } : { tx: building.tx, ty: building.ty };
    }
  }
}

function actorOf(state: GameState, action: TownAction): ActorKind {
  if (action.kind === "place_road") return "community";
  if (action.kind !== "place_building") return "households";
  const builder = builderOfKind(action.building);
  return builder === "guild" && state.reorganisation?.guild === undefined ? "merchants" : builder;
}

function costOf(action: TownAction): number {
  if (action.kind === "place_building") {
    return Object.entries(BUILDING_CONFIG_BY_KIND[action.building].buildCost)
      .reduce((sum, [resource, amount]) => sum + (amount ?? 0) * (MATERIAL_PENNIES[resource] ?? 0), 0);
  }
  if (action.kind === "place_road") return (Math.abs(action.to.tx - action.from.tx) + Math.abs(action.to.ty - action.from.ty) + 1) * ROAD_TILE_PENNIES;
  return 0;
}

const FACTION_OF_ACTOR: Readonly<Record<ActorKind, string>> = {
  households: "commons", merchants: "merchant_house_1", guild: "merchant_house_2", community: "town", church: "bishop",
};

function roadDistance(state: GameState, tx: number, ty: number): number {
  let best = 99;
  for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) {
    const x = tx + dx, y = ty + dy;
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) continue;
    if (state.tiles[y * state.width + x]?.hasRoad === true) best = Math.min(best, Math.abs(dx) + Math.abs(dy));
  }
  return best;
}

/**
 * TA-4 policy: the policy's weight on the kind; a burgage plot to fill takes the policy's `fill_plot` too; an
 * opportunity (no need behind it) takes the weight twice — the policy is why the actor builds it at all.
 */
function policyPoints(policy: EstatePolicy, key: string, rank: number | null): number {
  const weight = policyWeight(policy, key);
  if (rank === null) return weight * OPPORTUNITY_POLICY_FACTOR;
  return weight + (rank < -1 ? policyWeight(policy, "fill_plot") : 0);
}

/** TA-10: the town's centre — its first market, else the middle of its houses; null with neither. */
export function townCentre(state: GameState): { readonly tx: number; readonly ty: number } | null {
  const market = state.buildings.find(building => building.kind === "market");
  if (market !== undefined) return { tx: market.tx, ty: market.ty };
  const houses = state.buildings.filter(building => building.kind === "house");
  if (houses.length === 0) return null;
  return { tx: Math.round(houses.reduce((sum, house) => sum + house.tx, 0) / houses.length),
    ty: Math.round(houses.reduce((sum, house) => sum + house.ty, 0) / houses.length) };
}

/**
 * TA-4, TA-10: the reasons a building's site gives — the road's reach (`access`), the land's worth near the centre
 * (`land`: a home or shop gains, a workshop pays), the fire risk among houses (`risk`), and the plan's own site (`plan`).
 */
function siteReasons(state: GameState, kind: BuildingKind, site: { readonly tx: number; readonly ty: number },
  planSite: { readonly tx: number; readonly ty: number }, centre: { readonly tx: number; readonly ty: number } | null): Reason[] {
  const reasons: Reason[] = [];
  const add = (name: Reason["name"], value: number) => { const rounded = Math.round(value); if (rounded !== 0) reasons.push({ name, value: rounded }); };
  const distance = roadDistance(state, site.tx, site.ty);
  add("access", distance <= 1 ? 5 : -Math.min(10, distance));
  if (centre !== null) {
    const points = Math.floor(Math.max(0, LAND_REACH - Math.abs(site.tx - centre.tx) - Math.abs(site.ty - centre.ty)) / LAND_STEP);
    add("land", CENTRE_KINDS.includes(kind) ? points : -points);
  }
  if (kind === "house") {
    const near = state.buildings.filter(building => building.kind === "house" && !(building.tx === site.tx && building.ty === site.ty)
      && Math.abs(building.tx - site.tx) <= 2 && Math.abs(building.ty - site.ty) <= 2).length;
    add("risk", -near * FIRE_NEIGHBOUR_POINTS);
  }
  if (site.tx === planSite.tx && site.ty === planSite.ty) add("plan", PLAN_SITE_POINTS);
  return reasons;
}

/**
 * TA-10: a building project's candidate sites — the plan's own and up to four others within `SITE_SEARCH_RADIUS`,
 * those with the best site reasons first, each through the plan's whole check (`townSiteRefusal`: the wall and plot
 * rules, placement, service space, the road's room). A burgage house's others are the next plots the zone fills.
 */
function candidateSites(state: GameState, kind: BuildingKind, planSite: { readonly tx: number; readonly ty: number },
  planner: string, centre: { readonly tx: number; readonly ty: number } | null, policy: AutoplayPolicy): readonly { readonly tx: number; readonly ty: number; readonly reasons: readonly Reason[] }[] {
  const plan = { ...planSite, reasons: siteReasons(state, kind, planSite, planSite, centre) };
  const sites: { tx: number; ty: number; reasons: Reason[]; total: number }[] = [];
  const seek = planner === "fill_plot" ? planZoneFill(state).placements.slice(1).map(placement => placement.tile) : null;
  const around = (): { tx: number; ty: number }[] => {
    const tiles: { tx: number; ty: number }[] = [];
    for (let dy = -SITE_SEARCH_RADIUS; dy <= SITE_SEARCH_RADIUS; dy += 1) for (let dx = -SITE_SEARCH_RADIUS; dx <= SITE_SEARCH_RADIUS; dx += 1) {
      const tx = planSite.tx + dx, ty = planSite.ty + dy;
      if ((dx !== 0 || dy !== 0) && tx > 0 && ty > 0 && tx < state.width - 1 && ty < state.height - 1) tiles.push({ tx, ty });
    }
    return tiles;
  };
  for (const site of seek ?? around()) {
    if (!hasAutoplayBuildingClearance(state, kind, site) || !autoplayCanPlace(state, kind, site.tx, site.ty)) continue;
    const reasons = siteReasons(state, kind, site, planSite, centre);
    sites.push({ ...site, reasons, total: scoreOf(reasons) });
  }
  sites.sort((left, right) => right.total - left.total || left.ty - right.ty || left.tx - right.tx);
  const passed: { tx: number; ty: number; reasons: readonly Reason[] }[] = [];
  resetAutoplayServiceSearch();
  runAutoplaySearch(() => {
    for (const site of sites.slice(0, SITE_FULL_CHECKS_MAX)) {
      if (passed.length >= SITE_CANDIDATES_MAX - 1) break;
      if (seek !== null || townSiteRefusal(state, kind, site, planSite, policy) === null) passed.push(site);
    }
  });
  return [plan, ...passed];
}

/** TA-4: a proposal's named reasons that do not depend on its site (a building's site reasons come from `siteReasons`). */
function reasonsOf(state: GameState, agency: AgencyState, action: TownAction, actor: ActorKind, rank: number | null,
  stuckWheat: number, stuckRoads: number): { readonly reasons: readonly Reason[]; readonly subsidy: number; readonly cost: number } {
  const what = whatOf(action);
  const kind = action.kind === "place_building" ? action.building : null;
  const cost = costOf(action);
  const reasons: Reason[] = [];
  const add = (name: Reason["name"], value: number) => { const rounded = Math.round(value); if (rounded !== 0) reasons.push({ name, value: rounded }); };
  add("need", rank === null ? 0 : NEED_TOP - NEED_STEP * (rank + 3));
  const policyKey = kind ?? (action.kind === "place_road" ? "road" : action.kind === "paint_zone" ? "zone" : what);
  add("policy", policyPoints(agency.policy, policyKey, rank));
  const subsidy = kind === null ? 0 : agency.subsidies.filter(entry => entry.kind === kind).reduce((sum, entry) => sum + entry.amount, 0);
  add("subsidy", Math.min(60, Math.floor(subsidy / 10) * SUBSIDY_POINTS_PER_10D));
  if (actor === "merchants") add("dues", (1000 - agencyDuesPermille(state)) / 100 * DUES_POINTS_PER_100_PERMILLE);
  if (kind === "mill" || kind === "granary") add("stuck", Math.min(30, Math.floor(stuckWheat / 100) * STUCK_POINTS_PER_100));
  if (action.kind === "place_road") add("stuck", Math.min(20, stuckRoads * 10));
  const relation = state.factions?.factions.find(faction => faction.id === FACTION_OF_ACTOR[actor])?.relation ?? 0;
  add("relation", relation / 10);
  add("cost", -cost / 40);
  return { reasons, subsidy, cost };
}

const scoreOf = (reasons: readonly Reason[]) => reasons.reduce((sum, reason) => sum + reason.value, 0);

/** TA-3: this week's proposals, best first (the needs the bot's planning finds, and the opportunities). */
export function townProposals(state: GameState, policy: AutoplayPolicy = LORD_MODE_POLICY,
  needs: readonly PlanningNeed[] = planningNeeds(state, policy)): readonly Proposal[] {
  const agency = state.agency;
  if (agency === undefined) return [];
  const stuck = stuckStock(state);
  const stuckWheat = stuck.filter(entry => entry.resource === "wheat").reduce((sum, entry) => sum + entry.amount, 0);
  const stuckRoads = stuck.filter(entry => entry.reason === "no_road").length;
  const proposals: Proposal[] = [];
  const seen = new Set<string>();
  const centre = townCentre(state);
  const propose = (action: AdvisorAction, planner: string, rank: number | null) => {
    if (!isTownAction(action)) return;
    const site = siteOf(state, action);
    const key = `${whatOf(action)}@${site.tx},${site.ty}`;
    if (seen.has(key)) return;
    seen.add(key);
    const actor = actorOf(state, action);
    const scored = reasonsOf(state, agency, action, actor, rank, stuckWheat, stuckRoads);
    const base = scoreOf(scored.reasons);
    if (action.kind !== "place_building") {
      proposals.push({ actor, what: whatOf(action), planner, rank, action, tx: site.tx, ty: site.ty, reasons: scored.reasons,
        score: base, cost: scored.cost, subsidy: scored.subsidy });
      return;
    }
    // TA-10: the sites by their whole score (the plan's own on a tie). LM-E5 (LG-2): the actor draws one by chance —
    // mostly the best — and the best other stays on the receipt.
    const ranked = candidateSites(state, action.building, site, planner, centre, policy)
      .map((candidate, index) => ({ ...candidate, index, score: base + scoreOf(candidate.reasons) }))
      .sort((left, right) => right.score - left.score || left.index - right.index);
    const temperament = actorTemperament(state, actor);
    const drawn = drawByScore(state.seed, `agency-site:${key}:${state.tick}`, ranked.map(entry => entry.score),
      ranked.map(() => TEMPERAMENT_SPREAD[temperament]), temperament);
    const chosen = ranked[drawn.index]!;
    const next = ranked.find(entry => entry !== chosen);
    const sites: ReceiptSites = { count: ranked.length, planTx: site.tx, planTy: site.ty, reasons: chosen.reasons,
      runnerUp: next === undefined ? null : { tx: next.tx, ty: next.ty, reasons: next.reasons, score: next.score } };
    proposals.push({ actor, what: whatOf(action), planner, rank, action: { ...action, tx: chosen.tx, ty: chosen.ty }, tx: chosen.tx, ty: chosen.ty,
      reasons: [...scored.reasons, ...chosen.reasons], score: chosen.score, cost: scored.cost, subsidy: scored.subsidy, sites,
      ...(ranked.length > 1 ? { siteChance: drawn.chance } : {}) });
  };
  for (const need of needs) propose(need.action, need.planner, need.rank);
  // TA-3: the opportunities — a subsidised or policy-backed kind no need asks for, at its first legal site, while the
  // town has no more of it than one per four houses (so one more than that at most).
  const houses = state.houses.length;
  for (const kind of OPPORTUNITY_KINDS) {
    const backed = agency.subsidies.some(subsidy => subsidy.kind === kind) || policyWeight(agency.policy, kind) >= 20;
    if (!backed || proposals.some(proposal => proposal.what === kind)) continue;
    const count = state.buildings.filter(building => building.kind === kind).length
      + state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === kind).length;
    if (count > Math.floor(houses / 4)) continue;
    propose(autoplayBuildAction(state, kind) as AdvisorAction, "opportunity", null);
  }
  return proposals.sort((left, right) => right.score - left.score || left.what.localeCompare(right.what) || left.tx - right.tx || left.ty - right.ty);
}

/** TA-7: what the town asks of its lord — the era's proclamation, the wall's priority, the traders' timber. */
const LORD_REQUEST_KINDS: ReadonlySet<string> = new Set(["proclaim_era", "set_wall_construction_priority", "order_timber"]);

// --- TA-5 starting a project ---------------------------------------------------------------------------------------

/** TA-5: a project still passes the plan's checks on the town as it now stands (another project was started this week). */
function stillFits(state: GameState, proposal: Proposal): boolean {
  const action = proposal.action;
  if (action.kind !== "place_building" && action.kind !== "place_road") return true;
  resetAutoplayServiceSearch();
  return runAutoplaySearch(() => action.kind === "place_building"
    ? townSiteRefusal(state, action.building, action, { tx: proposal.sites?.planTx ?? action.tx, ty: proposal.sites?.planTy ?? action.ty }, LORD_MODE_POLICY) === null
    : preservesAutoplayServiceSpace(state, action) && keepsInteriorHouseSites(state, action, LORD_MODE_POLICY.maxHousingLots));
}

/** TA-5: applies a town project through the same engine steps the player's command takes (the bot's bookkeeping too). */
export function applyTownAction(state: GameState, action: TownAction): GameState {
  let next: GameState;
  switch (action.kind) {
    case "place_building": {
      next = recordMaterialPlacement(state, placeBuilding(state, action.building, { tx: action.tx, ty: action.ty }), action.materialRecovery);
      if (next !== state && (action.building === "granary" || action.building === "mill")) {
        const targets = action.building === "granary" ? granaryCoverageTargetIds(state, action) : [];
        next = { ...next, autoplayFoodObservation: { kind: action.building, siteId: constructionSiteId(state.nextConstructionOrdinal),
          placedTick: state.tick, ...(targets.length > 0 ? { targetHouseIds: targets } : {}) } };
      }
      break;
    }
    case "place_road": next = placeRoadLine(state, action.from, action.to); break;
    case "paint_zone": next = paintZone(state, action.zone, action.stroke); break;
    case "demolish_house": next = demolishHouse(state, action.buildingId); break;
    case "rebuild_house": next = rebuildBurntHouse(state, action.buildingId); break;
    case "set_farmstead_crop": next = setFarmsteadCrop(state, action.buildingId, action.crop); break;
  }
  if (next === state || action.foodTransient === undefined) return next;
  const { autoplayFoodTransientConfirmation: _confirmation, ...rest } = next;
  return action.foodTransient === null ? rest : { ...rest, autoplayFoodTransientConfirmation: action.foodTransient };
}

/** TA-6: the lord's decisions in force behind a project — the latest policy, the dues, and its kind's subsidy. */
function lordDecisionIds(state: GameState, what: string, reasons: readonly Reason[]): readonly string[] {
  const records = state.history?.records ?? [];
  const latest = (test: (params: Readonly<Record<string, string | number>>) => boolean) => {
    for (let index = records.length - 1; index >= 0; index -= 1) {
      const record = records[index]!;
      if (record.kind === "decision" && test(record.params ?? {})) return record.id;
    }
    return undefined;
  };
  const ids: string[] = [];
  const moved = new Set(reasons.map(reason => reason.name));
  const policy = moved.has("policy") ? latest(params => params.decisionKind === "estate_policy") : undefined;
  const dues = moved.has("dues") ? latest(params => params.decisionKind === "market_dues") : undefined;
  const subsidy = moved.has("subsidy") ? latest(params => params.decisionKind === "project_subsidy" && params.kind === what) : undefined;
  for (const id of [policy, dues, subsidy]) if (id !== undefined) ids.push(id);
  return ids;
}

/** TA-5: the five largest reasons by size (ties in the reasons' order). */
function topReasons(reasons: readonly Reason[]): readonly Reason[] {
  return [...reasons].sort((left, right) => Math.abs(right.value) - Math.abs(left.value)
    || REASON_ORDER.indexOf(left.name) - REASON_ORDER.indexOf(right.name)).slice(0, 5);
}

/** The bot's planning policy in lord mode (the campaign's town of 24 lots). */
// The campaign's town of 24 lots (the bot's default is 8, the guardrail's and campaign's target 24).
export const LORD_MODE_POLICY: AutoplayPolicy = { maxHousingLots: 24 };

/**
 * TA-11: the town's layout as the charter's wall search reads it — the era and chapter, what stands and what is being
 * built, the roads, the zones' cells, the wall, the burnt houses, and the houses' lots.
 */
export function needsLayoutKey(state: GameState): string {
  let roads = 0;
  for (const tile of state.tiles) if (tile.hasRoad) roads += 1;
  return JSON.stringify([state.era, state.politics?.chapter.number ?? 1, state.buildings.map(building => building.id),
    state.constructionSites.map(site => site.id), roads, (state.zones ?? []).map(zone => [zone.id, zone.membership.length]),
    state.palisade?.polygon.length ?? 0, state.houses.filter(house => house.burntTick !== undefined).map(house => house.buildingId),
    housingLotCount(state)]);
}

/**
 * TA-13: what a reused walk must still match — the layout (`needsLayoutKey`), the lord's policy, subsidies and market
 * dues, and the households living in the town. Food, money and labour enter through the season's limit and the fund
 * threshold (spec docs/design/town-agency.md TA-13).
 */
export function walkKey(state: GameState): string {
  const agency = state.agency;
  const households = state.houses.filter(house => house.residents > 0 && house.abandonedTick === undefined).length;
  return JSON.stringify([needsLayoutKey(state), agency?.policy ?? "", (agency?.subsidies ?? []).map(subsidy => `${subsidy.kind}:${subsidy.amount}`),
    agency?.duesPermille ?? 1000, households]);
}

/**
 * TA-11: the charter's wall search, when it runs — a hamlet that meets the market town's requirements with no building
 * site open (the bot's era step then projects walls and their service space, the costliest step of the walk).
 */
function charterSearchRuns(state: GameState): boolean {
  return canProclaimPalisadeEra(state) && state.population >= CHARTER_POPULATION && !state.constructionSites.some(isBuildingConstructionSite);
}

/** TA-2…TA-5: one week of the town agency, at the week's first tick (nothing outside lord mode). */
/**
 * LM-E5 (LG-2): the week's startable proposals (score at least START_SCORE) in the order chance draws them — each draw
 * among those left, each proposal weighted by its own actor's temperament — with each one's chance when drawn.
 */
function chanceOrder(state: GameState, proposals: readonly Proposal[]): readonly { readonly proposal: Proposal; readonly chance: ChoiceChance }[] {
  const left = proposals.filter(proposal => proposal.score >= START_SCORE);
  const order: { proposal: Proposal; chance: ChoiceChance }[] = [];
  while (left.length > 0) {
    const temperaments = left.map(proposal => actorTemperament(state, proposal.actor));
    const drawn = drawByScore(state.seed, `agency-pick:${state.tick}:${order.length}`, left.map(proposal => proposal.score),
      temperaments.map(temperament => TEMPERAMENT_SPREAD[temperament]), temperaments[0]!);
    order.push({ proposal: left[drawn.index]!, chance: { ...drawn.chance, temperament: temperaments[drawn.index]! } });
    left.splice(drawn.index, 1);
  }
  return order;
}

export function advanceTownAgency(state: GameState): GameState {
  const agency = state.agency;
  if (agency === undefined || state.tick <= 0 || state.tick % AGENCY_WEEK_TICKS !== 0) return state;
  const actors: AgencyActor[] = agency.actors.map(actor => ({ ...actor, funds: actor.funds + weeklySavings(state, actor.kind) }));
  // TA-12: a hamlet ready for its market charter holds new buildings until its sites are done, so the bot's era step
  // (which proclaims only with no building site open) can ask the lord; at most `CHARTER_HOLD_WEEKS`, then it builds on.
  const ready = canProclaimPalisadeEra(state) && state.population >= CHARTER_POPULATION;
  const charterSince = ready ? agency.charterSince ?? state.tick : undefined;
  const holding = charterSince !== undefined && state.tick - charterSince < CHARTER_HOLD_WEEKS * AGENCY_WEEK_TICKS;
  const { charterSince: _since, ...rest } = agency;
  const week: GameState = { ...state, agency: { ...rest, actors, ...(charterSince === undefined ? {} : { charterSince }) } };
  const open = (current: GameState) => current.constructionSites.filter(site => isBuildingConstructionSite(site)).length;
  // LM-E1b (TA-11): a town with every site busy starts nothing — no walk; its request is only the wall's priority when
  // the reserve locks the work (`planningEarlyNeeds`). Otherwise the week's one walk gives the needs and the requests.
  if (open(week) >= OPEN_SITES_MAX) {
    const requests = planningEarlyNeeds(week, LORD_MODE_POLICY).map(need => need.action as LordRequest);
    return { ...week, agency: { ...week.agency!, requests } };
  }
  // TA-11: a charter wall search that found no wall is not run again on the same layout (the walls and their service
  // space are read from it); any change to the layout searches again.
  // TA-13 (LM-E9b): in a full town (its housing lots all built), after a week that started nothing, on the same layout
  // and the lord's same conditions, within a season of the walk and below its fund threshold, a week reuses that walk.
  const key = walkKey(week);
  const last = agency.lastWalk;
  const full = week.houses.length >= LORD_MODE_POLICY.maxHousingLots;
  const reused = full && last !== undefined && last.idleWeeks >= WALK_REUSE_IDLE_WEEKS && last.key === key && week.tick - last.tick < WALK_REUSE_TICKS
    && (last.fundThreshold === null || treasuryBalance(week) < last.fundThreshold) ? last : undefined;
  let needs: readonly PlanningNeed[];
  let tried: string | undefined;
  if (reused !== undefined) {
    needs = reused.needs;
    tried = reused.charterWallTried;
  } else {
    const searching = charterSearchRuns(week);
    const layout = searching ? needsLayoutKey(week) : undefined;
    const skipEra = layout !== undefined && agency.charterWallTried === layout;
    needs = planningNeeds(week, LORD_MODE_POLICY, skipEra ? ["era"] : []);
    tried = searching && (skipEra || !needs.some(need => need.action.kind === "proclaim_era")) ? layout : undefined;
  }
  // FIX-14 (decision FX13-5, the user's (가)): the charter's timber the town's own stores cannot reach — the town orders
  // it from the market's traders itself (FIX-10's standing order); it is not the lord's to grant.
  const charterTimber = needs.find(need => need.planner === "era" && need.action.kind === "order_timber");
  const requests = needs.filter(need => LORD_REQUEST_KINDS.has(need.action.kind) && need !== charterTimber).map(need => need.action as LordRequest);
  let next: GameState = { ...week, agency: { ...week.agency!, requests } };
  if (charterTimber !== undefined && charterTimber.action.kind === "order_timber" && (next.timberOrder ?? 0) === 0) next = orderTimber(next, charterTimber.action.amount);
  const receipts: ProjectReceipt[] = [];
  let started = 0;
  let ordinal = agency.nextReceipt;
  const proposals = reused?.proposals ?? townProposals(next, LORD_MODE_POLICY, needs);
  for (const { proposal, chance } of chanceOrder(next, proposals)) {
    if (started >= STARTS_PER_WEEK || open(next) >= OPEN_SITES_MAX) break;
    if (holding && proposal.action.kind === "place_building") continue;
    // TA-5: the week's second project is checked again on the town the first one left — the bot places one at a time,
    // each against the last (two sites each keeping the service space alone took it together: no charter wall fitted).
    if (started > 0 && !stillFits(next, proposal)) continue;
    const actor = actors.find(entry => entry.kind === proposal.actor)!;
    const paid = Math.min(proposal.subsidy, Math.max(0, treasuryBalance(next)));
    // TA-5: a needed project the actor cannot pay borrows the rest from the community's purse (when that is another's).
    const short = Math.max(0, proposal.cost - actor.funds - paid);
    const need = proposal.reasons.find(reason => reason.name === "need")?.value ?? 0;
    const community = actors.find(entry => entry.kind === "community")!;
    const loan = short > 0 && need >= LOAN_NEED && actor !== community && community.funds >= short ? short : 0;
    if (short > loan) continue;
    const siteId = proposal.action.kind === "place_building" ? constructionSiteId(next.nextConstructionOrdinal) : null;
    const after = applyTownAction(next, proposal.action);
    if (after === next) continue;
    actors[actors.indexOf(actor)] = { ...actor, funds: actor.funds + paid + loan - proposal.cost };
    if (loan > 0) actors[actors.indexOf(community)] = { ...community, funds: community.funds - loan };
    next = after;
    if (paid > 0) {
      const posted = postLedgerEntries(next, [{ account: "cash", category: "project_subsidy", amount: -paid,
        sourceRefs: [{ type: "actor", id: FACTION_OF_ACTOR[proposal.actor] }, { type: "claim", id: "project_subsidy", detail: proposal.what }] }]);
      next = { ...next, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
    }
    const reasons = topReasons(proposal.reasons);
    receipts.push({ id: `receipt-${ordinal}`, tick: next.tick, actor: proposal.actor, what: proposal.what, tx: proposal.tx, ty: proposal.ty, siteId,
      planner: proposal.planner, rank: proposal.rank, reasons, score: proposal.score, cost: proposal.cost, subsidy: paid, loan,
      decisionIds: lordDecisionIds(next, proposal.what, proposal.reasons), ...(proposal.sites === undefined ? {} : { sites: proposal.sites }),
      chance: { project: chance, ...(proposal.siteChance === undefined ? {} : { site: proposal.siteChance }) },
      ...(reused === undefined ? {} : { reusedWalk: reused.tick }) });
    ordinal += 1;
    started += 1;
  }
  const kept = [...agency.receipts, ...receipts];
  const trimmed = kept.length <= RECEIPTS_KEPT ? kept
    : kept.filter((receipt, index) => receipt.what !== "road" || index >= kept.length - RECEIPTS_KEPT).slice(-RECEIPTS_KEPT);
  const { charterWallTried: _tried, lastWalk: _walk, ...kept2 } = next.agency!;
  // TA-13: the walk is kept only while it starts nothing (a reused one keeps its own tick, key and threshold).
  const treasury = treasuryBalance(week);
  const short = proposals.filter(proposal => proposal.subsidy > treasury).map(proposal => proposal.subsidy);
  const idleWeeks = (last?.idleWeeks ?? 0) + 1;
  const lastWalk: AgencyWalk | undefined = started > 0 ? undefined : reused !== undefined ? { ...reused, idleWeeks }
    : { tick: week.tick, key, needs, proposals, requests, fundThreshold: short.length === 0 ? null : Math.min(...short),
      ...(tried === undefined ? {} : { charterWallTried: tried }), idleWeeks };
  return { ...next, agency: { ...kept2, actors, receipts: trimmed, nextReceipt: ordinal, ...(tried === undefined ? {} : { charterWallTried: tried }),
    ...(lastWalk === undefined ? {} : { lastWalk }) } };
}

/** TA-7 API: what the town asks of its lord this week — the era's proclamation, the wall's priority, the traders'
 * timber (the bot's planning steps that are the lord's to grant), found by the week's walk of the priority list
 * (TA-11: kept in the state, not walked again — the second walk was half of a lord-mode run's time). */
export function lordRequests(state: GameState): readonly AdvisorAction[] {
  return state.agency?.requests ?? [];
}

// --- TA-5 why here? -----------------------------------------------------------------------------------------------------

/** TA-5 API: the receipt of a building (by its id), a construction site (by its id) or a tile — why it stands there. */
export function whyHere(state: GameState, id: string): ProjectReceipt | null {
  const receipts = state.agency?.receipts ?? [];
  const bySite = receipts.find(receipt => receipt.siteId === id);
  if (bySite !== undefined) return bySite;
  const building = state.buildings.find(entry => entry.id === id);
  if (building === undefined) return null;
  for (let index = receipts.length - 1; index >= 0; index -= 1) {
    const receipt = receipts[index]!;
    if (receipt.what === building.kind && receipt.tx === building.tx && receipt.ty === building.ty) return receipt;
  }
  return null;
}

// --- TA-9 the receipts' audit ------------------------------------------------------------------------------------------

/**
 * TA-9 API: recomputes a receipt's reasons from the state of the tick it was written (the week's step), each by its own
 * reading of the state — the need from its planning step's rank, the policy's weight, the subsidy in force, the road
 * distance, the neighbouring houses, the faction's relation, the materials' cost — and lists what does not match.
 */
export function auditReceipt(state: GameState, receipt: ProjectReceipt): readonly string[] {
  const rank = receipt.rank;
  const agency = state.agency;
  if (agency === undefined) return ["no agency"];
  const expected = new Map<string, number>();
  const kind = receipt.what in BUILDING_CONFIG_BY_KIND ? receipt.what as BuildingKind : null;
  expected.set("need", rank === null ? 0 : NEED_TOP - NEED_STEP * (rank + 3));
  const key = kind ?? (receipt.what === "road" ? "road" : receipt.what.startsWith("zone:") ? "zone" : receipt.what);
  expected.set("policy", policyPoints(agency.policy, key, rank));
  const subsidy = kind === null ? 0 : agency.subsidies.filter(entry => entry.kind === kind).reduce((sum, entry) => sum + entry.amount, 0);
  expected.set("subsidy", Math.min(60, Math.floor(subsidy / 10) * SUBSIDY_POINTS_PER_10D));
  if (receipt.actor === "merchants") expected.set("dues", Math.round((1000 - agencyDuesPermille(state)) / 100 * DUES_POINTS_PER_100_PERMILLE));
  const centre = townCentre(state);
  const planSite = receipt.sites === undefined ? { tx: receipt.tx, ty: receipt.ty } : { tx: receipt.sites.planTx, ty: receipt.sites.planTy };
  if (kind !== null) {
    // TA-10: the site's reasons (access, land, risk, plan) by the same reading of the state.
    for (const reason of siteReasons(state, kind, receipt, planSite, centre)) expected.set(reason.name, reason.value);
    const cost = Object.entries(BUILDING_CONFIG_BY_KIND[kind].buildCost).reduce((sum, [resource, amount]) => sum + (amount ?? 0) * (MATERIAL_PENNIES[resource] ?? 0), 0);
    expected.set("cost", Math.round(-cost / 40));
  }
  // A road's length is not on its receipt: its cost reason is read from the receipt's pennies.
  if (receipt.what === "road") expected.set("cost", Math.round(-receipt.cost / 40));
  const stuck = stuckStock(state);
  if (kind === "mill" || kind === "granary") {
    const wheat = stuck.filter(entry => entry.resource === "wheat").reduce((sum, entry) => sum + entry.amount, 0);
    expected.set("stuck", Math.min(30, Math.floor(wheat / 100) * STUCK_POINTS_PER_100));
  }
  if (receipt.what === "road") expected.set("stuck", Math.min(20, stuck.filter(entry => entry.reason === "no_road").length * 10));
  expected.set("relation", Math.round((state.factions?.factions.find(faction => faction.id === FACTION_OF_ACTOR[receipt.actor])?.relation ?? 0) / 10));
  const mismatches: string[] = [];
  for (const reason of receipt.reasons) {
    const want = expected.get(reason.name);
    if (want === undefined) { mismatches.push(`${reason.name}: not recomputed`); continue; }
    if (want !== reason.value) mismatches.push(`${reason.name}: receipt ${reason.value}, state ${want}`);
  }
  // TA-10: the chosen site's and the next best's site reasons, read again from the state, and the gap between their
  // scores (the two share every other reason, so the gap is their site reasons' difference).
  const sites = receipt.sites;
  if (sites !== undefined && kind !== null) {
    const same = (left: readonly Reason[], right: readonly Reason[]) => JSON.stringify(left) === JSON.stringify(right);
    if (!same(sites.reasons, siteReasons(state, kind, receipt, planSite, centre))) mismatches.push("sites: the chosen site's reasons");
    const next = sites.runnerUp;
    if (next !== null) {
      if (!same(next.reasons, siteReasons(state, kind, next, planSite, centre))) mismatches.push("sites: the next site's reasons");
      if (receipt.score - next.score !== scoreOf(sites.reasons) - scoreOf(next.reasons)) mismatches.push("sites: the gap to the next site");
      // LM-E5 (LG-2): a site drawn by chance below the best keeps the best as its next; only a best draw must lead it.
      const drawnBelow = (receipt.chance?.site?.place ?? 1) > 1;
      if (next.score > receipt.score && !drawnBelow) mismatches.push("sites: the next site scored higher");
      if (drawnBelow && next.score < receipt.score) mismatches.push("sites: a site drawn below the best keeps the best as its next");
    }
  }
  return mismatches;
}
