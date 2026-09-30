import { wave8Url } from "../wave8Art";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { stewardPortraitStyle } from "../uiArt";
import { UiIcon } from "../UiIcon";
import { TUTORIAL_COPY } from "./tutorialCopy.ko";
import type { GoalCard, TutorialController } from "./useTutorialController";
import { Button, Disclosure } from "../kit";
import { PAD_HINT_COPY } from "../inputHintCopy.ko";
import { PadHint } from "../PadGlyph";
import { useInputDevice } from "../useInputDevice";

// UX-1 shell pieces (research E "Objective card / Advisor / Highlight"): goal cards (title 18 px, progress and bar, a
// reason of at most two lines, one button, `?` help; at most two on screen), the steward (96 px portrait slot, one
// line, one button), the unlock banner, the pause veil and the goal drawer. UX-2 dresses them in the P0 art (frames in
// src/styles/uiSkin.css, painted icons through UiIcon, the steward's portrait by the line's tone).

export function GoalCards({ tutorial, onToggleDrawer, drawerOpen, warn = false, maxActive }: {
  readonly tutorial: TutorialController;
  readonly onToggleDrawer: () => void;
  readonly drawerOpen: boolean;
  /** UX-2: an immediate warning stands in the town (the warning frame on the active cards). */
  readonly warn?: boolean;
  /** UX-3 S-80: at most this many active cards (the most urgent first); finished cards still flash. */
  readonly maxActive?: number;
}) {
  // The lean-season warning (UI-3) outranks the other goal cards; otherwise the controller's order stands.
  const active = tutorial.cards.filter(card => card.status === "active")
    .sort((a, b) => Number(b.key === "lean_season") - Number(a.key === "lean_season"));
  const shown = maxActive === undefined ? tutorial.cards
    : tutorial.cards.filter(card => card.status !== "active" || active.indexOf(card) < maxActive);
  return (
    <section className="goal-cards" aria-label={TUTORIAL_COPY.cardsLabel}>
      {shown.map(card => <GoalCardView key={card.key} card={card} warn={warn} onPress={() => tutorial.press(card.key)} onLook={tutorial.lookAt} />)}
      <Button type="button" className="goal-drawer-toggle" aria-expanded={drawerOpen} onPress={() => onToggleDrawer()} variant="toggle">
        <UiIcon sheet="action" cell="log" /><span className="goal-drawer-toggle-label">{TUTORIAL_COPY.drawer}{tutorial.log.length > 0 ? ` (${tutorial.log.length})` : ""}</span>
      </Button>
    </section>
  );
}

/** UI-6c: how long a foldable card stays open after its next goal changes, before it folds back to its chip. */
export const GOAL_CARD_UNFOLD_MS = 8_000;

function GoalCardView({ card, warn, onPress, onLook }: { readonly card: GoalCard; readonly warn: boolean; readonly onPress: () => void; readonly onLook: () => void }) {
  if (card.status === "active" && card.foldKey !== undefined) return <FoldableGoalCard card={card} warn={warn} onPress={onPress} onLook={onLook} />;
  return <GoalCardBody card={card} warn={warn} onPress={onPress} onLook={onLook} />;
}

/**
 * UI-6c: the chapter's goal card as a one-line chip (title and count, a button) that opens to the reason and its button
 * when pressed or for a while when the next goal changes (not on mount: the chapter screen has just shown the goals).
 */
function FoldableGoalCard({ card, warn, onPress, onLook }: { readonly card: GoalCard; readonly warn: boolean; readonly onPress: () => void; readonly onLook: () => void }) {
  const [open, setOpen] = useState(false);
  const seen = useRef(card.foldKey);
  useEffect(() => {
    if (seen.current === card.foldKey) return undefined;
    seen.current = card.foldKey;
    setOpen(true);
    const timer = window.setTimeout(() => setOpen(false), GOAL_CARD_UNFOLD_MS);
    return () => window.clearTimeout(timer);
  }, [card.foldKey]);
  const count = card.progress === null ? null : TUTORIAL_COPY.progress(card.progress.current, card.progress.target);
  // UI-AUDIT-1: at 1280 px and below the folded chip shows its short form (the goal icon, "2장", the count; CSS picks
  // the form); its name stays the whole title and count.
  const chip = (
    <Button type="button" className="goal-card-fold" aria-expanded={open} onPress={() => setOpen(value => !value)} variant="toggle"
      aria-label={card.shortTitle === undefined ? undefined : count === null ? card.title : `${card.title} ${count}`}>
      <span className="goal-card-title goal-card-title--full">{card.title}</span>
      {card.shortTitle === undefined ? null : <span className="goal-card-short"><UiIcon sheet="action" cell="open" />{card.shortTitle}</span>}
      {count === null ? null : <span className="goal-card-count">{count}</span>}
    </Button>
  );
  if (!open) return <article className={warn ? "goal-card goal-card--folded goal-card--warn" : "goal-card goal-card--folded"} data-frame="objective" data-goal-card={card.key} data-folded="true">{chip}</article>;
  return <GoalCardBody card={card} warn={warn} onPress={onPress} onLook={onLook} heading={chip} />;
}

function GoalCardBody({ card, warn, onPress, onLook, heading }: { readonly card: GoalCard; readonly warn: boolean; readonly onPress: () => void; readonly onLook: () => void; readonly heading?: ReactNode }) {
  if (card.status !== "active") {
    return (
      <article className={`goal-card goal-card--${card.status}`} data-frame="objective" data-goal-card={card.key} role="status">
        <h3 className="goal-card-title">{card.title}</h3>
        <p className="goal-card-status"><UiIcon sheet="prediction" cell="ok" />{card.status === "already" ? TUTORIAL_COPY.alreadyDone : TUTORIAL_COPY.done}</p>
      </article>
    );
  }
  const ratio = card.progress === null ? null : card.progress.target === 0 ? 1 : Math.min(1, card.progress.current / card.progress.target);
  return (
    <article className={`${warn ? "goal-card goal-card--warn" : "goal-card"}${heading === undefined ? "" : " goal-card--unfolded"}`} data-frame="objective" data-goal-card={card.key}>
      {heading ?? <header className="goal-card-heading">
        <h3 className="goal-card-title">{card.title}</h3>
        {card.progress === null ? null : <span className="goal-card-count">{TUTORIAL_COPY.progress(card.progress.current, card.progress.target)}</span>}
      </header>}
      {ratio === null ? null : <span className="goal-card-bar" aria-hidden="true"><span style={{ width: `${Math.round(ratio * 100)}%` }} /></span>}
      {card.why === "" ? null : <p className="goal-card-why">{card.why}</p>}
      <div className="goal-card-actions">
        {card.ctaLabel === null ? null : <Button type="button" className="goal-card-cta" data-tutorial-cta={card.key} onPress={() => onPress()} variant="primary">{card.ctaLabel}</Button>}
        {card.hasTarget ? <Button type="button" className="goal-card-secondary" onPress={() => onLook()} variant="secondary"><UiIcon sheet="action" cell="look" />{TUTORIAL_COPY.lookHere}</Button> : null}
        {card.help === null ? null : <Disclosure className="goal-card-help" variant="icon" summaryLabel={TUTORIAL_COPY.help} summary={<UiIcon sheet="lock" cell="help" size={32} />}><p data-frame="tooltip">{card.help}</p></Disclosure>}
      </div>
    </article>
  );
}

export function StewardAdvisor({ advisor, onDismiss }: { readonly advisor: TutorialController["advisor"]; readonly onDismiss: () => void }) {
  if (advisor === null) return null;
  return (
    <aside className={`steward-advisor steward-advisor--${advisor.tone}`} aria-label={TUTORIAL_COPY.stewardName} data-advisor={advisor.key} data-tone={advisor.tone}>
      <span className="steward-portrait" aria-hidden="true"><span className="steward-portrait-face" style={stewardPortraitStyle(advisor.tone)} /></span>
      <div className="steward-body">
        <strong className="steward-name">{TUTORIAL_COPY.stewardName}</strong>
        <p className="steward-line">{advisor.text}</p>
        <Button type="button" className="steward-button" onPress={() => onDismiss()} variant="primary">{TUTORIAL_COPY.advisorButton}</Button>
      </div>
    </aside>
  );
}

export function UnlockBanner({ text }: { readonly text: string | null }) {
  if (text === null) return null;
  return <div className="unlock-banner" data-frame="banner" role="status"><UiIcon sheet="lock" cell="new" size={32} />{text}</div>;
}

export function PauseVeil({ paused }: { readonly paused: boolean }) {
  const device = useInputDevice();
  if (!paused) return null;
  // UI-3: the Wave 8 pause vignette over the map and the hourglass badge behind the label.
  return <div className="pause-veil" aria-hidden="false" style={{ backgroundImage: `url("${wave8Url("pause_vignette")}")` }}>
    <span className="pause-veil-label" data-frame="pause-badge" role="status" data-input-device={device} style={{ backgroundImage: `url("${wave8Url("pause_badge")}")` }}>
      {/* INSTALL-23 ⑤: the pad's pause buttons as glyphs; the keyboard's Space in words. */}
      {device === "gamepad" ? <PadHint parts={PAD_HINT_COPY.paused} /> : TUTORIAL_COPY.paused}</span></div>;
}

export function GoalDrawer({ open, log, children }: { readonly open: boolean; readonly log: TutorialController["log"]; readonly children?: ReactNode }) {
  return (
    <section className="goal-drawer" data-frame="light" hidden={!open} aria-label={TUTORIAL_COPY.drawer}>
      {log.length === 0 ? <p className="goal-drawer-empty">{TUTORIAL_COPY.drawerEmpty}</p>
        : <ol className="goal-drawer-log">{log.map(item => <li key={item.id}>{item.title} <span><UiIcon sheet="prediction" cell="ok" />{item.already ? TUTORIAL_COPY.alreadyDone : TUTORIAL_COPY.done}</span></li>)}</ol>}
      {children}
    </section>
  );
}

/** The tutorial on / off switch (welcome and settings); it stops its own clicks so the welcome's click-anywhere does not start the game. */
export function TutorialToggle({ enabled, onChange }: { readonly enabled: boolean; readonly onChange: (enabled: boolean) => void }) {
  return (
    <div className="tutorial-toggle">
      <Button type="button" role="switch" aria-checked={enabled} className="tutorial-switch" isolate
        onPress={() => onChange(!enabled)} variant="toggle">
        {TUTORIAL_COPY.tutorialToggle} {enabled ? TUTORIAL_COPY.tutorialOn : TUTORIAL_COPY.tutorialOff}
      </Button>
      {enabled ? null : <small>{TUTORIAL_COPY.tutorialOffNote}</small>}
    </div>
  );
}
