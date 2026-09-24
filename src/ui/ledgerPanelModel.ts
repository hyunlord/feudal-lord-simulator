import type { SourceRef } from '../contracts';
import type { GameState } from '../engine/engine.types';
import { LEDGER_ACCOUNTS, type LedgerAccount } from '../ledger/ledger.types';
import { LEDGER_ACCOUNT_LABELS, LEDGER_CATEGORY_LABELS, LEDGER_COPY, LEDGER_WINDOW_LABELS } from '../ledger/ledgerCopy.ko';
import { ledgerView, sourceBuildingIds, type LedgerWindow } from '../ledger/ledgerView';
import { CAUSE_REGISTRY } from './causeRegistry';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { MONEY_RULE_COPY } from '../content/moneyCopy.ko';
import { tollPointTile } from '../engine/tollCrossings';

export const LEDGER_WINDOWS: readonly LedgerWindow[] = ['recent', 'previous', 'all'];

/** Which cause-registry row presents a source (spec L-8: the ledger reuses the registry, no new glyphs). */
const BUILDING_CAUSE = { market: 'market', church: 'church', well: 'water', granary: 'bread', mill: 'bread' } as const;
const NEUTRAL = { glyph: '·', color: CAUSE_REGISTRY.operation_paused.color } as const;

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
    const entry = cause === undefined ? undefined : CAUSE_REGISTRY[cause];
    // Building ids keep their construction-site ordinal; players read the kind and map position instead.
    const name = building === undefined ? LEDGER_COPY.goneBuilding : BUILDING_CONFIG_BY_KIND[building.kind].name;
    const label = building === undefined ? LEDGER_COPY.goneSource(name) : LEDGER_COPY.sourceAt(name, building.tx, building.ty);
    return { label, glyph: entry?.glyphText ?? NEUTRAL.glyph, color: entry?.color ?? NEUTRAL.color,
      buildingIds: building === undefined ? [] : sourceBuildingIds([source]) };
  }
  if (source.type === 'right') {
    // M-4: gates and bridges are toll points, not buildings; the row names the place, nothing to outline.
    const tile = tollPointTile(source.id);
    const name = source.detail === 'bridge' ? MONEY_RULE_COPY.bridge : MONEY_RULE_COPY.gate;
    const entry = source.detail === 'bridge' ? CAUSE_REGISTRY.delivery : CAUSE_REGISTRY.wall;
    return { label: tile === null ? name : LEDGER_COPY.sourceAt(name, tile.tx, tile.ty), glyph: entry.glyphText, color: entry.color, buildingIds: [] };
  }
  if (source.type === 'policy' && source.id === 'stone_wall_project') {
    return { label: MONEY_RULE_COPY.stoneProject, glyph: CAUSE_REGISTRY.wall.glyphText, color: CAUSE_REGISTRY.wall.color, buildingIds: [] };
  }
  return { label: LEDGER_CATEGORY_LABELS.opening_balance, glyph: NEUTRAL.glyph, color: NEUTRAL.color, buildingIds: [] };
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
  const notes: string[] = [];
  if (account === 'arrears') {
    if (view.entries.length === 0 && !view.includesRollups) notes.push(LEDGER_COPY.noArrears);
  } else if (account !== 'cash') notes.push(LEDGER_COPY.emptyAccount);
  else if (view.entries.length === 0 && !view.includesRollups) notes.push(window === 'recent' ? LEDGER_COPY.noIncome : LEDGER_COPY.noEntries);
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
