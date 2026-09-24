import type { SourceRef } from '../contracts';
import type { GameState } from '../engine/engine.types';
import { LEDGER_ACCOUNTS, type LedgerAccount } from '../ledger/ledger.types';
import { LEDGER_ACCOUNT_LABELS, LEDGER_CATEGORY_LABELS, LEDGER_COPY, LEDGER_WINDOW_LABELS } from '../ledger/ledgerCopy.ko';
import { ledgerView, sourceBuildingIds, type LedgerWindow } from '../ledger/ledgerView';
import { CAUSE_REGISTRY } from './causeRegistry';

export const LEDGER_WINDOWS: readonly LedgerWindow[] = ['recent', 'previous', 'all'];

/** Which cause-registry row presents a source (spec L-8: the ledger reuses the registry, no new glyphs). */
const BUILDING_CAUSE = { market: 'market', church: 'church', well: 'water', granary: 'bread' } as const;

export interface LedgerSourcePresentation {
  readonly label: string;
  readonly glyph: string;
  readonly color: string;
  /** Buildings to outline on the map when the row is chosen; empty = nothing to show. */
  readonly buildingIds: readonly string[];
}

export function ledgerSourcePresentation(state: Pick<GameState, 'buildings'>, source: SourceRef): LedgerSourcePresentation {
  if (source.type === 'building') {
    const building = state.buildings.find(candidate => candidate.id === source.id);
    const cause = building === undefined ? undefined : BUILDING_CAUSE[building.kind as keyof typeof BUILDING_CAUSE];
    const entry = cause === undefined ? CAUSE_REGISTRY.delivery : CAUSE_REGISTRY[cause];
    // Building ids keep their construction-site ordinal; players read the map position instead.
    const label = building === undefined ? LEDGER_COPY.goneSource(entry.shortLabel) : LEDGER_COPY.sourceAt(entry.shortLabel, building.tx, building.ty);
    return { label, glyph: entry.glyphText, color: entry.color, buildingIds: building === undefined ? [] : sourceBuildingIds([source]) };
  }
  return { label: LEDGER_CATEGORY_LABELS.opening_balance, glyph: '·', color: CAUSE_REGISTRY.operation_paused.color, buildingIds: [] };
}

export interface LedgerPanelModel {
  readonly accounts: readonly { readonly account: LedgerAccount; readonly label: string; readonly selected: boolean }[];
  readonly windows: readonly { readonly window: LedgerWindow; readonly label: string; readonly selected: boolean }[];
  readonly total: string;
  readonly categories: readonly { readonly key: string; readonly text: string }[];
  readonly sources: readonly { readonly key: string; readonly text: string; readonly glyph: string; readonly color: string; readonly buildingIds: readonly string[] }[];
  readonly entries: readonly { readonly id: string; readonly text: string; readonly buildingIds: readonly string[] }[];
  readonly notes: readonly string[];
}

const ENTRY_LIMIT = 12;

export function ledgerPanelModel(state: GameState, account: LedgerAccount, window: LedgerWindow): LedgerPanelModel {
  const view = ledgerView(state, account, window);
  const marketCount = state.buildings.filter(building => building.kind === 'market').length;
  const notes: string[] = [];
  if (account !== 'cash') notes.push(LEDGER_COPY.emptyAccount);
  else if (view.entries.length === 0 && !view.includesRollups) {
    notes.push(window === 'recent' ? (marketCount === 0 ? LEDGER_COPY.noIncomeNoMarket : LEDGER_COPY.noIncomeWithMarket) : LEDGER_COPY.noEntries);
  }
  if (account === 'cash') notes.push(LEDGER_COPY.noSpending);
  if (view.includesRollups) notes.push(LEDGER_COPY.rolledUp);
  return {
    accounts: LEDGER_ACCOUNTS.map(candidate => ({ account: candidate, label: LEDGER_ACCOUNT_LABELS[candidate], selected: candidate === account })),
    windows: LEDGER_WINDOWS.map(candidate => ({ window: candidate, label: LEDGER_WINDOW_LABELS[candidate], selected: candidate === window })),
    total: LEDGER_COPY.signed(view.total),
    categories: view.byCategory.map(row => ({ key: row.category, text: `${LEDGER_CATEGORY_LABELS[row.category]} ${LEDGER_COPY.signed(row.amount)}` })),
    sources: view.bySource.map(row => {
      const presentation = ledgerSourcePresentation(state, row.source);
      return { key: row.key, text: LEDGER_COPY.sourceLine(presentation.label, row.count, row.amount), glyph: presentation.glyph, color: presentation.color, buildingIds: presentation.buildingIds };
    }),
    entries: view.entries.slice(0, ENTRY_LIMIT).map(entry => ({
      id: entry.id,
      text: LEDGER_COPY.entryLine(entry.tick, LEDGER_CATEGORY_LABELS[entry.category], entry.amount),
      buildingIds: sourceBuildingIds(entry.sourceRefs).filter(id => state.buildings.some(building => building.id === id)),
    })),
    notes,
  };
}
