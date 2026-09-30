/**
 * LM-E1 (spec docs/design/town-agency.md TA-1…TA-9): lord mode's town agency. Each week the town's actors — the
 * households, the merchant families, the guild, the community, the church — save, propose the projects the town needs
 * (the bot's planning steps, read as needs) and the ones the lord's conditions make worth it, score each by named
 * reasons, and start the best they can pay for. Every start leaves a receipt: who, what, where, its five largest
 * reasons and the lord's decisions behind them. With no `state.agency` (sandbox, campaign) nothing here runs.
 */
import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";
import {
  ACTOR_OPENING_FUNDS, ACTOR_WEEKLY, AGENCY_ACTORS, AGENCY_WEEK_TICKS, BUILDER_OF_KIND, DUES_POINTS_PER_100_PERMILLE,
  FIRE_NEIGHBOUR_POINTS, MATERIAL_PENNIES, NEED_STEP, NEED_TOP, OPEN_SITES_MAX, OPPORTUNITY_KINDS, POLICY_WEIGHTS,
  LOAN_NEED, REASON_ORDER, RECEIPTS_KEPT, ROAD_TILE_PENNIES, START_SCORE, STARTS_PER_WEEK, STUCK_POINTS_PER_100, SUBSIDY_POINTS_PER_10D,
} from "../content/townAgencyConfig";
import { constructionSiteId, isBuildingConstructionSite } from "../economy/construction";
import { postLedgerEntries, treasuryBalance } from "../ledger/ledger";
import { paintZone } from "../zones/zoneEdits";
import { setFarmsteadCrop } from "./ale";
import { autoplayBuildAction, planningNeeds, type AutoplayPolicy, type PlanningNeed } from "./autoplay";
import type { AdvisorAction } from "./autoplayBotRecovery";
import { granaryCoverageTargetIds } from "./autoplayFoodCoverage";
import { recordMaterialPlacement } from "./autoplayMaterialLifecycle";
import type { GameState } from "./engine.types";
import { rebuildBurntHouse } from "./fire";
import { placeBuilding, placeRoadLine } from "./gameActions";
import { demolishHouse } from "./houseDemolition";
import { marketStalls } from "./moneyRules";
import { stuckStock } from "./stuckStock";
import { agencyDuesPermille } from "./townAgencyDues";
import type {
  ActorKind, AgencyActor, AgencyState, EstatePolicy, ProjectReceipt, ProjectSubsidy, Reason,
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

/** TA-6 ②: `amount` 0 withdraws the subsidy on that kind. */
export function setProjectSubsidy(state: GameState, kind: BuildingKind, amount: number): GameState {
  const agency = state.agency;
  if (agency === undefined || !Number.isInteger(amount) || amount < 0) return state;
  const others = agency.subsidies.filter(subsidy => subsidy.kind !== kind);
  if (amount === 0) return others.length === agency.subsidies.length ? state : { ...state, agency: { ...agency, subsidies: others } };
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
  const builder = BUILDER_OF_KIND[action.building];
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

/** TA-4: a proposal's named reasons. */
function reasonsOf(state: GameState, agency: AgencyState, action: TownAction, actor: ActorKind, rank: number | null,
  stuckWheat: number, stuckRoads: number): { readonly reasons: readonly Reason[]; readonly subsidy: number; readonly cost: number } {
  const what = whatOf(action);
  const kind = action.kind === "place_building" ? action.building : null;
  const site = siteOf(state, action);
  const cost = costOf(action);
  const reasons: Reason[] = [];
  const add = (name: Reason["name"], value: number) => { if (value !== 0) reasons.push({ name, value: Math.round(value) }); };
  add("need", rank === null ? 0 : NEED_TOP - NEED_STEP * (rank + 3));
  const policyKey = kind ?? (action.kind === "place_road" ? "road" : action.kind === "paint_zone" ? "zone" : what);
  add("policy", (POLICY_WEIGHTS[agency.policy][policyKey] ?? 0) + (rank !== null && rank < -1 ? POLICY_WEIGHTS[agency.policy].fill_plot ?? 0 : 0));
  const subsidy = kind === null ? 0 : agency.subsidies.filter(entry => entry.kind === kind).reduce((sum, entry) => sum + entry.amount, 0);
  add("subsidy", Math.min(60, Math.floor(subsidy / 10) * SUBSIDY_POINTS_PER_10D));
  if (actor === "merchants") add("dues", (1000 - agencyDuesPermille(state)) / 100 * DUES_POINTS_PER_100_PERMILLE);
  if (kind === "mill" || kind === "granary") add("stuck", Math.min(30, Math.floor(stuckWheat / 100) * STUCK_POINTS_PER_100));
  if (action.kind === "place_road") add("stuck", Math.min(20, stuckRoads * 10));
  if (action.kind === "place_building") {
    const distance = roadDistance(state, site.tx, site.ty);
    add("access", distance <= 1 ? 5 : -Math.min(10, distance));
  }
  if (kind === "house") {
    const near = state.buildings.filter(building => building.kind === "house" && Math.abs(building.tx - site.tx) <= 2 && Math.abs(building.ty - site.ty) <= 2).length;
    add("risk", -near * FIRE_NEIGHBOUR_POINTS);
  }
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
  const propose = (action: AdvisorAction, planner: string, rank: number | null) => {
    if (!isTownAction(action)) return;
    const site = siteOf(state, action);
    const key = `${whatOf(action)}@${site.tx},${site.ty}`;
    if (seen.has(key)) return;
    seen.add(key);
    const actor = actorOf(state, action);
    const scored = reasonsOf(state, agency, action, actor, rank, stuckWheat, stuckRoads);
    proposals.push({ actor, what: whatOf(action), planner, rank, action, tx: site.tx, ty: site.ty, reasons: scored.reasons,
      score: scoreOf(scored.reasons), cost: scored.cost, subsidy: scored.subsidy });
  };
  for (const need of needs) propose(need.action, need.planner, need.rank);
  // TA-3: the opportunities — a subsidised or policy-backed kind no need asks for, at its first legal site, while the
  // town has no more of it than one per four houses (so one more than that at most).
  const houses = state.houses.length;
  for (const kind of OPPORTUNITY_KINDS) {
    const backed = agency.subsidies.some(subsidy => subsidy.kind === kind) || (POLICY_WEIGHTS[agency.policy][kind] ?? 0) >= 20;
    if (!backed || proposals.some(proposal => proposal.what === kind)) continue;
    const count = state.buildings.filter(building => building.kind === kind).length
      + state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === kind).length;
    if (count > Math.floor(houses / 4)) continue;
    propose(autoplayBuildAction(state, kind) as AdvisorAction, "opportunity", null);
  }
  return proposals.sort((left, right) => right.score - left.score || left.what.localeCompare(right.what) || left.tx - right.tx || left.ty - right.ty);
}

// --- TA-5 starting a project ---------------------------------------------------------------------------------------

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

/** TA-2…TA-5: one week of the town agency, at the week's first tick (nothing outside lord mode). */
export function advanceTownAgency(state: GameState): GameState {
  const agency = state.agency;
  if (agency === undefined || state.tick <= 0 || state.tick % AGENCY_WEEK_TICKS !== 0) return state;
  const actors: AgencyActor[] = agency.actors.map(actor => ({ ...actor, funds: actor.funds + weeklySavings(state, actor.kind) }));
  let next: GameState = { ...state, agency: { ...agency, actors } };
  const open = () => next.constructionSites.filter(site => isBuildingConstructionSite(site)).length;
  if (open() >= OPEN_SITES_MAX) return next;
  const receipts: ProjectReceipt[] = [];
  let started = 0;
  let ordinal = agency.nextReceipt;
  const needs = planningNeeds(next, LORD_MODE_POLICY);
  const requests = needs.filter(need => LORD_REQUEST_KINDS.has(need.action.kind)).map(need => need.action);
  for (const proposal of townProposals(next, LORD_MODE_POLICY, needs)) {
    if (started >= STARTS_PER_WEEK || open() >= OPEN_SITES_MAX) break;
    if (proposal.score < START_SCORE) break;
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
      decisionIds: lordDecisionIds(next, proposal.what, proposal.reasons) });
    ordinal += 1;
    started += 1;
  }
  const kept = [...agency.receipts, ...receipts];
  const trimmed = kept.length <= RECEIPTS_KEPT ? kept
    : kept.filter((receipt, index) => receipt.what !== "road" || index >= kept.length - RECEIPTS_KEPT).slice(-RECEIPTS_KEPT);
  const result: AgencyState = { ...next.agency!, actors, receipts: trimmed, nextReceipt: ordinal };
  lordRequestsByAgency.set(result, requests);
  return { ...next, agency: result };
}

/** TA-7: what the town asks of its lord this week — the era's proclamation, the wall's priority, the traders' timber. */
const LORD_REQUEST_KINDS: ReadonlySet<string> = new Set(["proclaim_era", "set_wall_construction_priority", "order_timber"]);
/**
 * TA-7: the requests the week's planning found, kept beside the agency the week wrote (a cache; the next week's agency
 * is a new object). Key: the `AgencyState` object (weak); only `advanceTownAgency` makes a new one, weekly, so the lord's
 * turns of the week read the same list. Without it (a loaded save), the planning runs again. Saves it an extra
 * `planningNeeds` a week.
 */
const lordRequestsByAgency = new WeakMap<AgencyState, readonly AdvisorAction[]>();

export function lordRequests(state: GameState): readonly AdvisorAction[] {
  const agency = state.agency;
  if (agency === undefined) return [];
  const cached = lordRequestsByAgency.get(agency);
  if (cached !== undefined) return cached;
  const requests = planningNeeds(state, LORD_MODE_POLICY).filter(need => LORD_REQUEST_KINDS.has(need.action.kind)).map(need => need.action);
  lordRequestsByAgency.set(agency, requests);
  return requests;
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
  expected.set("policy", (POLICY_WEIGHTS[agency.policy][key] ?? 0) + (rank !== null && rank < -1 ? POLICY_WEIGHTS[agency.policy].fill_plot ?? 0 : 0));
  const subsidy = kind === null ? 0 : agency.subsidies.filter(entry => entry.kind === kind).reduce((sum, entry) => sum + entry.amount, 0);
  expected.set("subsidy", Math.min(60, Math.floor(subsidy / 10) * SUBSIDY_POINTS_PER_10D));
  if (receipt.actor === "merchants") expected.set("dues", Math.round((1000 - agencyDuesPermille(state)) / 100 * DUES_POINTS_PER_100_PERMILLE));
  if (kind !== null) {
    const distance = roadDistance(state, receipt.tx, receipt.ty);
    expected.set("access", distance <= 1 ? 5 : -Math.min(10, distance));
    const cost = Object.entries(BUILDING_CONFIG_BY_KIND[kind].buildCost).reduce((sum, [resource, amount]) => sum + (amount ?? 0) * (MATERIAL_PENNIES[resource] ?? 0), 0);
    expected.set("cost", Math.round(-cost / 40));
  }
  if (kind === "house") {
    const near = state.buildings.filter(building => building.kind === "house" && !(building.tx === receipt.tx && building.ty === receipt.ty)
      && Math.abs(building.tx - receipt.tx) <= 2 && Math.abs(building.ty - receipt.ty) <= 2).length;
    expected.set("risk", -near * FIRE_NEIGHBOUR_POINTS);
  }
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
  return mismatches;
}
