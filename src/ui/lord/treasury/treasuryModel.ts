import { HOME_ESTATE_ID } from "../../../content/estateConfig";
import type { GameState } from "../../../engine/engine.types";
import { estatesOf } from "../../../engine/estates";
import { lordHouse } from "../../../engine/lordshipState";
import { calendarLabel } from "../../../engine/scenarioState";
import { lordMode } from "../../../engine/townAgency";
import { treasuryBreakdown, type TreasuryKind, type TreasuryLine } from "../../../engine/treasuryReads";
import { LEDGER_PERIOD_TICKS } from "../../../ledger/ledger";
import { perState } from "../../perState";
import { ESTATES_COPY } from "../estates/estatesCopy.ko";
import { houseNameKo } from "../estates/estatesModel";
import { TREASURY_COPY as COPY } from "./treasuryCopy.ko";

// DEC-CARD A5 → DEC-CARD-2: the treasury by estate, read from the engine's `treasuryBreakdown` (DEC-TRACE §6) over the
// ledger's recent window (as the stock tab's treasury): each estate's lines by the engine's kinds — the home estate,
// each off-map estate, and the lord's own affairs (a line that names no estate, building or right) — whether the town's
// money was settled in the window (`settled`), and what the ledger keeps only as roll-ups (`unattributed`, no sources).
// The attribution and the kinds are the engine's; this file only words them. Lord mode only.

/** The engine's estate for the lord's own affairs (`treasuryBreakdown` rows: an estate id, or this). */
const LORD_ROW = "lord";
const KIND_ORDER: readonly TreasuryKind[] = ["rents_dues", "petitions", "contracts", "marriage", "inheritance", "factions", "crown_war", "trade", "building", "spending", "other"];

export type TreasuryGroupRow = Readonly<{ group: TreasuryKind; line: string; amount: number; parts: readonly string[] }>;
export type TreasuryEstateRow = Readonly<{ estateId: string; name: string; home: boolean; net: string; amount: number; groups: readonly TreasuryGroupRow[] }>;
export type TreasuryView = Readonly<{
  window: string; net: string; settled: string; estates: readonly TreasuryEstateRow[]; unattributed: string | null; none: string | null; note: string;
}>;

/** An estate's name as the lord screens say it: the home estate by the lord's house, an off-map one by its own. */
export function estateName(state: GameState, estateId: string): string {
  if (estateId === HOME_ESTATE_ID) return ESTATES_COPY.homeName(houseNameKo(lordHouse(state).name));
  if (estateId === LORD_ROW) return COPY.lordRow;
  const estate = estatesOf(state).estates.find(entry => entry.id === estateId);
  return ESTATES_COPY.estateName(houseNameKo(estate?.name ?? estateId));
}

function groupRows(lines: readonly TreasuryLine[]): readonly TreasuryGroupRow[] {
  return KIND_ORDER.flatMap(kind => {
    const line = lines.find(entry => entry.kind === kind);
    if (line === undefined) return [];
    const amount = line.income - line.expense;
    const parts = line.income > 0 && line.expense > 0 ? [COPY.came(line.income), COPY.went(line.expense)] : [];
    return [{ group: kind, amount, line: COPY.group(COPY.kinds[kind], amount), parts: [...parts, COPY.entries(line.entries)] }];
  });
}

/** The stock tab's treasury by estate (lord mode only; null otherwise). Once per state (perState). */
export const treasuryByEstate = perState((state: GameState): TreasuryView | null => {
  if (!lordMode(state)) return null;
  const first = Math.max(0, state.tick - LEDGER_PERIOD_TICKS + 1);
  const breakdown = treasuryBreakdown(state, first, state.tick + 1);
  const byEstate = new Map<string, TreasuryLine[]>();
  for (const row of breakdown.rows) byEstate.set(row.estate, [...byEstate.get(row.estate) ?? [], row]);
  const rank = (estateId: string) => estateId === HOME_ESTATE_ID ? 0 : estateId === LORD_ROW ? 2 : 1;
  const estates = [...byEstate].map(([estateId, lines]) => {
    const amount = lines.reduce((sum, line) => sum + line.income - line.expense, 0);
    return { estateId, name: estateName(state, estateId), home: estateId === HOME_ESTATE_ID, amount, net: COPY.net(amount), groups: groupRows(lines) };
  }).sort((left, right) => rank(left.estateId) - rank(right.estateId) || Math.abs(right.amount) - Math.abs(left.amount) || left.estateId.localeCompare(right.estateId));
  return { window: COPY.window(calendarLabel({ ...state, tick: first }), calendarLabel(state)), net: COPY.net(breakdown.net),
    settled: breakdown.settled ? COPY.settled : COPY.unsettled, estates,
    unattributed: breakdown.unattributed === 0 ? null : COPY.unattributed(breakdown.unattributed),
    none: estates.length === 0 ? COPY.none : null, note: COPY.homeNote };
});
