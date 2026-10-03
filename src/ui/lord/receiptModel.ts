import type { BuildingKind } from "../../content/buildingConfig";
import { BUILDING_COPY } from "../../content/buildingCatalog.ko";
import { START_SCORE } from "../../content/townAgencyConfig";
import type { GameState } from "../../engine/engine.types";
import { history } from "../../engine/history";
import { LORD_PUBLIC_WORKS, lordMode, whyHere } from "../../engine/townAgency";
import type { ProjectReceipt, Reason, ReasonName } from "../../engine/townAgency.types";
import { chronicleDate } from "../chronicle/chronicleScreenModel";
import { moneyFull } from "../money.ko";
import { RECEIPT_COPY as COPY } from "./receiptCopy.ko";

// LM-R1 (TA-5, lord-mode §3.6): the "왜 여기?" receipt of what the player selected on the map — a building, a house or a
// construction site — read from the engine's own receipt (`whyHere`): its top reasons, the sites it compared, the
// chance it was drawn by, its money and the lord's decisions behind it (their ledger records). Lord mode only.

export type ReceiptReasonRow = Readonly<{ name: ReasonName; label: string; value: number; sign: "plus" | "minus" | "zero";
  /** The value as written (its sign always shown). */
  text: string;
  /** |value| ÷ the largest |value| among the rows (0…1): the bar's length beside the written value. */
  share: number }>;

export type ReceiptDecisionRow = Readonly<{ id: string; tick: number | null; date: string; line: string; found: boolean }>;

export type ReceiptView =
  | Readonly<{ kind: "receipt"; id: string; name: string; building: BuildingKind | null; builtBy: string; origin: string; score: string;
      reasons: readonly ReceiptReasonRow[];
      /** The sites compared, line by line; `runnerUp` the next site's score (null with one candidate or none compared). */
      sites: readonly string[]; runnerUp: number | null; siteCount: number | null;
      /** "확률로 골랐음" lines (the project's draw, the site's), or the old save's note. */
      chance: readonly string[]; chanceKnown: boolean;
      decisions: readonly ReceiptDecisionRow[]; money: string; subsidy: number }>
  | Readonly<{ kind: "none"; id: string; name: string; building: BuildingKind | null; explanation: string }>;

const kindName = (kind: string): string => BUILDING_COPY[kind as BuildingKind]?.name ?? kind;

function reasonRows(reasons: readonly Reason[]): readonly ReceiptReasonRow[] {
  const largest = Math.max(1, ...reasons.map(reason => Math.abs(reason.value)));
  return reasons.map(reason => ({ name: reason.name, label: COPY.reasons[reason.name], value: reason.value,
    sign: reason.value > 0 ? "plus" : reason.value < 0 ? "minus" : "zero", text: COPY.reasonValue(reason.value), share: Math.abs(reason.value) / largest }));
}

function siteLines(receipt: ProjectReceipt): readonly string[] {
  const sites = receipt.sites;
  if (sites === undefined) return [COPY.noSites];
  const lines = [COPY.sitesCount(sites.count), COPY.chosenSite(receipt.tx, receipt.ty, receipt.score)];
  if (sites.runnerUp === null) lines.push(COPY.noRunnerUp);
  else lines.push(COPY.nextSite(sites.runnerUp.tx, sites.runnerUp.ty, sites.runnerUp.score), COPY.siteGap(receipt.score - sites.runnerUp.score));
  if (sites.planTx !== receipt.tx || sites.planTy !== receipt.ty) lines.push(COPY.planSite(sites.planTx, sites.planTy));
  return lines;
}

function chanceLines(receipt: ProjectReceipt): readonly string[] {
  const chance = receipt.chance;
  if (chance === undefined) return [COPY.noChance];
  const { project, site } = chance;
  return [COPY.projectChance(project.of, project.place, project.permille, COPY.temperaments[project.temperament]),
    ...(site === undefined ? [] : [COPY.siteChance(site.of, site.place, site.permille)])];
}

function decisionRows(state: GameState, ids: readonly string[]): readonly ReceiptDecisionRow[] {
  const records = state.history?.records ?? [];
  return ids.map(id => {
    const record = records.find(entry => entry.id === id);
    return record === undefined ? { id, tick: null, date: "", line: COPY.missingDecision, found: false }
      : { id, tick: record.tick, date: chronicleDate(state, record.tick), line: history.summary(record, state), found: true };
  });
}

/** The receipt of a building or construction site id; null outside lord mode or for an id that is neither. */
export function receiptView(state: GameState, id: string): ReceiptView | null {
  if (!lordMode(state)) return null;
  const building = state.buildings.find(entry => entry.id === id) ?? state.constructionSites.find(entry => entry.id === id);
  if (building === undefined) return null;
  const kind = building.kind in BUILDING_COPY ? building.kind as BuildingKind : null;
  const name = kindName(building.kind);
  const receipt = whyHere(state, id);
  if (receipt === null) {
    const lords = kind !== null && LORD_PUBLIC_WORKS.includes(kind);
    return { kind: "none", id, name, building: kind, explanation: lords ? COPY.noneLord : COPY.noneTown };
  }
  return {
    kind: "receipt", id, name, building: kind,
    builtBy: COPY.builtBy(COPY.actors[receipt.actor], chronicleDate(state, receipt.tick)),
    origin: receipt.rank === null ? COPY.fromOpportunity : COPY.fromNeed(receipt.rank + 1),
    score: COPY.score(receipt.score, START_SCORE),
    reasons: reasonRows(receipt.reasons),
    sites: siteLines(receipt), runnerUp: receipt.sites?.runnerUp?.score ?? null, siteCount: receipt.sites?.count ?? null,
    chance: chanceLines(receipt), chanceKnown: receipt.chance !== undefined,
    decisions: decisionRows(state, receipt.decisionIds),
    money: COPY.money(moneyFull(receipt.cost), moneyFull(receipt.subsidy), moneyFull(receipt.loan)), subsidy: receipt.subsidy,
  };
}
