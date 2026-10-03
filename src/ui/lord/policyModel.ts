import type { BuildingKind } from "../../content/buildingConfig";
import { BUILDING_COPY } from "../../content/buildingCatalog.ko";
import { DUES_POINTS_PER_100_PERMILLE, OPPORTUNITY_KINDS, POLICY_WEIGHTS, SUBSIDY_POINTS_PER_10D, SUBSIDY_TREASURY_PERMILLE } from "../../content/townAgencyConfig";
import type { GameState } from "../../engine/engine.types";
import { lordMode, subsidyRefusal } from "../../engine/townAgency";
import type { EstatePolicy } from "../../engine/townAgency.types";
import { treasuryBalance } from "../../ledger/ledger";
import { moneyFull } from "../money.ko";
import { POLICY_COPY as COPY } from "./policyCopy.ko";

// LM-R1 (TA-6): the lord's three conditions as the ledger drawer's lord tab shows them — the estate policy (what each
// favours, from POLICY_WEIGHTS), the subsidies offered against the quarter-of-the-treasury limit (the engine's own
// `subsidyRefusal`: a refused draft says why and its button stays shut), and the market dues with what they move.
// Lord mode only (null otherwise).

export const POLICIES: readonly EstatePolicy[] = ["growth", "revenue", "stability", "defence"];
/** The kinds a subsidy can back (the actors propose them as opportunities when a subsidy or the policy backs them). */
export const SUBSIDY_KINDS: readonly BuildingKind[] = OPPORTUNITY_KINDS;
export const SUBSIDY_STEP = 10;
export const DUES_STEP = 50;
export const DUES_MIN = 250;
export const DUES_MAX = 2000;

const projectName = (key: string): string => COPY.projects[key] ?? BUILDING_COPY[key as BuildingKind]?.name ?? key;

export type PolicyOption = Readonly<{ key: EstatePolicy; label: string; weights: string; chosen: boolean }>;
export type SubsidyRow = Readonly<{ kind: BuildingKind; name: string; amount: number; line: string }>;
export type SubsidyDraft = Readonly<{ kind: BuildingKind; amount: number; amountLine: string; points: string;
  /** The refusal's reason (TA-6 ②), or why there is nothing to set; null when it may be set. */
  blocked: string | null; refused: boolean; replaces: boolean }>;

export type PolicyView = Readonly<{
  policy: string; options: readonly PolicyOption[];
  subsidyRule: string; offered: string; subsidies: readonly SubsidyRow[]; lastRefusal: string | null;
  dues: Readonly<{ permille: number; now: string; lord: string; merchants: string; points: string; canLower: boolean; canRaise: boolean }>;
}>;

export function policyView(state: GameState): PolicyView | null {
  const agency = state.agency;
  if (!lordMode(state) || agency === undefined) return null;
  const treasury = treasuryBalance(state);
  const limit = Math.max(0, Math.floor(treasury * SUBSIDY_TREASURY_PERMILLE / 1000));
  const total = agency.subsidies.reduce((sum, subsidy) => sum + subsidy.amount, 0);
  const refusal = agency.lastRefusal;
  const dues = agency.duesPermille;
  return {
    policy: COPY.policyNow(COPY.policies[agency.policy]),
    options: POLICIES.map(key => ({ key, label: COPY.policies[key], chosen: key === agency.policy,
      weights: [...POLICY_WEIGHTS[key]].sort((left, right) => Math.abs(right[1]) - Math.abs(left[1])).slice(0, 4)
        .map(([name, points]) => COPY.weight(projectName(name), points)).join(" · ") })),
    subsidyRule: COPY.subsidyRule(moneyFull(limit), moneyFull(treasury)),
    offered: agency.subsidies.length === 0 ? COPY.subsidyNone : COPY.subsidyOffered(moneyFull(total)),
    subsidies: agency.subsidies.map(subsidy => ({ kind: subsidy.kind, name: projectName(subsidy.kind), amount: subsidy.amount,
      line: COPY.subsidyRow(projectName(subsidy.kind), moneyFull(subsidy.amount)) })),
    lastRefusal: refusal === undefined ? null
      : COPY.lastRefusal(projectName(refusal.kind), moneyFull(refusal.amount), moneyFull(refusal.total), moneyFull(refusal.limit)),
    dues: { permille: dues, now: COPY.duesNow(dues), lord: COPY.duesLord(dues), merchants: COPY.duesMerchants(dues),
      points: COPY.duesPoints(Math.round((1000 - dues) / 100 * DUES_POINTS_PER_100_PERMILLE)), canLower: dues > DUES_MIN, canRaise: dues < DUES_MAX },
  };
}

/** A subsidy the lord is drafting: its points and, read from the engine, whether the treasury allows it (and why not). */
export function subsidyDraft(state: GameState, kind: BuildingKind, amount: number): SubsidyDraft {
  const refusal = subsidyRefusal(state, kind, amount);
  const replaces = state.agency?.subsidies.some(subsidy => subsidy.kind === kind) ?? false;
  return { kind, amount, amountLine: COPY.subsidyAmount(moneyFull(amount)),
    points: COPY.subsidyPoints(Math.min(60, Math.floor(amount / 10) * SUBSIDY_POINTS_PER_10D)),
    blocked: refusal !== null ? COPY.refusal(moneyFull(refusal.total), moneyFull(refusal.limit)) : amount <= 0 ? COPY.zeroAmount : null,
    refused: refusal !== null, replaces };
}

/** The next dues step, kept in the engine's range (250‰…2000‰). */
export const duesStep = (permille: number, direction: -1 | 1): number => Math.min(DUES_MAX, Math.max(DUES_MIN, permille + direction * DUES_STEP));
