import { useEffect, useState, type ReactNode } from "react";

import type { GameState } from "../../engine/engine.types";
import { calendarLabel, stateCalendar } from "../../engine/scenarioState";
import { platformServices } from "../../platform/platform";
import { alertRowLookAtIntent, alertStackRows } from "../alertStackModel";
import { ALERT_STACK_COPY } from "../alertStackCopy.ko";
import { stewardPortraitStyle } from "../uiArt";
import { UiIcon } from "../UiIcon";
import { ResourceGlyph } from "../ResourceArtwork";
import { TUTORIAL_COPY } from "../tutorial/tutorialCopy.ko";
import type { TutorialController } from "../tutorial/useTutorialController";
import type { ControlLayer } from "../tutorial/tutorialModel";
import { HUD_COPY } from "./hudCopy.ko";
import { SeasonStripMini, SeasonStripPanel } from "./SeasonStrip";
import { SEASON_STRIP_COPY } from "../seasonStripCopy.ko";
import { wave8ImageStyle } from "../wave8Art";
import { ledgerMatrix, statusPillModel } from "./statusPillModel";
import type { StoreStockHistory } from "../storeStockHistory";
import { LedgerStockTable } from "./LedgerStockTable";
import { CHRONICLE_SCREEN_COPY } from "../chronicle/chronicleScreenCopy.ko";
import { PERSONS_COPY } from "../persons/personsCopy.ko";
import { PersonList } from "../persons/PersonViews";
import { Button } from "../kit";
import { EmblemImage } from "../heraldry/EmblemImage";
import { LORDSHIP_COPY } from "../lordshipCopy.ko";
import { lordshipView, type LordshipView } from "../lordshipModel";
import { wave14FrameStyle, wave14ImageStyle } from "../wave14Art";
import { townAleView } from "../townAleModel";
import { TOWN_ALE_COPY } from "../townAleCopy.ko";
import { townClothView } from "../townClothModel";
import { TOWN_CLOTH_COPY } from "../townClothCopy.ko";
import { wageLedgerView } from "./wageLedgerModel";
import { WAGE_LEDGER_COPY } from "./wageLedgerCopy.ko";
// UI-9: chapter 4 reorganisation ledger (RG-3, RG-6, RG-9) and revolt pressure on the rights tab (RG-8).
import { reorgLedgerView } from "./reorgLedgerModel";
import { legacyLedgerView } from "./legacyLedgerModel";
import { LEGACY_LEDGER_COPY } from "./legacyLedgerCopy.ko";
import { REORG_LEDGER_COPY } from "./reorgLedgerCopy.ko";
import { FACTION_INFLUENCE_COPY as INFLUENCE } from "../chronicle/factionInfluenceCopy.ko";

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

/**
 * Crisis icons (S-33): outside the slot, at most three, only while something is wrong; a tap looks at and inspects it.
 * UI-AUDIT-1: `lead` (the stuck-goods chip) sits left of the bells in the same row.
 */
export function CrisisIcons({ rows: all, onInspect, lead = null }: { readonly rows: ReturnType<typeof alertStackRows>; readonly onInspect: (id: string) => void;
  readonly lead?: ReactNode }) {
  const rows = all.slice(0, 3);
  if (rows.length === 0 && lead === null) return null;
  return (
    <section className="crisis-icons" aria-label={HUD_COPY.crisis}>
      {lead}
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

type LedgerTab = "stock" | "alerts" | "rights" | "view" | "map";
/**
 * Ledger drawer (S-26): resource x storage with the total, this week's change and (for food) how long it lasts; a
 * row lights the buildings holding it on the map, a column head opens that store's inspector (UX-3R2). Alerts,
 * overlays and the map are its other tabs.
 */
/**
 * UI-6 (FAIL-3, F2-A): the rights tab — Wave 14's rights register frame, the house's arms, each right with its icon.
 * UI-7: under the house, its household (the lord's family and the steward), each chip opening the person card.
 */
export function RightsRegister({ view, onPerson }: { readonly view: LordshipView; readonly onPerson: ((personId: string) => void) | undefined }) {
  return (
    <section className="ledger-rights" aria-label={LORDSHIP_COPY.heading} style={wave14FrameStyle("frame_rights_register")}>
      {/* The register is a book open on two pages: the house (its arms, title, a decline) on the left, its rights, what it
          granted and the war on the right. */}
      <div className="ledger-rights-page">
      <header className="ledger-rights-house">
        <EmblemImage emblem={view.arms} size={44} label={view.armsLabel} />
        <div><p className="ledger-rights-house-name">{view.house}</p><p>{view.title}{view.demoted === null ? null : <> · <span className="ledger-rights-lost">{view.demoted}</span></>}</p>
          {view.pastHouses === null ? null : <p>{view.pastHouses}</p>}</div>
      </header>
      {view.seat === null ? null : <p className="ledger-rights-seat">{view.seat}</p>}
      {view.household.length === 0 ? null : <section className="ledger-rights-household" aria-label={PERSONS_COPY.lordHouseholdHeading}>
        <h4>{PERSONS_COPY.lordHouseholdHeading}</h4><PersonList rows={view.household} onOpen={onPerson} /></section>}
      {view.decline === null ? null : <p className="ledger-rights-lost" role="status">{view.decline}</p>}
      {view.war.length === 0 ? null : <><h4>{LORDSHIP_COPY.warHeading}</h4><ul>{view.war.map(line => <li key={line}>{line}</li>)}</ul></>}
      </div>
      <div className="ledger-rights-page">
      <h4>{LORDSHIP_COPY.rightsHeading}</h4>
      <ul className="ledger-rights-list">{view.rights.map(right => (
        <li key={right.id} data-right={right.id} data-lost={right.lost ? "true" : undefined} data-present={right.present ? "true" : "false"}>
          <span aria-hidden="true" style={wave14ImageStyle(right.icon, 32)} /><strong>{right.name}</strong>
          <span className={right.lost ? "ledger-rights-lost" : undefined}>{right.status}{right.since === null ? "" : ` · ${right.since}`}</span></li>))}</ul>
      {view.granted.length === 0 ? null : <><h4>{LORDSHIP_COPY.grantedHeading}</h4><ul>{view.granted.map(line => <li key={line}>{line}</li>)}</ul></>}
      {/* UI-9: RG-7 rights moved to the town in chapter 4 (market_tolls, bridge_tolls via borough_charter). */}
      {view.rightsTransfer.length === 0 ? null : (
        <><h4>{LORDSHIP_COPY.rightsTransferHeading}</h4>
        <ul>{view.rightsTransfer.map(r => <li key={r.id}>{r.line}</li>)}</ul></>
      )}
      {/* UI-9: RG-8 revolt pressure on the rights tab, chapter 4 only. */}
      {view.revoltPressure !== null ? (
        <section className="ledger-rights-pressure" aria-label={INFLUENCE.pressureHeading}>
          <h4>{INFLUENCE.pressureHeading}</h4>
          <p>{view.revoltPressure.totalLabel}</p>
          <p className="ledger-rights-threshold">{view.revoltPressure.thresholdLine}</p>
          {view.revoltPressure.causes.length > 0
            ? <ul>{view.revoltPressure.causes.map(c => <li key={c.key}>{c.line}</li>)}</ul>
            : null}
          {view.revoltPressure.outcome !== null
            ? <p>{view.revoltPressure.outcome}</p>
            : null}
        </section>
      ) : null}
      </div>
    </section>
  );
}

export function LedgerDrawer({ state, onInspect, onClose, viewTab, mapTab, history = null, food = { days: null }, highlighted = [], onHighlight, onOpenChronicle, onPerson }: {
  readonly state: GameState; readonly onInspect: (id: string) => void; readonly onClose: () => void;
  readonly viewTab: ReactNode; readonly mapTab: ReactNode;
  /** CHRON-1: the [연대기] tab opens the chronicle screen (a modal: time stops). */
  readonly onOpenChronicle?: () => void;
  /** UI-7: a person of the lord's household (the rights tab) opens their person card. */
  readonly onPerson?: (personId: string) => void;
  readonly history?: StoreStockHistory | null; readonly food?: { readonly days: number | null };
  readonly highlighted?: readonly string[]; readonly onHighlight?: (ids: readonly string[]) => void;
}) {
  const [tab, setTab] = useState<LedgerTab>("stock");
  const matrix = ledgerMatrix(state);
  const alerts = alertStackRows(state);
  const townAle = townAleView(state);
  const townCloth = townClothView(state);
  const wageLedger = wageLedgerView(state);
  // UI-9: RG-3/RG-6/RG-9 chapter 4 reorganisation ledger — null before chapter 4 starts.
  const reorgLedger = reorgLedgerView(state);
  // UI-10: LG-2…LG-5 chapter 5 ledger — null before chapter 5 starts.
  const legacyLedger = legacyLedgerView(state);
  return (
    <section className="ledger-drawer slot-panel" aria-label={HUD_COPY.ledgerTitle}>
      <header className="slot-panel-heading"><h2>{HUD_COPY.ledgerTitle}</h2>
        <Button type="button" className="slot-panel-close" aria-label={HUD_COPY.close} onPress={() => onClose()} variant="icon">{HUD_COPY.closeMark}</Button></header>
      <div className="ledger-tabs">
        <div className="ledger-tab-list" role="tablist">
          {(Object.keys(HUD_COPY.ledgerTabs) as LedgerTab[]).map(key => (
            <Button key={key} data-ledger-tab={key} type="button" role="tab" aria-selected={tab === key} className="ledger-tab" onPress={() => setTab(key)} variant="tab">{HUD_COPY.ledgerTabs[key]}</Button>
          ))}
        </div>
        {/* CHRON-1: not a tab of the drawer — it opens the chronicle screen over it. */}
        {onOpenChronicle === undefined ? null : <Button type="button" className="ledger-tab ledger-tab--chronicle" aria-haspopup="dialog"
          aria-label={CHRONICLE_SCREEN_COPY.ledgerTabLabel} data-ledger-chronicle="open" onPress={() => onOpenChronicle()} variant="tab">{CHRONICLE_SCREEN_COPY.ledgerTab}</Button>}
      </div>
      {tab === "stock" ? (matrix.rows.length === 0 ? <p>{HUD_COPY.ledgerEmpty}</p> : (
        // UX-0b: the total, the week and the lasts first; NAT-2 (QA-006): the stores folded into one column (LedgerStockTable).
        <LedgerStockTable state={state} matrix={matrix} history={history} food={food} highlighted={highlighted} onHighlight={onHighlight} onInspect={onInspect} />)) : null}
      {/* ECON-UI (FIX-7 townAle): the town's ale — kept in the houses, never in a store, so not in the table above. */}
      {tab === "stock" && townAle !== null ? <section className="ledger-town-ale" aria-label={TOWN_ALE_COPY.heading}>
        <h3><ResourceGlyph resource="ale" />{TOWN_ALE_COPY.heading}</h3>
        {[townAle.stock, townAle.houses, townAle.served, townAle.thisSeason, ...(townAle.lastSeason === null ? [] : [townAle.lastSeason])].map(line => <p key={line}>{line}</p>)}
      </section> : null}
      {/* C5 (CL-10 townCloth): the cloth chain — sheep, spinning houses, chain buildings and closed-season money. */}
      {tab === "stock" && townCloth !== null ? <section className="ledger-town-cloth" aria-label={TOWN_CLOTH_COPY.heading}>
        <h3><ResourceGlyph resource="fleece" />{TOWN_CLOTH_COPY.heading}</h3>
        {[townCloth.sheep, townCloth.spinningHouses, ...(townCloth.buildings.length > 0 ? [townCloth.buildings] : []),
          ...(townCloth.closedSeason !== null ? [townCloth.closedSeason] : [])].map(line => <p key={line}>{line}</p>)}
      </section> : null}
      {/* UI-8 (F3-A): wage ledger — plague labour costs by category, shown only once chapter 3's plague arrives. */}
      {tab === "stock" && wageLedger !== null ? <section className="ledger-wage-ledger" aria-label={WAGE_LEDGER_COPY.heading}>
        <h3>{WAGE_LEDGER_COPY.heading}</h3>
        <div className="ledger-matrix-scroll"><table className="ledger-matrix">
          <thead><tr><th scope="col">{WAGE_LEDGER_COPY.category}</th><th scope="col">{WAGE_LEDGER_COPY.thisSeason}</th><th scope="col">{WAGE_LEDGER_COPY.lastSeason}</th><th scope="col">{WAGE_LEDGER_COPY.chapterTotal}</th></tr></thead>
          <tbody>{wageLedger.rows.map(row => <tr key={row.category}><th scope="row">{row.label}</th>{row.shown.map((amount, index) => <td key={index}>{amount}</td>)}</tr>)}</tbody>
        </table></div>
      </section> : null}
      {/* UI-9: RG-3/RG-6/RG-9 chapter 4 reorganisation ledger — cloth income, poll tax and fee farm by category. */}
      {tab === "stock" && reorgLedger !== null ? <section className="ledger-wage-ledger" aria-label={REORG_LEDGER_COPY.heading}>
        <h3>{REORG_LEDGER_COPY.heading}</h3>
        <div className="ledger-matrix-scroll"><table className="ledger-matrix">
          <thead><tr><th scope="col">{REORG_LEDGER_COPY.category}</th><th scope="col">{REORG_LEDGER_COPY.thisSeason}</th><th scope="col">{REORG_LEDGER_COPY.lastSeason}</th><th scope="col">{REORG_LEDGER_COPY.chapterTotal}</th></tr></thead>
          <tbody>{reorgLedger.rows.map(row => <tr key={row.category}><th scope="row">{row.label}</th>{row.shown.map((amount, index) => <td key={index}>{amount}</td>)}</tr>)}</tbody>
        </table></div>
      </section> : null}
      {/* UI-10: chapter 5's money — the Crown's tax, the relief, the endowment, the charter fee, the nave, the fee farm. */}
      {tab === "stock" && legacyLedger !== null ? <section className="ledger-wage-ledger ledger-legacy-ledger" aria-label={LEGACY_LEDGER_COPY.heading}>
        <h3>{LEGACY_LEDGER_COPY.heading}</h3>
        <div className="ledger-matrix-scroll"><table className="ledger-matrix">
          <thead><tr><th scope="col">{LEGACY_LEDGER_COPY.category}</th><th scope="col">{LEGACY_LEDGER_COPY.thisSeason}</th><th scope="col">{LEGACY_LEDGER_COPY.lastSeason}</th><th scope="col">{LEGACY_LEDGER_COPY.chapterTotal}</th></tr></thead>
          <tbody>{legacyLedger.rows.map(row => <tr key={row.category}><th scope="row">{row.label}</th>{row.shown.map((amount, index) => <td key={index}>{amount}</td>)}</tr>)}</tbody>
        </table></div>
      </section> : null}
      {/* UI-6: the rights register (the house, its arms, the title, the lord's rights and the ones he granted, the war). */}
      {tab === "rights" ? <RightsRegister view={lordshipView(state)} onPerson={onPerson} /> : null}
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
