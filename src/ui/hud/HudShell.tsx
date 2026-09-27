import { useEffect, useState, type ReactNode } from "react";

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
import { HUD_COPY } from "./hudCopy.ko";
import { resourceName } from "../../content/resourceCatalog.ko";
import { resourceEntry } from "../../content/resourceCatalog";
import { SeasonStripMini, SeasonStripPanel } from "./SeasonStrip";
import { SEASON_STRIP_COPY } from "../seasonStripCopy.ko";
import { wave8ImageStyle } from "../wave8Art";
import { ledgerMatrix, statusPillModel } from "./statusPillModel";
import { weeklyTotalChange, type StoreStockHistory } from "../storeStockHistory";
import { DECISION_COPY } from "../decisionCopy.ko";
import { CHRONICLE_SCREEN_COPY } from "../chronicle/chronicleScreenCopy.ko";
import { PERSONS_COPY } from "../persons/personsCopy.ko";
import { Button } from "../kit";

// UX-3 HUD shell (research 15 B): the only UI always on screen — the status pill (top left), the layer switch (bottom
// left), the action dock (bottom right) and, while something is wrong, at most three crisis icons (top right). The
// build drawer, the ledger drawer and the inspector share one panel slot (uiStateMachine).
const STEWARD_LINE_MS = 8_000;
const SEASON_ICON = ["spring", "summer", "autumn", "winter"] as const;

export function StatusPill({ state, model, onOpenLedger, onOpenPopulation }: {
  readonly state: GameState; readonly model: ReturnType<typeof statusPillModel>;
  readonly onOpenLedger: () => void; readonly onOpenPopulation: () => void;
}) {
  const [stripOpen, setStripOpen] = useState(false);
  return (
    <nav className="status-pill" aria-label={HUD_COPY.pill}>
      <Button type="button" className="status-pill-cell status-pill-date" data-testid="hud-calendar" aria-label={SEASON_STRIP_COPY.label}
        aria-expanded={stripOpen} onPress={() => setStripOpen(open => !open)} variant="surface">
        <span className="status-pill-date-text"><UiIcon sheet="resource" cell={SEASON_ICON[stateCalendar(state).season]} />{calendarLabel(state)}</span>
        <SeasonStripMini tick={state.tick} />
      </Button>
      {stripOpen ? <SeasonStripPanel state={state} food={{ days: model.foodDays, untilTick: model.foodUntilTick }} onClose={() => setStripOpen(false)} /> : null}
      <Button type="button" className="status-pill-cell" aria-label={HUD_COPY.populationOpens} onPress={() => onOpenPopulation()} variant="surface">
        <UiIcon sheet="resource" cell="population" />{HUD_COPY.population(model.population)}
      </Button>
      <Button type="button" className="status-pill-cell" aria-label={HUD_COPY.pillOpensLedger} data-food-days={model.foodDays ?? ""} onPress={() => onOpenLedger()}
        data-short={model.foodDays !== null && model.foodDays < 14 ? "true" : undefined} variant="surface">
        <UiIcon sheet="resource" cell="bread" />{model.foodDays === null ? HUD_COPY.foodNone : HUD_COPY.foodDays(model.foodDays)}
      </Button>
      <Button type="button" className="status-pill-cell" aria-label={HUD_COPY.pillOpensLedger} onPress={() => onOpenLedger()} variant="surface">
        <UiIcon sheet="resource" cell="coin" />{HUD_COPY.money(model.coin)}
      </Button>
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
          <Button key={item} type="button" className={`control-layer${item === "zone" ? " build-menu-category" : ""}${open ? "" : " control-layer--locked"}`}
            aria-pressed={layer === item} aria-disabled={!open} data-layer={item}
            data-pulse={pulse !== null && pulse.key === `layer:${item}` ? `${pulse.key}#${pulse.nonce}` : undefined}
            onPress={() => {
              if (!open) { setNote(HUD_COPY.layerLocked(TUTORIAL_COPY.layers[item], TUTORIAL_COPY.lockedLayer[item === "direction" ? "direction" : "zone"])); return; }
              setNote(null); onChange(item);
            }} variant="toggle">
            <UiIcon sheet="layer" cell={item} />{TUTORIAL_COPY.layers[item]}{open ? null : <UiIcon sheet="lock" cell="locked" className="control-layer-lock" />}
          </Button>
        );
      })}
      {note === null ? null : <p className="layer-switch-note" role="status"><UiIcon sheet="lock" cell="locked" />{note}</p>}
    </div>
  );
}

export function ActionDock({ buildOpen, ledgerOpen, onBuild, onLedger, advisor, onDismissAdvisor, undo, hidden = false, stewardName = null }: {
  readonly hidden?: boolean;
  /** UI-5: the steward is a person (PERSON-0): his name beside the P0 portrait's three expressions. */
  readonly stewardName?: string | null;
  readonly buildOpen: boolean; readonly ledgerOpen: boolean; readonly onBuild: () => void; readonly onLedger: () => void;
  readonly advisor: TutorialController["advisor"]; readonly onDismissAdvisor: () => void;
  /** The newest site can be taken back (the tutorial points at it after the well). */
  readonly undo: { readonly enabled: boolean; readonly attention: boolean; readonly label: string; readonly onUndo: () => void };
}) {
  const [stewardOpen, setStewardOpen] = useState(false);
  const speaking = advisor !== null;
  // UX3R 7: a new line shows as one line above the button for STEWARD_LINE_MS, then folds; the marked button opens it
  // in full (with its dismiss) until it is answered.
  const [expanded, setExpanded] = useState(false);
  const [fresh, setFresh] = useState(true);
  const advisorKey = advisor?.key ?? null;
  useEffect(() => {
    setExpanded(false); setFresh(true);
    if (advisorKey === null) return undefined;
    const timer = window.setTimeout(() => setFresh(false), STEWARD_LINE_MS);
    return () => window.clearTimeout(timer);
  }, [advisorKey]);
  return (
    <nav className="action-dock" aria-label={HUD_COPY.dock} hidden={hidden}>
      {undo.enabled ? <Button type="button" className="hud-undo action-dock-small" aria-label={undo.label} data-attention={undo.attention ? "true" : undefined}
        onPress={() => undo.onUndo()} variant="secondary"><UiIcon sheet="action" cell="up" />{HUD_COPY.undo}</Button> : null}
      <Button type="button" className="action-dock-button" aria-expanded={buildOpen} data-dock="build" onPress={() => onBuild()} variant="secondary">
        <UiIcon sheet="category" cell="living" size={32} />{HUD_COPY.build}
      </Button>
      <Button type="button" className="action-dock-button" aria-expanded={ledgerOpen} data-dock="ledger" onPress={() => onLedger()} variant="secondary">
        <UiIcon sheet="action" cell="log" size={32} />{HUD_COPY.ledger}
      </Button>
      <Button type="button" className="action-dock-button" data-dock="steward" aria-expanded={stewardOpen || speaking} data-speaking={speaking ? "true" : undefined}
        aria-label={stewardName === null ? undefined : PERSONS_COPY.steward(stewardName)}
        onPress={() => { if (speaking) setExpanded(open => !open); else setStewardOpen(open => !open); }} variant="secondary">
        <span className="action-dock-portrait" aria-hidden="true" style={stewardPortraitStyle(advisor?.tone ?? "neutral")} />{HUD_COPY.steward}
      </Button>
      {speaking && (fresh || expanded) ? <aside className={`steward-advisor steward-bubble steward-advisor--${advisor.tone}${expanded ? "" : " steward-bubble--line"}`}
        aria-label={stewardName === null ? TUTORIAL_COPY.stewardName : PERSONS_COPY.steward(stewardName)} data-advisor={advisor.key} data-tone={advisor.tone}>
        {expanded && stewardName !== null ? <p className="steward-name">{PERSONS_COPY.steward(stewardName)}</p> : null}
        <p className="steward-line">{advisor.text}</p>
        {expanded ? <Button type="button" className="steward-button" onPress={() => onDismissAdvisor()} variant="primary">{TUTORIAL_COPY.advisorButton}</Button> : null}
      </aside> : speaking ? null : stewardOpen ? <aside className="steward-bubble" role="status"><p className="steward-line">{HUD_COPY.stewardQuiet}</p></aside> : null}
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
        <Button key={row.id} type="button" className={`crisis-icon alert-stack-inspect crisis-icon--${row.severity}`} aria-label={HUD_COPY.crisisLabel(ALERT_STACK_COPY.inspectLabel(row.title), row.cause)}
          onPress={() => { const first = row.targetIds[0]; if (first === undefined) return; platformServices().input.emit(alertRowLookAtIntent(row)); onInspect(first); }} variant="icon">
          {/* UI-3: the Wave 8 alert bells (threat = immediate, bad = caution). */}
          <span className="crisis-bell" aria-hidden="true" style={wave8ImageStyle(row.severity === "immediate" ? "icon_alert_bell_threat" : "icon_alert_bell_bad", 32)} />
        </Button>
      ))}
    </section>
  );
}

type LedgerTab = "stock" | "alerts" | "view" | "map";
/**
 * Ledger drawer (S-26): resource x storage with the total, this week's change and (for food) how long it lasts; a
 * row lights the buildings holding it on the map, a column head opens that store's inspector (UX-3R2). Alerts,
 * overlays and the map are its other tabs.
 */
export function LedgerDrawer({ state, onInspect, onClose, viewTab, mapTab, history = null, food = { days: null }, highlighted = [], onHighlight, onOpenChronicle }: {
  readonly state: GameState; readonly onInspect: (id: string) => void; readonly onClose: () => void;
  readonly viewTab: ReactNode; readonly mapTab: ReactNode;
  /** CHRON-1: the [연대기] tab opens the chronicle screen (a modal: time stops). */
  readonly onOpenChronicle?: () => void;
  readonly history?: StoreStockHistory | null; readonly food?: { readonly days: number | null };
  readonly highlighted?: readonly string[]; readonly onHighlight?: (ids: readonly string[]) => void;
}) {
  const [tab, setTab] = useState<LedgerTab>("stock");
  const matrix = ledgerMatrix(state);
  const alerts = alertStackRows(state);
  return (
    <section className="ledger-drawer slot-panel" aria-label={HUD_COPY.ledgerTitle}>
      <header className="slot-panel-heading"><h2>{HUD_COPY.ledgerTitle}</h2>
        <Button type="button" className="slot-panel-close" aria-label={HUD_COPY.close} onPress={() => onClose()} variant="icon">{HUD_COPY.closeMark}</Button></header>
      <div className="ledger-tabs">
        <div className="ledger-tab-list" role="tablist">
          {(Object.keys(HUD_COPY.ledgerTabs) as LedgerTab[]).map(key => (
            <Button key={key} type="button" role="tab" aria-selected={tab === key} className="ledger-tab" onPress={() => setTab(key)} variant="tab">{HUD_COPY.ledgerTabs[key]}</Button>
          ))}
        </div>
        {/* CHRON-1: not a tab of the drawer — it opens the chronicle screen over it. */}
        {onOpenChronicle === undefined ? null : <Button type="button" className="ledger-tab ledger-tab--chronicle" aria-haspopup="dialog"
          aria-label={CHRONICLE_SCREEN_COPY.ledgerTabLabel} data-ledger-chronicle="open" onPress={() => onOpenChronicle()} variant="tab">{CHRONICLE_SCREEN_COPY.ledgerTab}</Button>}
      </div>
      {tab === "stock" ? (matrix.rows.length === 0 ? <p>{HUD_COPY.ledgerEmpty}</p> : (
        // UX-0b: at 1280 the store columns pushed the total, the week and the lasts out of the drawer; they come first now.
        <div className="ledger-matrix-scroll"><table className="ledger-matrix">
          <thead><tr><th scope="col" /><th scope="col">{HUD_COPY.ledgerTotal}</th><th scope="col">{HUD_COPY.ledgerWeek}</th><th scope="col">{HUD_COPY.ledgerLasts}</th>
            {matrix.stores.map(store => (
            <th key={store.id} scope="col"><Button type="button" className="ledger-store" onPress={() => onInspect(store.id)} variant="secondary">
              {HUD_COPY.ledgerStore(BUILDING_CONFIG_BY_KIND[store.kind as BuildingKind].name, store.index)}</Button></th>))}</tr></thead>
          <tbody>{matrix.rows.map(row => {
            const holders = matrix.stores.filter((_store, index) => (row.byStore[index] ?? 0) > 0).map(store => store.id);
            const lit = holders.length > 0 && holders.every(id => highlighted.includes(id)) && highlighted.length === holders.length;
            const week = history === null ? null : weeklyTotalChange(history, row.resource, state);
            const lasts = resourceEntry(row.resource).group === "food" && food.days !== null ? HUD_COPY.ledgerDays(food.days) : HUD_COPY.ledgerNoLasts;
            return (
            <tr key={row.resource} data-resource={row.resource} data-lit={lit ? "true" : undefined}>
              <th scope="row"><Button type="button" className="ledger-row" aria-pressed={lit} aria-label={HUD_COPY.ledgerRowLabel(resourceName(row.resource))}
                onPress={() => onHighlight?.(lit ? [] : holders)} variant="surface">{resourceName(row.resource)}</Button></th>
              <td className="ledger-total">{row.total}</td><td className="ledger-week">{HUD_COPY.ledgerWeekValue(week)}</td><td className="ledger-lasts">{lasts}</td>
              {row.byStore.map((amount, index) => <td key={matrix.stores[index]!.id}>{amount === 0 ? "—" : amount}</td>)}</tr>);
          })}</tbody>
        </table></div>)) : null}
      {/* UI-4 (FC-4): the lord's grants, one line each (the petition's result). */}
      {tab === "stock" && (state.politics?.rights.length ?? 0) > 0 ? <section className="ledger-rights" aria-label={DECISION_COPY.rightsHeading}>
        <h3>{DECISION_COPY.rightsHeading}</h3>
        <ul>{state.politics!.rights.map(right => <li key={right.id}>{DECISION_COPY.right(right.holder, right.stallFeePermille)}</li>)}</ul>
      </section> : null}
      {tab === "alerts" ? (alerts.length === 0 ? <p>{HUD_COPY.ledgerNoAlerts}</p> : <ul className="ledger-alerts">{alerts.map(row => (
        <li key={row.id}><strong>{row.title}</strong> · {row.countLabel}<br /><span>{row.cause}</span>
          <Button type="button" className="ledger-alert-look" onPress={() => { const first = row.targetIds[0]; if (first !== undefined) { platformServices().input.emit(alertRowLookAtIntent(row)); onInspect(first); } }} variant="secondary">
            <UiIcon sheet="action" cell="look" />{ALERT_STACK_COPY.inspect}</Button></li>))}</ul>) : null}
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
        <Button type="button" className="pause-menu-resume" onPress={() => onResume()} variant="primary"><UiIcon sheet="time" cell="play" />{HUD_COPY.pauseResume}</Button>
        <div className="pause-menu-settings">{settings}</div>
      </section>
    </div>
  );
}
