import type { ReactElement } from "react";

import type { GameState } from "../../engine/engine.types";
import type { PauseEvent } from "../../engine/autoPause";
import { platformServices } from "../../platform/platform";
import { Button } from "../kit";
import type { LordScreenId } from "../lord/screen/lordScreenTypes";
import { topModal, type UiModal, type UiState } from "../stateMachine/uiStateMachine";
import { AUTO_PAUSE_COPY } from "./autoPauseCopy.ko";
import { autoPauseLines, type AutoPauseLink } from "./autoPauseModel";

/** The notice lists this many reasons; the rest are counted. */
const MAX_LINES = 4;

/**
 * LM-R3 (lord slice LS-2): why the lord-mode auto-pause stopped time — one line per reason (its word and the ledger's
 * sentence), a link where the screen already answers it (the marriage page, the suit, the house card, the petition's
 * card), and the one primary: go on (the pause toggle, back to the speed before).
 */
export function AutoPauseNotice({ state, events, paused, ui, onLord, onModal }: {
  readonly state: GameState; readonly events: readonly PauseEvent[];
  /** Time stopped (and no welcome over the game). */
  readonly paused: boolean;
  /** Shown only over the map itself: no modal, no panel in the slot (the build drawer may be open). */
  readonly ui: UiState;
  readonly onLord: (screen: LordScreenId, focus: string | null) => void;
  readonly onModal: (modal: UiModal) => void;
}): ReactElement | null {
  if (!paused || events.length === 0 || topModal(ui) !== null || (ui.mode !== "idle" && ui.mode !== "build")) return null;
  const lines = autoPauseLines(state, events);
  const more = lines.length - MAX_LINES;
  const follow = (link: AutoPauseLink) => { if (link.kind === "lord") onLord(link.screen, link.focus); else onModal(link.modal); };
  return (
    <section className="auto-pause-notice" data-frame="light" aria-live="polite" aria-label={AUTO_PAUSE_COPY.region} data-reasons={events.map(event => event.reason).join(" ")}>
      <p className="auto-pause-title">{AUTO_PAUSE_COPY.title}</p>
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
      <Button type="button" className="auto-pause-resume" variant="primary" size="md" onPress={() => { platformServices().input.emit({ kind: "pauseToggle" }); }}>{AUTO_PAUSE_COPY.resume}</Button>
    </section>
  );
}
