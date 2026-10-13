import type { ReactElement } from "react";

import type { GameState } from "../../../engine/engine.types";
import { TREASURY_COPY as COPY } from "./treasuryCopy.ko";
import { treasuryByEstate } from "./treasuryModel";

// DEC-CARD A5: under the stock tab's treasury line (the status pill's coin cell opens the drawer here), lord mode only:
// each estate's net and its lines by the engine's kinds in the ledger's recent window (DEC-CARD-2: `treasuryBreakdown`),
// whether the town settled in it, and the folded roll-ups apart. Text only: nothing to press (the ledger's own entries
// are in the chronicle's decision ledger and the lord screen's ledger).
export function TreasuryByEstate({ state }: { readonly state: GameState }): ReactElement | null {
  const view = treasuryByEstate(state);
  if (view === null) return null;
  return (
    <section className="treasury-estates" aria-label={COPY.regionLabel} data-treasury-estates={String(view.estates.length)}>
      <h3>{COPY.heading}</h3>
      <p className="treasury-estates-window">{view.window} · {view.net}</p>
      <p className="treasury-estates-line" data-treasury-settled>{view.settled}</p>
      {view.none !== null ? <p className="treasury-estates-line">{view.none}</p> : <ul className="treasury-estates-list">
        {view.estates.map(estate => (
          <li key={estate.estateId} data-estate={estate.estateId}>
            <p className="treasury-estates-head"><strong>{estate.name}</strong><span>{estate.net}</span></p>
            <ul>{estate.groups.map(group => (
              <li key={group.group} data-group={group.group} data-amount={String(group.amount)}>
                <span className="treasury-estates-group">{group.line}</span>
                <span className="treasury-estates-parts">{group.parts.join(" · ")}</span>
              </li>))}</ul>
          </li>))}
      </ul>}
      {view.toleranceLosses.map(loss => <p key={loss.id} className="treasury-estates-line" data-tolerance-entry={loss.id} data-tolerance-amount={String(loss.amount)}>{loss.line}</p>)}
      {view.unattributed === null ? null : <p className="treasury-estates-line" data-treasury-unattributed>{view.unattributed}</p>}
      <p className="treasury-estates-note">{view.note}</p>
    </section>
  );
}
