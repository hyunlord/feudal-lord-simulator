import type { ReactNode } from "react";
import { stewardPortraitStyle } from "../uiArt";
import { UiIcon } from "../UiIcon";
import { TUTORIAL_COPY } from "./tutorialCopy.ko";
import type { GoalCard, TutorialController } from "./useTutorialController";

// UX-1 shell pieces (research E "Objective card / Advisor / Highlight"): goal cards (title 18 px, progress and bar, a
// reason of at most two lines, one button, `?` help; at most two on screen), the steward (96 px portrait slot, one
// line, one button), the unlock banner, the pause veil and the goal drawer. UX-2 dresses them in the P0 art (frames in
// src/styles/uiSkin.css, painted icons through UiIcon, the steward's portrait by the line's tone).

export function GoalCards({ tutorial, onToggleDrawer, drawerOpen, warn = false }: {
  readonly tutorial: TutorialController;
  readonly onToggleDrawer: () => void;
  readonly drawerOpen: boolean;
  /** UX-2: an immediate warning stands in the town (the warning frame on the active cards). */
  readonly warn?: boolean;
}) {
  return (
    <section className="goal-cards" aria-label={TUTORIAL_COPY.cardsLabel}>
      {tutorial.cards.map(card => <GoalCardView key={card.key} card={card} warn={warn} onPress={() => tutorial.press(card.key)} onLook={tutorial.lookAt} />)}
      <button type="button" className="goal-drawer-toggle" aria-expanded={drawerOpen} onClick={() => onToggleDrawer()}>
        <UiIcon sheet="action" cell="log" /><span className="goal-drawer-toggle-label">{TUTORIAL_COPY.drawer}{tutorial.log.length > 0 ? ` (${tutorial.log.length})` : ""}</span>
      </button>
    </section>
  );
}

function GoalCardView({ card, warn, onPress, onLook }: { readonly card: GoalCard; readonly warn: boolean; readonly onPress: () => void; readonly onLook: () => void }) {
  if (card.status !== "active") {
    return (
      <article className={`goal-card goal-card--${card.status}`} data-goal-card={card.key} role="status">
        <h3 className="goal-card-title">{card.title}</h3>
        <p className="goal-card-status"><UiIcon sheet="prediction" cell="ok" />{card.status === "already" ? TUTORIAL_COPY.alreadyDone : TUTORIAL_COPY.done}</p>
      </article>
    );
  }
  const ratio = card.progress === null ? null : card.progress.target === 0 ? 1 : Math.min(1, card.progress.current / card.progress.target);
  return (
    <article className={warn ? "goal-card goal-card--warn" : "goal-card"} data-goal-card={card.key}>
      <header className="goal-card-heading">
        <h3 className="goal-card-title">{card.title}</h3>
        {card.progress === null ? null : <span className="goal-card-count">{TUTORIAL_COPY.progress(card.progress.current, card.progress.target)}</span>}
      </header>
      {ratio === null ? null : <span className="goal-card-bar" aria-hidden="true"><span style={{ width: `${Math.round(ratio * 100)}%` }} /></span>}
      {card.why === "" ? null : <p className="goal-card-why">{card.why}</p>}
      <div className="goal-card-actions">
        {card.ctaLabel === null ? null : <button type="button" className="goal-card-cta" data-tutorial-cta={card.key} onClick={() => onPress()}>{card.ctaLabel}</button>}
        {card.hasTarget ? <button type="button" className="goal-card-secondary" onClick={() => onLook()}><UiIcon sheet="action" cell="look" />{TUTORIAL_COPY.lookHere}</button> : null}
        {card.help === null ? null : <details className="goal-card-help"><summary aria-label={TUTORIAL_COPY.help}><UiIcon sheet="lock" cell="help" size={32} /></summary><p>{card.help}</p></details>}
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
        <button type="button" className="steward-button" onClick={() => onDismiss()}>{TUTORIAL_COPY.advisorButton}</button>
      </div>
    </aside>
  );
}

export function UnlockBanner({ text }: { readonly text: string | null }) {
  if (text === null) return null;
  return <div className="unlock-banner" role="status"><UiIcon sheet="lock" cell="new" size={32} />{text}</div>;
}

export function PauseVeil({ paused }: { readonly paused: boolean }) {
  if (!paused) return null;
  return <div className="pause-veil" aria-hidden="false"><span className="pause-veil-label" role="status"><UiIcon sheet="time" cell="pause" />{TUTORIAL_COPY.paused}</span></div>;
}

export function GoalDrawer({ open, log, children }: { readonly open: boolean; readonly log: TutorialController["log"]; readonly children?: ReactNode }) {
  return (
    <section className="goal-drawer" hidden={!open} aria-label={TUTORIAL_COPY.drawer}>
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
      <button type="button" role="switch" aria-checked={enabled} className="tutorial-switch"
        onPointerDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); onChange(!enabled); }}>
        {TUTORIAL_COPY.tutorialToggle} {enabled ? TUTORIAL_COPY.tutorialOn : TUTORIAL_COPY.tutorialOff}
      </button>
      {enabled ? null : <small>{TUTORIAL_COPY.tutorialOffNote}</small>}
    </div>
  );
}
