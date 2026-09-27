import { useState } from "react";

import { platformServices } from "../../platform/platform";
import { EVENT_STORY_COPY } from "../eventStoryCopy.ko";
import type { StoryBeat } from "../eventStory";
import { UiIcon } from "../UiIcon";
import { wave16ImageStyle } from "../wave16Art";
import { Button } from "../kit";

// UI-4 event cards (not modal: time runs on unless the setting stops it): a folded chip under the crisis icons for
// each beat the world has already shown; a tap opens its card — the Wave 16 illustration, one line, the facts,
// [위치로] and [조언]; a decision beat's card opens its modal instead ([결정하기]).
export function EventCards({ beats, onDismiss, onDecide }: {
  readonly beats: readonly StoryBeat[];
  readonly onDismiss: (id: string) => void;
  readonly onDecide: (beat: StoryBeat) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adviceId, setAdviceId] = useState<string | null>(null);
  if (beats.length === 0) return null;
  const open = beats.find(beat => beat.id === openId) ?? null;
  return (
    <section className="event-cards" aria-label={EVENT_STORY_COPY.region}>
      <div className="event-chips">
        {beats.map(beat => (
          <Button key={beat.id} type="button" className="event-chip" data-story={beat.kind} aria-expanded={openId === beat.id}
            aria-label={EVENT_STORY_COPY.chipLabel(beat.title)} onPress={() => setOpenId(current => current === beat.id ? null : beat.id)} variant="secondary">
            <span className="event-chip-art" aria-hidden="true" style={wave16ImageStyle(beat.illustration, 64)} />{beat.title}
          </Button>
        ))}
      </div>
      {open === null ? null : (
        <article className="event-card" data-story={open.kind}>
          <div className="event-card-art" aria-hidden="true" style={wave16ImageStyle(open.illustration, 296)} />
          <h2>{open.title}</h2>
          <p className="event-card-line">{open.line}</p>
          {open.facts.length === 0 ? null : <ul className="event-card-facts">{open.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>}
          {adviceId === open.id ? <p className="event-card-advice" role="status">{open.advice}</p> : null}
          <div className="event-card-actions">
            {open.decision !== null ? <Button type="button" className="event-card-decide" onPress={() => onDecide(open)} variant="primary"><UiIcon sheet="action" cell="open" />{EVENT_STORY_COPY.decide}</Button> : null}
            {open.tile === null ? null : <Button type="button" onPress={() => { platformServices().input.emit({ kind: "lookAt", tile: open.tile! }); }} variant="secondary"><UiIcon sheet="action" cell="look" />{EVENT_STORY_COPY.lookAt}</Button>}
            <Button type="button" aria-pressed={adviceId === open.id} onPress={() => setAdviceId(current => current === open.id ? null : open.id)} variant="secondary"><UiIcon sheet="lock" cell="help" />{EVENT_STORY_COPY.advice}</Button>
            <Button type="button" onPress={() => { setOpenId(null); onDismiss(open.id); }} variant="secondary">{EVENT_STORY_COPY.close}</Button>
          </div>
        </article>
      )}
    </section>
  );
}
