import { HOME_ESTATE_ID } from "../../../content/estateConfig";
import type { GameState } from "../../../engine/engine.types";
import { estatesOf } from "../../../engine/estates";
import { lordHouse } from "../../../engine/lordshipState";
import { calendarLabel } from "../../../engine/scenarioState";
import { lordMode } from "../../../engine/townAgency";
import { LEDGER_PERIOD_TICKS } from "../../../ledger/ledger";
import { LEDGER_CATEGORY_LABELS } from "../../../ledger/ledgerCopy.ko";
import type { LedgerCategory, LedgerEntry } from "../../../ledger/ledger.types";
import { ledgerView } from "../../../ledger/ledgerView";
import { perState } from "../../perState";
import { ESTATES_COPY } from "../estates/estatesCopy.ko";
import { houseNameKo } from "../estates/estatesModel";
import { TREASURY_COPY as COPY } from "./treasuryCopy.ko";

// DEC-CARD A5: the treasury by estate, read from the ledger as it stands (src/ledger: every cash entry and its sources).
// An entry belongs to the estate its sources name (`actor estate:<id>`: an estate's season, a petition's fee — the
// stewardship's postings); the town's own lines name a building, a zone or a right instead, and are the home estate's.
// Within an estate the categories are put under the lord's four questions — rent, taxes and dues, contracts, spending
// (every outgoing line) — with "그 밖" for the rest; the amounts and the category names are the ledger's. The window is
// the ledger's recent one (ledgerView "recent"), as the stock tab's treasury. Lord mode only.
// The engine has no per-estate read model yet: the request `ledgerByEstate` (DEC-CARD report) would give the estate of
// each entry directly instead of this reading of its sources.

type Group = keyof typeof COPY.groups;
/** The incoming categories by the lord's question (spending is the sign, not a list). */
const GROUP_OF: Partial<Record<LedgerCategory, Group>> = {
  rent: "rent", estate_income: "rent", entry_fine: "rent",
  stall_fee: "taxes", toll: "taxes", mill_toll: "taxes", murage: "taxes", war_tax: "taxes", fulling_toll: "taxes", ulnage: "taxes",
  cloth_toll: "taxes", poll_tax: "taxes", fee_farm: "taxes", charter_fee: "taxes",
  marriage_portion: "contracts", promise_payment: "contracts", instalment: "contracts", registry_settlement: "contracts", war_loan: "contracts",
};
const GROUP_ORDER: readonly Group[] = ["rent", "taxes", "contracts", "other", "spending"];

export type TreasuryGroupRow = Readonly<{ group: Group; line: string; amount: number; parts: readonly string[] }>;
export type TreasuryEstateRow = Readonly<{ estateId: string; name: string; home: boolean; net: string; amount: number; groups: readonly TreasuryGroupRow[] }>;
export type TreasuryView = Readonly<{ window: string; net: string; estates: readonly TreasuryEstateRow[]; none: string | null; note: string }>;

/** The estate an entry's sources name, else the home estate. */
export function entryEstate(entry: Pick<LedgerEntry, "sourceRefs">): string {
  const named = entry.sourceRefs.find(source => source.type === "actor" && source.id.startsWith("estate:"));
  return named === undefined ? HOME_ESTATE_ID : named.id.slice("estate:".length);
}

function estateName(state: GameState, estateId: string): string {
  if (estateId === HOME_ESTATE_ID) return ESTATES_COPY.homeName(houseNameKo(lordHouse(state).name));
  const estate = estatesOf(state).estates.find(entry => entry.id === estateId);
  return ESTATES_COPY.estateName(houseNameKo(estate?.name ?? estateId));
}

function groupRows(entries: readonly LedgerEntry[]): readonly TreasuryGroupRow[] {
  const sums = new Map<Group, Map<LedgerCategory, number>>();
  for (const entry of entries) {
    const group: Group = entry.amount < 0 ? "spending" : GROUP_OF[entry.category] ?? "other";
    const byCategory = sums.get(group) ?? new Map<LedgerCategory, number>();
    byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.amount);
    sums.set(group, byCategory);
  }
  return GROUP_ORDER.flatMap(group => {
    const byCategory = sums.get(group);
    if (byCategory === undefined) return [];
    const parts = [...byCategory].sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]));
    const amount = parts.reduce((sum, [, value]) => sum + value, 0);
    return [{ group, amount, line: COPY.group(COPY.groups[group], amount), parts: parts.map(([category, value]) => COPY.part(LEDGER_CATEGORY_LABELS[category], value)) }];
  });
}

/** The stock tab's treasury by estate (lord mode only; null otherwise). Once per state (perState). */
export const treasuryByEstate = perState((state: GameState): TreasuryView | null => {
  if (!lordMode(state)) return null;
  const entries = ledgerView(state, "cash", "recent").entries.filter(entry => entry.category !== "opening_balance");
  const byEstate = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const estateId = entryEstate(entry);
    byEstate.set(estateId, [...byEstate.get(estateId) ?? [], entry]);
  }
  const estates = [...byEstate].map(([estateId, list]) => {
    const amount = list.reduce((sum, entry) => sum + entry.amount, 0);
    return { estateId, name: estateName(state, estateId), home: estateId === HOME_ESTATE_ID, amount, net: COPY.net(amount), groups: groupRows(list) };
  }).sort((left, right) => Number(right.home) - Number(left.home) || Math.abs(right.amount) - Math.abs(left.amount) || left.estateId.localeCompare(right.estateId));
  const first = Math.max(0, state.tick - LEDGER_PERIOD_TICKS + 1);
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  return { window: COPY.window(calendarLabel({ ...state, tick: first }), calendarLabel(state)), net: COPY.net(total), estates,
    none: estates.length === 0 ? COPY.none : null, note: COPY.homeNote };
});
