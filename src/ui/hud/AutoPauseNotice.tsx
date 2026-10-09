import type { ReactElement } from "react";

import type { GameState } from "../../engine/engine.types";
import { platformServices } from "../../platform/platform";
import { Button } from "../kit";
import type { LordScreenId } from "../lord/screen/lordScreenTypes";
import { topModal, type UiModal, type UiState } from "../stateMachine/uiStateMachine";
import { AUTO_PAUSE_COPY } from "./autoPauseCopy.ko";
import { autoPauseLines, type AutoPauseLink } from "./autoPauseLines";
import type { SeasonHold } from "./autoPauseModel";

/** The notice lists this many reasons; the rest are counted. */
const MAX_LINES = 4;

/**
 * LM-R3 (lord slice LS-2; the user's ruling 2026-10-09): why the lord-mode auto-pause stopped time — the season's
 * reasons together, one line each (its word and the engine's sentence), a link where the screen already answers it (the
 * marriage page, the suit or the threat, the house card, the petition's or the contest's card), and the one primary: go
 * on (the pause toggle, back to the speed before). The season's later reasons (no second stop) show the same way while
 * time runs, under their own title, put away by [확인].
 */
export function AutoPauseNotice({ state, hold, paused, ui, onLord, onModal, onDismiss }: {
  readonly state: GameState; readonly hold: SeasonHold | null;
  /** Time stopped (and no welcome over the game). */
  readonly paused: boolean;
  /** Shown only over the map itself: no modal, no panel in the slot (the build drawer may be open). */
  readonly ui: UiState;
  readonly onLord: (screen: LordScreenId, focus: string | null) => void;
  readonly onModal: (modal: UiModal) => void;
  readonly onDismiss: () => void;
}): ReactElement | null {
  if (hold === null || hold.mode === null || hold.shown.length === 0 || topModal(ui) !== null || (ui.mode !== "idle" && ui.mode !== "build")) return null;
  if (hold.mode === "stopped" && !paused) return null;
  const stopped = hold.mode === "stopped";
  const lines = autoPauseLines(state, hold.shown);
  const more = lines.length - MAX_LINES;
  const follow = (link: AutoPauseLink) => { if (link.kind === "lord") onLord(link.screen, link.focus); else onModal(link.modal); };
  return (
    <section className="auto-pause-notice" data-frame="light" aria-live="polite" aria-label={AUTO_PAUSE_COPY.region} data-mode={hold.mode}
      data-reasons={hold.shown.map(item => item.kind === "event" ? item.event.reason : item.matter.kind).join(" ")}>
      <p className="auto-pause-title">{stopped ? AUTO_PAUSE_COPY.title : AUTO_PAUSE_COPY.addedTitle}</p>
      <ul className="auto-pause-lines">
        {lines.slice(0, MAX_LINES).map(line => (
          <li key={line.key} className="auto-pause-line">
            <span className="auto-pause-text"><span className="auto-pause-word">{line.word}</span>{line.sentence === "" ? null : <span className="auto-pause-sentence">{line.sentence}</span>}</span>
            {line.link === null || line.linkLabel === null ? null : (
              <Button type="button" className="auto-pause-link" variant="secondary" size="md" onPress={() => { if (line.link !== null) follow(line.link); }}>{line.linkLabel}</Button>
            )}
          </li>
        ))}
      </ul>
      {more > 0 ? <p className="auto-pause-more">{AUTO_PAUSE_COPY.more(more)}</p> : null}
      {stopped
        ? <Button type="button" className="auto-pause-resume" variant="primary" size="md" onPress={() => { platformServices().input.emit({ kind: "pauseToggle" }); }}>{AUTO_PAUSE_COPY.resume}</Button>
        : <Button type="button" className="auto-pause-resume auto-pause-ok" variant="primary" size="md" onPress={() => onDismiss()}>{AUTO_PAUSE_COPY.addedOk}</Button>}
    </section>
  );
}
