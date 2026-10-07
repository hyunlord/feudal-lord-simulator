/**
 * DEC-TRACE §6 read model (`treasuryBreakdown`; the user's instruction 2026-10-06, Astra's lord-mode play): where the
 * treasury's change in [from, to) came from and went — by estate (the home estate, each off-map estate, the lord's own
 * affairs) and by kind (rents and dues, petitions, contracts, marriage, inheritance, the factions, war and the crown,
 * building, other spending). It reads the ledger's entries and their sources; what has been folded into roll-ups (older
 * than the ledger keeps, about three and a half years) has no sources and is counted apart. It changes nothing.
 */
import { HOME_ESTATE_ID } from "../content/estateConfig";
import { settlementIn } from "../ledger/ledger";
import type { LedgerEntry } from "../ledger/ledger.types";
import type { GameState } from "./engine.types";

export type TreasuryKind = "rents_dues" | "petitions" | "contracts" | "marriage" | "inheritance" | "factions" | "crown_war" | "trade" | "building" | "spending" | "other";

const KIND_BY_CATEGORY: Readonly<Record<string, TreasuryKind>> = {
  rent: "rents_dues", stall_fee: "rents_dues", toll: "rents_dues", mill_toll: "rents_dues", fulling_toll: "rents_dues", cloth_toll: "rents_dues", ulnage: "rents_dues",
  entry_fine: "rents_dues", fee_farm: "rents_dues", murage: "rents_dues", statute_fine: "rents_dues",
  registry_settlement: "contracts", instalment: "contracts", promise_payment: "contracts", charter_fee: "contracts", restoration_fee: "contracts",
  marriage_portion: "marriage", succession_relief: "inheritance", legacy_endowment: "inheritance",
  faction_gift: "factions", faction_demand: "factions", church_fee: "factions", church_rebuilding: "factions",
  wool_levy: "crown_war", war_exemption: "crown_war", war_subsidy: "crown_war", war_loan: "crown_war", war_tax: "crown_war", raid_loot: "crown_war", purveyance: "crown_war",
  poll_tax: "crown_war", royal_subsidy: "crown_war",
  market_sale: "trade", demesne_sale: "trade", famine_sale: "trade", timber_purchase: "trade",
  construction: "building", project: "building", project_subsidy: "building",
  upkeep: "spending", wages: "spending", famine_relief: "spending", lawsuit: "spending", refugee_fee: "spending", house_change: "spending", audit_recovery: "petitions",
};

/** The estate an entry belongs to: an `estate:<id>` source, else the home estate for the town's own (buildings, rights), else the lord's. */
function estateOf(entry: LedgerEntry): string {
  for (const source of entry.sourceRefs) if (source.type === "actor" && source.id.startsWith("estate:")) return source.id.slice("estate:".length);
  if (entry.sourceRefs.some(source => source.type === "building" || source.type === "right")) return HOME_ESTATE_ID;
  return "lord";
}

/** Its kind: an off-map estate's yield is rents and dues, a petition's fine or cost a petition; the rest by category. */
function kindOf(entry: LedgerEntry, inherited: ReadonlySet<string>, estate: string): TreasuryKind {
  if (entry.category === "estate_income") {
    if (entry.sourceRefs.some(source => source.type === "claim")) return "petitions";
    return inherited.has(estate) ? "inheritance" : "rents_dues";
  }
  return KIND_BY_CATEGORY[entry.category] ?? (entry.amount < 0 ? "spending" : "other");
}

export interface TreasuryLine { readonly estate: string; readonly kind: TreasuryKind; readonly income: number; readonly expense: number; readonly entries: number }

/**
 * DEC-TRACE §6 API: the treasury's change in [from, to), by estate and kind. An off-map estate the lord came to hold by a
 * marriage's inheritance has its yield counted as inheritance. `settled` says whether the town's money was settled in
 * the span (the town settles every 2,400 ticks: a season can have none). `unattributed` is what the ledger keeps only
 * as roll-ups (no sources).
 */
export function treasuryBreakdown(state: GameState, fromTick: number, toTick: number) {
  const inherited = new Set((state.history?.records ?? []).filter(record => record.template === "marriage.inherited" || (record.template === "estate.title_changed" && record.params?.to === "lord" && record.params?.piece === ""))
    .map(record => String(record.params?.estate ?? record.params?.estateId ?? "")).filter(id => id !== ""));
  const lines = new Map<string, { estate: string; kind: TreasuryKind; income: number; expense: number; entries: number }>();
  for (const entry of state.ledger?.entries ?? []) {
    if (entry.account !== "cash" || entry.category === "opening_balance" || entry.tick < fromTick || entry.tick >= toTick) continue;
    const estate = estateOf(entry);
    const kind = kindOf(entry, inherited, estate);
    const key = `${estate}|${kind}`;
    const line = lines.get(key) ?? { estate, kind, income: 0, expense: 0, entries: 0 };
    if (entry.amount > 0) line.income += entry.amount; else line.expense -= entry.amount;
    line.entries += 1;
    lines.set(key, line);
  }
  const unattributed = (state.ledger?.rollups ?? []).filter(rollup => rollup.periodEnd > fromTick && rollup.periodStart < toTick && rollup.account === "cash")
    .reduce((sum, rollup) => sum + Object.entries(rollup.byCategory).filter(([category]) => category !== "opening_balance").reduce((inner, [, amount]) => inner + (amount ?? 0), 0), 0);
  const rows: readonly TreasuryLine[] = [...lines.values()].sort((left, right) => (left.estate < right.estate ? -1 : left.estate > right.estate ? 1 : left.kind < right.kind ? -1 : 1));
  const income = rows.reduce((sum, row) => sum + row.income, 0), expense = rows.reduce((sum, row) => sum + row.expense, 0);
  return { fromTick, toTick, settled: settlementIn(fromTick, toTick), income, expense, net: income - expense, rows, unattributed, inherited: [...inherited].sort() };
}
