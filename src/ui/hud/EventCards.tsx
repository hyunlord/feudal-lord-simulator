import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { platformServices } from "../../platform/platform";
import { EVENT_STORY_COPY } from "../eventStoryCopy.ko";
import type { StoryBeat } from "../eventStory";
import { UiIcon } from "../UiIcon";
import { Button } from "../kit";
import { storyArtStyle } from "../storyArt";
import { NAT1_BOX_COPY } from "../nat1TextBoxCopy.ko";
import { textCut } from "./textCut";
import { openChronicleRecord } from "../lord/chronicleFocus";
import type { ChipDue } from "../lord/decisions/deadlines";
import { askDecision } from "../lord/decisions/decisionFocus";

// UI-4 event cards (not modal: time runs on unless the setting stops it): a folded chip under the crisis icons for
// each beat the world has already shown; a tap opens its card — the Wave 16 illustration, one line, the facts,
// [위치로] and [조언]; a decision beat's card opens its modal instead ([결정하기]).
/** LS1-13: how long a kind's chip lights when a decision comes into it. */
const FRESH_MS = 1_800;

export function EventCards({ beats, due = new Map(), openId, onOpen, onDismiss, onDecide, notice = null }: {
  readonly beats: readonly StoryBeat[];
  /** LS1-11: a held chip's time left by the engine's deadline, and whether it is in its last season. */
  readonly due?: ReadonlyMap<string, ChipDue>;
  /** The chip whose card is open, kept by the story hook (its chip is held on the rail while it is open). */
  readonly openId: string | null;
  readonly onOpen: (id: string | null) => void;
  readonly onDismiss: (id: string) => void;
  readonly onDecide: (beat: StoryBeat) => void;
  /** LM-R1: the seasons' stacked notice, after the beats' chips (`SeasonNotice`). */
  readonly notice?: ReactNode;
}) {
  // LS1-13: a decision newly come into a kind's chip is told there as a new chip would be — its count changes and the
  // chip lights briefly (a chip that comes back after it went is new on the rail and needs no light).
  const membersRef = useRef(new Map<string, ReadonlySet<string>>());
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const memberKey = beats.map(beat => `${beat.id}=${(beat.members ?? []).map(member => member.id).join(",")}`).join("|");
  useEffect(() => {
    const before = membersRef.current; const next = new Map<string, ReadonlySet<string>>(); const grown: string[] = [];
    for (const beat of beats) {
      if (beat.members === undefined) continue;
      const ids = new Set(beat.members.map(member => member.id)); next.set(beat.id, ids);
      const old = before.get(beat.id);
      if (old !== undefined && [...ids].some(id => !old.has(id))) grown.push(beat.id);
    }
    membersRef.current = next;
    if (grown.length === 0) return;
    setFresh(current => new Set([...current, ...grown]));
    window.setTimeout(() => setFresh(current => new Set([...current].filter(id => !grown.includes(id)))), FRESH_MS);
  // why: keyed by the chips and their members (a new list each render)
  }, [memberKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (beats.length === 0 && notice === null) return null;
  const open = beats.find(beat => beat.id === openId) ?? null;
  return (
    <section className="event-cards" aria-label={EVENT_STORY_COPY.region}>
      <div className="event-chips">
        {beats.map(beat => (
          <Button key={beat.id} type="button" className="event-chip" data-story={beat.kind} data-chip-id={beat.id} aria-expanded={openId === beat.id}
            data-near={due.get(beat.id)?.near === true ? "true" : undefined} data-due={due.has(beat.id) ? "true" : undefined} data-fresh={fresh.has(beat.id) ? "true" : undefined}
            aria-label={EVENT_STORY_COPY.chipLabel(due.has(beat.id) ? `${beat.title} · ${due.get(beat.id)!.left}` : beat.title)}
            onPress={() => onOpen(openId === beat.id ? null : beat.id)} variant="secondary">
            {/* LS1-14: a held chip is its short name and mark only (its picture and long words are its card's). */}
            {/* LS1-15: while the zone tools are open the chip is this colour mark and its time left (the stylesheet). */}
            <span className="event-chip-mark" aria-hidden="true" />
            {beat.illustration === null || due.has(beat.id) ? null : <span className="event-chip-art" aria-hidden="true" style={storyArtStyle(beat.illustration, 64)} />}
            <span className="event-chip-name">{beat.chip ?? beat.title}</span>
            {due.has(beat.id) ? <span className="event-chip-due">{due.get(beat.id)!.short}</span> : null}
          </Button>
        ))}
        {notice}
      </div>
      {open === null ? null : (
        // NAT-1: key={open.id} resets the expand state when the player switches to a different card.
        // PLAY-2: [닫기] closes the card; a house decision's chip stays until answered (useStoryPresentation).
        // SUIT-THREAD: a chip that opens a lord screen page folds its card (the page takes the panel slot).
        <EventCardDetail key={open.id} open={open} due={due} onDismiss={id => { onOpen(null); onDismiss(id); }}
          onDecide={beat => { if (beat.screen !== undefined) onOpen(null); onDecide(beat); }} />
      )}
    </section>
  );
}

/** NAT-1: extracted card body so useState resets on key change (different event card opened). */
export function EventCardDetail({ open, due = new Map(), onDismiss, onDecide }: {
  readonly open: StoryBeat;
  /** LS1-12: a folded chip's members' time left (its card lists them). */
  readonly due?: ReadonlyMap<string, ChipDue>;
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
    <article className="event-card" data-frame="light" data-story={open.kind} data-chip-id={open.id}>
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
      {/* LS1-12: a folded chip's decisions, each with its time left, each answered from here. */}
      {open.members === undefined || open.members.length < 2 ? null : (
        <ul className="event-card-members">{open.members.map(member => (
          <li key={member.id} className="event-card-member" data-chip-id={member.id} data-near={due.get(member.id)?.near === true ? "true" : undefined}>
            <span className="event-card-member-title">{member.title}</span>
            {due.has(member.id) ? <span className="event-card-member-due">{due.get(member.id)!.left}</span> : null}
            <Button type="button" className="event-card-member-decide" variant="secondary" onPress={() => { askDecision(member.id); onDecide(member); }}>{member.openLabel ?? EVENT_STORY_COPY.decide}</Button>
          </li>
        ))}</ul>
      )}
      {adviceId === open.id ? <p className="event-card-advice" role="status">{open.advice}</p> : null}
      <div className="event-card-actions">
        {open.decision !== null || open.screen !== undefined || open.slot !== undefined ? <Button type="button" className="event-card-decide" onPress={() => { if (open.members?.length === 1) askDecision(open.members[0]!.id); onDecide(open); }} variant="primary"><UiIcon sheet="action" cell="open" />{open.openLabel ?? EVENT_STORY_COPY.decide}</Button> : null}
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
