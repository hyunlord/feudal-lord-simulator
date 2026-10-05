import type { ComponentType, ReactElement } from "react";
import type { GameState } from "../../../engine/engine.types";
import { HUD_COPY } from "../../hud/hudCopy.ko";
import { Button } from "../../kit";
import { PortfolioPanel, portfolioGate } from "../estates/PortfolioPanel";
import { LedgerPanel, ledgerGate } from "../ledger/LedgerPanel";
import { NegotiationPanel, negotiationGate } from "../negotiation/NegotiationPanel";
import { RegionPanel, regionGate } from "../region/RegionPanel";
import { useUiParts } from "../uiPartArt";
import { LORD_SCREEN_COPY as COPY } from "./lordScreenCopy.ko";
import type { LordNavGate, LordPanelProps, LordScreenId } from "./lordScreenTypes";

// LM-R2: the lord screen host (lord mode only; App mounts it in the panel slot, S-30). A side panel — the town stays in
// view and keeps running (no modal, no time stop: LM-R1 S1/S2) — with the lord-components-region left menu. An item
// whose screen is not built, or that the game has no rules for, is shut with its reason written under its name.
// The menu's icons are the region bundle's `ui-image` parts (lord.nav.<id>, 40 px); until they load the items are text.

type NavItem = { readonly id: LordScreenId; readonly gate: LordNavGate; readonly Panel: ComponentType<LordPanelProps> | null };
const shut = (reason: string): LordNavGate => () => reason;
/** The menu's order (the 2026-10-02 mockups' left menu, with promises and suits after the marriage). */
export const LORD_NAV: readonly NavItem[] = [
  { id: "character", gate: shut(COPY.soon), Panel: null },
  { id: "dynasty", gate: shut(COPY.soon), Panel: null },
  { id: "region", gate: regionGate, Panel: RegionPanel },
  { id: "estates", gate: portfolioGate, Panel: PortfolioPanel },
  { id: "council", gate: shut(COPY.soon), Panel: null },
  { id: "marriage", gate: negotiationGate, Panel: NegotiationPanel },
  { id: "ledger", gate: ledgerGate, Panel: LedgerPanel },
  { id: "petitions", gate: shut(COPY.soon), Panel: null },
  { id: "military", gate: shut(COPY.noRules), Panel: null },
];
export const navIconId = (id: LordScreenId): string => `lord.nav.${id}`;
const NAV_ICONS = LORD_NAV.map(item => navIconId(item.id));

/** The screen shown: the asked one when it opens, else the first that opens, else none. */
export function shownScreen(state: GameState, asked: LordScreenId | null): LordScreenId | null {
  const open = LORD_NAV.filter(item => item.Panel !== null && item.gate(state) === null);
  return open.find(item => item.id === asked)?.id ?? open[0]?.id ?? null;
}

export function LordScreen({ state, dispatch, screen, focus, onOpen, onClose, onPerson }: Omit<LordPanelProps, "focus"> & {
  readonly screen: LordScreenId | null; readonly focus: string | null; readonly onClose: () => void;
}): ReactElement {
  const parts = useUiParts(NAV_ICONS);
  const shown = shownScreen(state, screen);
  const Panel = LORD_NAV.find(item => item.id === shown)?.Panel ?? null;
  return (
    <aside className="slot-panel lord-screen" data-frame="slot" aria-label={COPY.region} data-lord-screen={shown ?? "none"}>
      <header className="slot-panel-heading"><h2>{COPY.title}</h2>
        <Button type="button" className="slot-panel-close" aria-label={COPY.close} onPress={() => onClose()} variant="close">{HUD_COPY.closeMark}</Button></header>
      <div className="lord-screen-body">
        <nav className="lord-screen-nav" aria-label={COPY.nav}>
          {LORD_NAV.map(item => {
            const reason = item.Panel === null ? item.gate(state) ?? COPY.soon : item.gate(state);
            const icon = parts.image(navIconId(item.id), 40);
            return <Button key={item.id} type="button" className="lord-screen-nav-item" data-lord-nav={item.id} variant="tab"
              aria-current={shown === item.id ? "page" : undefined} disabled={reason !== null} onPress={() => onOpen(item.id)}>
              {icon === null ? null : <span className="lord-screen-nav-icon" aria-hidden="true" style={icon} />}
              <span className="lord-screen-nav-text"><span className="lord-screen-nav-label">{COPY.labels[item.id]}</span>
                {reason === null ? null : <span className="lord-screen-nav-reason">{reason}</span>}</span>
            </Button>;
          })}
        </nav>
        <section className="lord-screen-content" aria-label={shown === null ? COPY.title : COPY.labels[shown]}>
          {Panel === null ? <p className="lord-screen-empty">{COPY.none}</p>
            : <Panel state={state} dispatch={dispatch} focus={shown === screen ? focus : null} onOpen={onOpen} onPerson={onPerson} />}
        </section>
      </div>
    </aside>
  );
}
