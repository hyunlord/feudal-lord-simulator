import { useState, type ReactElement } from 'react';

import type { GameState } from '../engine/engine.types';
import type { LedgerAccount } from '../ledger/ledger.types';
import { LEDGER_COPY } from '../ledger/ledgerCopy.ko';
import type { LedgerWindow } from '../ledger/ledgerView';
import { ledgerPanelModel, type LedgerPanelModel } from './ledgerPanelModel';

type LedgerPanelProps = {
  readonly state: GameState;
  readonly id: string;
  /** Outline these buildings on the map (the existing highlight channel). */
  readonly onHighlightBuildings: (buildingIds: readonly string[]) => void;
};

export function LedgerPanel({ state, id, onHighlightBuildings }: LedgerPanelProps) {
  const [account, setAccount] = useState<LedgerAccount>('cash');
  const [window, setWindow] = useState<LedgerWindow>('recent');
  return LedgerPanelView({ id, model: ledgerPanelModel(state, account, window), onSelectAccount: setAccount, onSelectWindow: setWindow, onHighlightBuildings });
}

type LedgerPanelViewProps = {
  readonly id: string;
  readonly model: LedgerPanelModel;
  readonly onSelectAccount: (account: LedgerAccount) => void;
  readonly onSelectWindow: (window: LedgerWindow) => void;
  readonly onHighlightBuildings: (buildingIds: readonly string[]) => void;
};

/** Stateless body of the panel (spec L-8), so tests can press its buttons without a DOM. */
export function LedgerPanelView({ id, model, onSelectAccount, onSelectWindow, onHighlightBuildings }: LedgerPanelViewProps): ReactElement {
  return (
    <aside id={id} className="resource-bar__coin-detail ledger-panel" aria-label={LEDGER_COPY.panelAria}>
      <strong>{LEDGER_COPY.heading}</strong>
      <div className="ledger-panel__tabs" role="tablist" aria-label={LEDGER_COPY.panelAria}>
        {model.accounts.map(tab => (
          <button key={tab.account} type="button" role="tab" aria-selected={tab.selected} className="ledger-panel__tab" onClick={() => onSelectAccount(tab.account)}>{tab.label}</button>
        ))}
      </div>
      <div className="ledger-panel__tabs" role="group">
        {model.windows.map(tab => (
          <button key={tab.window} type="button" aria-pressed={tab.selected} className="ledger-panel__tab" onClick={() => onSelectWindow(tab.window)}>{tab.label}</button>
        ))}
      </div>
      <p className="ledger-panel__total"><b>{model.total}</b> {LEDGER_COPY.money}</p>
      {model.categories.length > 0 ? <><h3>{LEDGER_COPY.byCategory}</h3><ul>{model.categories.map(row => <li key={row.key}>{row.text}</li>)}</ul></> : null}
      {model.sources.length > 0 ? <><h3>{LEDGER_COPY.bySource}</h3><p className="ledger-panel__hint">{LEDGER_COPY.highlightHint}</p><ul>{model.sources.map(row => (
        <li key={row.key}>
          <button type="button" className="ledger-panel__source" data-source={row.key} disabled={row.buildingIds.length === 0} onClick={() => onHighlightBuildings(row.buildingIds)}>
            <span className="ledger-panel__glyph" style={{ color: row.color }} aria-hidden="true">{row.glyph}</span>{row.text}
          </button>
        </li>
      ))}</ul></> : null}
      {model.entries.length > 0 ? <><h3>{LEDGER_COPY.entries}</h3><ul>{model.entries.map(row => (
        <li key={row.id}>
          <button type="button" className="ledger-panel__entry" data-entry={row.id} disabled={row.buildingIds.length === 0} onClick={() => onHighlightBuildings(row.buildingIds)}>{row.text}</button>
        </li>
      ))}</ul></> : null}
      {model.notes.map(note => <p key={note}>{note}</p>)}
    </aside>
  );
}
