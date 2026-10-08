import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { platformServices } from "../../platform/platform";
import { EVENT_STORY_COPY } from "../eventStoryCopy.ko";
import type { StoryBeat } from "../eventStory";
import { UiIcon } from "../UiIcon";
import { Button } from "../kit";
import { storyArtStyle } from "../storyArt";
import { NAT1_BOX_COPY } from "../nat1TextBoxCopy.ko";
import { textCut } from "./textCut";
import { openChronicleRecord } from "../lord/chronicleFocus";

// UI-4 event cards (not modal: time runs on unless the setting stops it): a folded chip under the crisis icons for
// each beat the world has already shown; a tap opens its card — the Wave 16 illustration, one line, the facts,
// [위치로] and [조언]; a decision beat's card opens its modal instead ([결정하기]).
export function EventCards({ beats, onDismiss, onDecide, notice = null }: {
  readonly beats: readonly StoryBeat[];
  readonly onDismiss: (id: string) => void;
  readonly onDecide: (beat: StoryBeat) => void;
  /** LM-R1: the seasons' stacked notice, after the beats' chips (`SeasonNotice`). */
  readonly notice?: ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (beats.length === 0 && notice === null) return null;
  const open = beats.find(beat => beat.id === openId) ?? null;
  return (
    <section className="event-cards" aria-label={EVENT_STORY_COPY.region}>
      <div className="event-chips">
        {beats.map(beat => (
          <Button key={beat.id} type="button" className="event-chip" data-story={beat.kind} aria-expanded={openId === beat.id}
            aria-label={EVENT_STORY_COPY.chipLabel(beat.title)} onPress={() => setOpenId(current => current === beat.id ? null : beat.id)} variant="secondary">
            {beat.illustration === null ? null : <span className="event-chip-art" aria-hidden="true" style={storyArtStyle(beat.illustration, 64)} />}{beat.title}
          </Button>
        ))}
        {notice}
      </div>
      {open === null ? null : (
        // NAT-1: key={open.id} resets the expand state when the player switches to a different card.
        // PLAY-2: [닫기] closes the card; a house decision's chip stays until answered (useStoryPresentation).
        <EventCardDetail key={open.id} open={open} onDismiss={id => { setOpenId(null); onDismiss(id); }} onDecide={onDecide} />
      )}
    </section>
  );
}

/** NAT-1: extracted card body so useState resets on key change (different event card opened). */
export function EventCardDetail({ open, onDismiss, onDecide }: {
  readonly open: StoryBeat;
  readonly onDismiss: (id: string) => void;
  readonly onDecide: (beat: StoryBeat) => void;
}) {
  const [lineExpanded, setLineExpanded] = useState(false);
  const [adviceId, setAdviceId] = useState<string | null>(null);
  // NAT-4 (QA-022): "더 보기" only when the clamp or the title's ellipsis cuts something — the first winter's one
  // sentence showed it, and pressing it took away only the button. Measured before paint and again when the card resizes.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const [cut, setCut] = useState(false);
  useLayoutEffect(() => {
    if (lineExpanded) return undefined;
    const measure = () => setCut(textCut(titleRef.current) || textCut(lineRef.current));
    measure();
    const observer = new ResizeObserver(measure);
    for (const element of [titleRef.current, lineRef.current]) if (element !== null) observer.observe(element);
    return () => observer.disconnect();
  }, [lineExpanded, open.title, open.line]);
  return (
    <article className="event-card" data-frame="light" data-story={open.kind}>
      {open.illustration === null ? null : <div className="event-card-art" aria-hidden="true" style={storyArtStyle(open.illustration, 296)} />}
      {/* NAT-1: one line (ellipsis); "더 보기" shows it whole with the body (no hover-only title tooltip). */}
      <h2 ref={titleRef} className={lineExpanded ? "event-card-title--whole" : undefined}>{open.title}</h2>
      {/* NAT-1: clamp to 4 lines; the "더 보기" button reveals the rest (NAT-4: shown only when there is a rest). */}
      <p ref={lineRef} className={`event-card-line${lineExpanded ? "" : " event-card-line--clamped"}`}>{open.line}</p>
      {lineExpanded || !cut ? null : (
        <Button type="button" className="event-card-more" variant="quiet" onPress={() => setLineExpanded(true)}>
          {NAT1_BOX_COPY.more}
        </Button>
      )}
      {open.facts.length === 0 ? null : <ul className="event-card-facts">{open.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>}
      {adviceId === open.id ? <p className="event-card-advice" role="status">{open.advice}</p> : null}
      <div className="event-card-actions">
        {open.decision !== null ? <Button type="button" className="event-card-decide" onPress={() => onDecide(open)} variant="primary"><UiIcon sheet="action" cell="open" />{open.openLabel ?? EVENT_STORY_COPY.decide}</Button> : null}
        {open.tile === null ? null : <Button type="button" onPress={() => { platformServices().input.emit({ kind: "lookAt", tile: open.tile! }); }} variant="secondary"><UiIcon sheet="action" cell="look" />{EVENT_STORY_COPY.lookAt}</Button>}
        {/* DEC-CARD-2: what followed a decision opens that decision in the chronicle. */}
        {open.chronicle === undefined ? null : <Button type="button" className="event-card-chronicle" aria-label={open.chronicle.label}
          onPress={() => { if (open.chronicle !== undefined) openChronicleRecord(open.chronicle.recordId, open.chronicle.tick); }} variant="secondary"><UiIcon sheet="action" cell="log" />{EVENT_STORY_COPY.chronicle}</Button>}
        <Button type="button" aria-pressed={adviceId === open.id} onPress={() => setAdviceId(current => current === open.id ? null : open.id)} variant="secondary"><UiIcon sheet="lock" cell="help" />{EVENT_STORY_COPY.advice}</Button>
        <Button type="button" onPress={() => { onDismiss(open.id); }} variant="secondary">{EVENT_STORY_COPY.close}</Button>
      </div>
    </article>
  );
}
