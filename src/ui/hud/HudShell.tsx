import { useState, type ReactNode } from "react";

import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../../content/buildingConfig";
import type { GameState } from "../../engine/engine.types";
import { calendarLabel, stateCalendar } from "../../engine/scenarioState";
import { platformServices } from "../../platform/platform";
import { alertRowLookAtIntent, alertStackRows } from "../alertStackModel";
import { ALERT_STACK_COPY } from "../alertStackCopy.ko";
import { stewardPortraitStyle } from "../uiArt";
import { UiIcon } from "../UiIcon";
import { TUTORIAL_COPY } from "../tutorial/tutorialCopy.ko";
import type { TutorialController } from "../tutorial/useTutorialController";
import type { ControlLayer } from "../tutorial/tutorialModel";
import { HUD_COPY, RESOURCE_NAMES } from "./hudCopy.ko";
import { SeasonStripMini, SeasonStripPanel } from "./SeasonStrip";
import { SEASON_STRIP_COPY } from "../seasonStripCopy.ko";
import { wave8ImageStyle } from "../wave8Art";
import { ledgerMatrix, statusPillModel } from "./statusPillModel";

// UX-3 HUD shell (research 15 B): the only UI always on screen — the status pill (top left), the layer switch (bottom
// left), the action dock (bottom right) and, while something is wrong, at most three crisis icons (top right). The
// build drawer, the ledger drawer and the inspector share one panel slot (uiStateMachine).
const SEASON_ICON = ["spring", "summer", "autumn", "winter"] as const;

export function StatusPill({ state, model, onOpenLedger, onOpenPopulation }: {
  readonly state: GameState; readonly model: ReturnType<typeof statusPillModel>;
  readonly onOpenLedger: () => void; readonly onOpenPopulation: () => void;
}) {
  const [stripOpen, setStripOpen] = useState(false);
  return (
    <nav className="status-pill" aria-label={HUD_COPY.pill}>
      <button type="button" className="status-pill-cell status-pill-date" data-testid="hud-calendar" aria-label={SEASON_STRIP_COPY.label}
        aria-expanded={stripOpen} onClick={() => setStripOpen(open => !open)}>
        <span className="status-pill-date-text"><UiIcon sheet="resource" cell={SEASON_ICON[stateCalendar(state).season]} />{calendarLabel(state)}</span>
        <SeasonStripMini tick={state.tick} />
      </button>
      {stripOpen ? <SeasonStripPanel state={state} onClose={() => setStripOpen(false)} /> : null}
      <button type="button" className="status-pill-cell" aria-label={HUD_COPY.populationOpens} onClick={() => onOpenPopulation()}>
        <UiIcon sheet="resource" cell="population" />{HUD_COPY.population(model.population)}
      </button>
      <button type="button" className="status-pill-cell" aria-label={HUD_COPY.pillOpensLedger} data-food-days={model.foodDays ?? ""} onClick={() => onOpenLedger()}
        data-short={model.foodDays !== null && model.foodDays < 14 ? "true" : undefined}>
        <UiIcon sheet="resource" cell="bread" />{model.foodDays === null ? HUD_COPY.foodNone : HUD_COPY.foodDays(model.foodDays)}
      </button>
      <button type="button" className="status-pill-cell" aria-label={HUD_COPY.pillOpensLedger} onClick={() => onOpenLedger()}>
        <UiIcon sheet="resource" cell="coin" />{HUD_COPY.money(model.coin)}
      </button>
    </nav>
  );
}

/** Layer switch (research 15 E 6.1): always visible from the start; a locked layer shows its lock and why on tap. */
export function LayerSwitch({ layer, access, onChange, pulse, hidden = false }: {
  readonly layer: ControlLayer; readonly access: TutorialController["access"]; readonly onChange: (layer: ControlLayer) => void;
  readonly pulse: TutorialController["pulse"]; readonly hidden?: boolean;
}) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="layer-switch" role="group" aria-label={TUTORIAL_COPY.layerGroup} hidden={hidden}>
      {(["direct", "zone", "direction"] as const).map(item => {
        const open = access.layers[item];
        return (
          <button key={item} type="button" className={`control-layer${item === "zone" ? " build-menu-category" : ""}${open ? "" : " control-layer--locked"}`}
            aria-pressed={layer === item} aria-disabled={!open} data-layer={item}
            data-pulse={pulse !== null && pulse.key === `layer:${item}` ? `${pulse.key}#${pulse.nonce}` : undefined}
            onClick={() => {
              if (!open) { setNote(HUD_COPY.layerLocked(TUTORIAL_COPY.layers[item], TUTORIAL_COPY.lockedLayer[item === "direction" ? "direction" : "zone"])); return; }
              setNote(null); onChange(item);
            }}>
            <UiIcon sheet="layer" cell={item} />{TUTORIAL_COPY.layers[item]}{open ? null : <UiIcon sheet="lock" cell="locked" className="control-layer-lock" />}
          </button>
        );
      })}
      {note === null ? null : <p className="layer-switch-note" role="status"><UiIcon sheet="lock" cell="locked" />{note}</p>}
    </div>
  );
}

export function ActionDock({ buildOpen, ledgerOpen, onBuild, onLedger, advisor, onDismissAdvisor, undo, hidden = false }: {
  readonly hidden?: boolean;
  readonly buildOpen: boolean; readonly ledgerOpen: boolean; readonly onBuild: () => void; readonly onLedger: () => void;
  readonly advisor: TutorialController["advisor"]; readonly onDismissAdvisor: () => void;
  /** The newest site can be taken back (the tutorial points at it after the well). */
  readonly undo: { readonly enabled: boolean; readonly attention: boolean; readonly label: string; readonly onUndo: () => void };
}) {
  const [stewardOpen, setStewardOpen] = useState(false);
  const speaking = advisor !== null;
  return (
    <nav className="action-dock" aria-label={HUD_COPY.dock} hidden={hidden}>
      {undo.enabled ? <button type="button" className="hud-undo action-dock-small" aria-label={undo.label} data-attention={undo.attention ? "true" : undefined}
        onClick={() => undo.onUndo()}><UiIcon sheet="action" cell="up" />{HUD_COPY.undo}</button> : null}
      <button type="button" className="action-dock-button" aria-expanded={buildOpen} data-dock="build" onClick={() => onBuild()}>
        <UiIcon sheet="category" cell="living" size={32} />{HUD_COPY.build}
      </button>
      <button type="button" className="action-dock-button" aria-expanded={ledgerOpen} data-dock="ledger" onClick={() => onLedger()}>
        <UiIcon sheet="action" cell="log" size={32} />{HUD_COPY.ledger}
      </button>
      <button type="button" className="action-dock-button" data-dock="steward" aria-expanded={stewardOpen || speaking} data-speaking={speaking ? "true" : undefined}
        onClick={() => { if (speaking) onDismissAdvisor(); else setStewardOpen(open => !open); }}>
        <span className="action-dock-portrait" aria-hidden="true" style={stewardPortraitStyle(advisor?.tone ?? "neutral")} />{HUD_COPY.steward}
      </button>
      {speaking ? <aside className={`steward-advisor steward-bubble steward-advisor--${advisor.tone}`} aria-label={TUTORIAL_COPY.stewardName} data-advisor={advisor.key} data-tone={advisor.tone}>
        <p className="steward-line">{advisor.text}</p>
        <button type="button" className="steward-button" onClick={() => onDismissAdvisor()}>{TUTORIAL_COPY.advisorButton}</button>
      </aside> : stewardOpen ? <aside className="steward-bubble" role="status"><p className="steward-line">{HUD_COPY.stewardQuiet}</p></aside> : null}
    </nav>
  );
}

/** Crisis icons (S-33): outside the slot, at most three, only while something is wrong; a tap looks at and inspects it. */
export function CrisisIcons({ rows: all, onInspect }: { readonly rows: ReturnType<typeof alertStackRows>; readonly onInspect: (id: string) => void }) {
  const rows = all.slice(0, 3);
  if (rows.length === 0) return null;
  return (
    <section className="crisis-icons" aria-label={HUD_COPY.crisis}>
      {rows.map(row => (
        <button key={row.id} type="button" className={`crisis-icon alert-stack-inspect crisis-icon--${row.severity}`} aria-label={HUD_COPY.crisisLabel(ALERT_STACK_COPY.inspectLabel(row.title), row.cause)}
          onClick={() => { const first = row.targetIds[0]; if (first === undefined) return; platformServices().input.emit(alertRowLookAtIntent(row)); onInspect(first); }}>
          {/* UI-3: the Wave 8 alert bells (threat = immediate, bad = caution). */}
          <span className="crisis-bell" aria-hidden="true" style={wave8ImageStyle(row.severity === "immediate" ? "icon_alert_bell_threat" : "icon_alert_bell_bad", 32)} />
        </button>
      ))}
    </section>
  );
}

type LedgerTab = "stock" | "alerts" | "view" | "map";
/** Ledger drawer (S-26): resource x storage; alerts, overlays and the map as its other tabs. */
export function LedgerDrawer({ state, onInspect, onClose, viewTab, mapTab }: {
  readonly state: GameState; readonly onInspect: (id: string) => void; readonly onClose: () => void;
  readonly viewTab: ReactNode; readonly mapTab: ReactNode;
}) {
  const [tab, setTab] = useState<LedgerTab>("stock");
  const matrix = ledgerMatrix(state);
  const alerts = alertStackRows(state);
  return (
    <section className="ledger-drawer slot-panel" aria-label={HUD_COPY.ledgerTitle}>
      <header className="slot-panel-heading"><h2>{HUD_COPY.ledgerTitle}</h2>
        <button type="button" className="slot-panel-close" aria-label={HUD_COPY.close} onClick={() => onClose()}>{HUD_COPY.closeMark}</button></header>
      <div className="ledger-tabs" role="tablist">
        {(Object.keys(HUD_COPY.ledgerTabs) as LedgerTab[]).map(key => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className="ledger-tab" onClick={() => setTab(key)}>{HUD_COPY.ledgerTabs[key]}</button>
        ))}
      </div>
      {tab === "stock" ? (matrix.rows.length === 0 ? <p>{HUD_COPY.ledgerEmpty}</p> : (
        <table className="ledger-matrix">
          <thead><tr><th scope="col" />{matrix.stores.map(store => (
            <th key={store.id} scope="col"><button type="button" className="ledger-store" onClick={() => onInspect(store.id)}>
              {HUD_COPY.ledgerStore(BUILDING_CONFIG_BY_KIND[store.kind as BuildingKind].name, store.index)}</button></th>))}
            <th scope="col">{HUD_COPY.ledgerTotal}</th></tr></thead>
          <tbody>{matrix.rows.map(row => (
            <tr key={row.resource}><th scope="row">{RESOURCE_NAMES[row.resource]}</th>
              {row.byStore.map((amount, index) => <td key={matrix.stores[index]!.id}>{amount === 0 ? "—" : amount}</td>)}
              <td className="ledger-total">{row.total}</td></tr>))}</tbody>
        </table>)) : null}
      {tab === "alerts" ? (alerts.length === 0 ? <p>{HUD_COPY.ledgerNoAlerts}</p> : <ul className="ledger-alerts">{alerts.map(row => (
        <li key={row.id}><strong>{row.title}</strong> · {row.countLabel}<br /><span>{row.cause}</span>
          <button type="button" className="ledger-alert-look" onClick={() => { const first = row.targetIds[0]; if (first !== undefined) { platformServices().input.emit(alertRowLookAtIntent(row)); onInspect(first); } }}>
            <UiIcon sheet="action" cell="look" />{ALERT_STACK_COPY.inspect}</button></li>))}</ul>) : null}
      {tab === "view" ? viewTab : null}
      {tab === "map" ? mapTab : null}
    </section>
  );
}

export function PauseMenu({ onResume, settings }: { readonly onResume: () => void; readonly settings: ReactNode }) {
  return (
    <div className="pause-menu-backdrop" role="presentation">
      <section className="pause-menu" role="dialog" aria-modal="true" aria-label={HUD_COPY.pauseTitle}>
        <h2>{HUD_COPY.pauseTitle}</h2>
        <button type="button" className="pause-menu-resume" onClick={() => onResume()}><UiIcon sheet="time" cell="play" />{HUD_COPY.pauseResume}</button>
        <div className="pause-menu-settings">{settings}</div>
      </section>
    </div>
  );
}
