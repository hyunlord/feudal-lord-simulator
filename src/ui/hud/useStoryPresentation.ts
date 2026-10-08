import { useEffect, useRef, useState } from "react";

import { BALANCE } from "../../content/balanceConfig";
import type { GameState } from "../../engine/engine.types";
import type { ChapterEnd } from "../../engine/politics.types";
import { famineStatus, openPetitions } from "../../engine/politics";
import { scenarioOf, stateCalendar } from "../../engine/scenarioState";
import { storySeen } from "../../engine/storySeen";
import { useGameApi } from "../../state/gameStore";
import { presentationPreference } from "../../render/presentationPreferences";
import { eventWorldFirstMs, storyBeats, type StoryBeat } from "../eventStory";
import type { UiModal } from "../stateMachine/uiStateMachine";
import { latestChapterEnd } from "../chronicleModel";
import { openHomePetitions } from "../lordCardsModel";
import { openRegistryCards } from "../registryCardModel";
import { houseChangeView } from "../results/houseChange";
import { lordMattersDueNow } from "../lord/decisions/lordMattersDue";
import { SLICE_END_ID, SLICE_START_ID, sliceEndDue, slicePageDue, takeSliceStart } from "../slice/sliceDue";

// UI-4 world before UI: a beat's chip appears EVENT_WORLD_FIRST_MS after the beat is first seen (the world has shown
// it by then: the burning roof, the blighted fields, the petitioners at the gate) and stays until dismissed or a
// minute after the beat is over (its facts as last seen). A decision beat also opens its modal once, on the same
// delay (the famine's answer, the petition); the chapter's end opens the chronicle page once. With the setting on,
// a new chip stops time (UI-4: cards are not modal by default). storyBeats reads the state only (0.01–0.02 ms).
const LINGER_MS = 60_000;
const MAX_CHIPS = 3;

type Seen = { beat: StoryBeat; firstSeenMs: number; lastSeenMs: number; dismissed: boolean };

/** A chapter's page opens only this long after its end (one season). */
const CHAPTER_PAGE_TICKS = 1_000;

/**
 * UI-6 / QA-032: the chapter end whose page is due — the latest, within its season, and not seen yet. The seen mark is
 * the engine's (`seenTick`, kept in the save; v38 saves have their earlier ends marked by the v39 migration), so a load
 * does not open the page again; the hook's refs are only the in-session guard until the mark comes back.
 */
export function chapterPageDue(state: GameState): ChapterEnd | null {
  const latest = latestChapterEnd(state);
  return latest !== null && latest.seenTick === undefined && state.tick - latest.tick < CHAPTER_PAGE_TICKS ? latest : null;
}

/**
 * DEC-CARD: the year whose card is due when the hook sees `year` after `previous` — the year just ended, at the first
 * tick of the next one the hook sees (10× samples every ~25 ticks, so no turn is missed; a jump of seasons within the
 * turn still counts). A load is no turn: the tick going back, or more than one year at once (yearCardDue).
 */
export function yearTurned(previous: Readonly<{ year: number; tick: number }> | null, year: number, tick: number): number | null {
  return previous === null || tick < previous.tick || year !== previous.year + 1 ? null : previous.year;
}

const YEAR_TICKS = BALANCE.TICKS_PER_YEAR;
/** DEC-CARD-2: the year card's seen mark (the engine's `storySeen`, kept in the save). */
export const yearCardId = (year: number) => `year-review:${year}`;

/**
 * DEC-CARD-2 (DC-D3's follow-up): the year whose card is due — the year just ended, unless its card was opened (the
 * engine's seen mark, so a load does not show it again). On a live turn (yearTurned) it is due at once. After a load (or
 * the first sight) it is due only in the new year's first season, as a chapter's page is, and only in a game the screen
 * has played — one whose save holds the screen's marks (the bot and the harnesses never mark, so a harness's state
 * opens no card by itself).
 */
export function yearCardDue(previous: Readonly<{ year: number; tick: number }> | null, state: GameState): number | null {
  const { year } = stateCalendar(state);
  const last = year - 1;
  if (last < scenarioOf(state).startYear || storySeen(state, yearCardId(last))?.opened === true) return null;
  if (yearTurned(previous, year, state.tick) !== null) return last;
  const loaded = previous === null || state.tick < previous.tick || year > previous.year + 1;
  return loaded && state.tick % YEAR_TICKS < YEAR_TICKS / 4 && (state.seen?.marks.length ?? 0) > 0 ? last : null;
}

/**
 * The chips shown now, at most MAX_CHIPS: each beat seen `delayMs` ago, not put away, still current or within its minute
 * after. DEC-CARD (A3): a house change's chip is never pushed out by newer chips (at 10× a season's chips come fast).
 * PLAY-2 (friction 8): a house matter due with a deadline (`due`: lordMattersDueNow's chip ids — the will, the contested
 * inheritance, an audit, an off-map estate's petition) stays among the chips until it is answered: closing its card does
 * not put it away, newer chips do not push it out, and it goes the moment it is answered (no lingering).
 */
export function storyChips(entries: readonly Readonly<{ beat: StoryBeat; firstSeenMs: number; lastSeenMs: number; dismissed: boolean }>[],
  current: ReadonlySet<string>, nowMs: number, delayMs: number, houseRead: (id: string) => boolean, due: ReadonlySet<string> = new Set()): readonly StoryBeat[] {
  const unanswered = (beat: StoryBeat) => due.has(beat.id) && current.has(beat.id);
  const shown = entries
    .filter(entry => (!entry.dismissed || unanswered(entry.beat)) && !(entry.beat.kind === "house_change" && houseRead(entry.beat.id)) && nowMs - entry.firstSeenMs >= delayMs
      && (current.has(entry.beat.id) || (entry.beat.kind !== "lord_decision" && nowMs - entry.lastSeenMs < LINGER_MS)))
    .map(entry => entry.beat);
  const pinned = shown.filter(beat => beat.kind === "house_change" || unanswered(beat));
  const rest = shown.filter(beat => beat.kind !== "house_change" && !unanswered(beat));
  return [...pinned, ...rest.slice(rest.length - Math.max(0, MAX_CHIPS - pinned.length))].slice(0, MAX_CHIPS);
}

export function useStoryPresentation(input: {
  readonly state: GameState; readonly nowMs: number; readonly blocked: boolean; readonly topModal: UiModal | null;
  readonly pushModal: (modal: UiModal) => void; readonly pause: () => void;
  /** QA-032: the chapter's page opened — the engine marks it seen (`mark_chapter_page_seen`). */
  readonly markChapterSeen: (chapter: number) => void;
}) {
  const { state, nowMs, blocked, topModal, pushModal, pause, markChapterSeen } = input;
  // DEC-CARD-2: the year's card and the house card are marked read in the save (`mark_story_seen`), as they open.
  const { dispatch } = useGameApi();
  const markOpened = (id: string) => dispatch({ type: "mark_story_seen", id, how: "opened" });
  const seenRef = useRef(new Map<string, Seen>());
  const openedRef = useRef(new Set<string>());
  const announcedRef = useRef(new Set<string>());
  const chapterSeenRef = useRef(new Map<string, number>());
  // DEC-CARD: the year last seen (the turn's baseline), the year's card waiting (since when) and the years shown.
  const yearRef = useRef<{ year: number; tick: number } | null>(null);
  const yearDueRef = useRef<{ year: number; sinceMs: number } | null>(null);
  const yearShownRef = useRef(new Set<number>());
  // LM-R3: when the slice's end was first seen due (its page opens `delayMs` on, after the world, as a chapter's page).
  const sliceEndSinceRef = useRef<number | null>(null);
  const [, setRevision] = useState(0);
  const [delayMs] = useState(eventWorldFirstMs);
  const beats = storyBeats(state);
  // UI-6: a chapter's page opens when the chapter ends (within its season), not again on every later load of the town.
  const end = chapterPageDue(state);
  const year = stateCalendar(state).year;
  // DEC-CARD (A3): the season's latest change in the lord's house (lord mode); its card opens before any petition. DEC-CARD-2:
  // read once — its seen mark is the engine's (`house:<record id>`), so after a load it neither opens again nor keeps its chip.
  const house = houseChangeView(state);
  const houseRead = (id: string) => storySeen(state, id)?.opened === true;
  // why: every render on purpose: it records what the model shows now and re-renders only when a beat is new
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const seen = seenRef.current; const now = Date.now(); let changed = false;
    for (const beat of beats) {
      const entry = seen.get(beat.id);
      if (entry === undefined) { seen.set(beat.id, { beat, firstSeenMs: now, lastSeenMs: now, dismissed: false }); changed = true; }
      else { entry.beat = beat; entry.lastSeenMs = now; }
    }
    // A chapter's end first seen: its page is due `delayMs` on. CODE-1c follow-up: the wake timer below is computed at
    // render, so a first sighting re-renders to set it (a paused game, the presentation clock resting, would otherwise
    // never open the chapter's page).
    const chapterKey = end === null ? null : `chapter:${end.chapter}`;
    if (chapterKey !== null && !openedRef.current.has(chapterKey) && !chapterSeenRef.current.has(chapterKey)) {
      chapterSeenRef.current.set(chapterKey, now); changed = true;
    }
    // DEC-CARD: a year turned under the hook's eyes (not behind the welcome screen), or (DEC-CARD-2) an unseen one after a
    // load: its card is due `delayMs` on.
    const turned = blocked ? null : yearCardDue(yearRef.current, state);
    if (!blocked) yearRef.current = { year, tick: state.tick };
    if (turned !== null && !yearShownRef.current.has(turned)) { yearDueRef.current = { year: turned, sinceMs: now }; changed = true; }
    if (!blocked && sliceEndSinceRef.current === null && sliceEndDue(state)) { sliceEndSinceRef.current = now; changed = true; }
    if (changed) setRevision(revision => revision + 1);
  });
  const current = new Set(beats.map(beat => beat.id));
  const visible = storyChips([...seenRef.current.values()], current, nowMs, delayMs, houseRead, new Set(lordMattersDueNow(state).map(matter => matter.id)));
  const visibleKey = visible.map(beat => beat.id).join("|");
  // A new chip: stop time if the setting asks for it.
  useEffect(() => {
    let fresh = false;
    for (const beat of visible) if (!announcedRef.current.has(beat.id)) { announcedRef.current.add(beat.id); fresh = true; }
    if (fresh && !blocked && presentationPreference("eventPause")) pause();
  // why: keyed by the visible beats' ids (a new list each render); the pause setting is read when one is new
  }, [visibleKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Decisions and the chronicle open once, after the world first.
  const famine = famineStatus(state); const petition = openPetitions(state)[0];
  // LM-R1 (lord mode): a home estate's petition opens its card once, after the world, as a political petition does.
  const home = openHomePetitions(state)[0];
  // EVENT-ART (lord mode): a registry offer (an event entry) opens its card once, after the world, the same way.
  const offer = openRegistryCards(state)[0]?.occurrence;
  const ready = (id: string) => { const entry = seenRef.current.get(id); return entry !== undefined && nowMs - entry.firstSeenMs >= delayMs; };
  // DEC-CARD (A3): the house card read (opened by itself or from its chip): it does not open again, and its chip goes.
  // DEC-CARD-2: and the save keeps it (the engine's seen mark `house:<id>`, request engine-lmr2-seen-and-reads §1).
  useEffect(() => {
    if (topModal !== "house_change" || house === null) return;
    openedRef.current.add(`house:${house.id}`);
    if (!houseRead(`house:${house.id}`)) markOpened(`house:${house.id}`);
    const entry = seenRef.current.get(`house:${house.id}`);
    if (entry !== undefined && !entry.dismissed) { entry.dismissed = true; setRevision(revision => revision + 1); }
  // why: keyed by the card up and the house change; the mark reads the state and dispatches (both stable in meaning)
  }, [topModal, house]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (blocked || topModal !== null) return;
    // LM-R3: the lord slice's opening page before anything; its end after the year's card (the year, then the twenty).
    const slice = slicePageDue(state, yearDueRef.current !== null);
    const endSince = sliceEndSinceRef.current;
    if (slice !== null && !openedRef.current.has(slice) && (slice === "slice_start" || (endSince !== null && nowMs - endSince >= delayMs))) {
      openedRef.current.add(slice); if (slice === "slice_start") takeSliceStart();
      pushModal(slice); markOpened(slice === "slice_start" ? SLICE_START_ID : SLICE_END_ID); return;
    }
    // DEC-CARD (A3): a change in the lord's house before any petition of the same tick.
    if (house !== null && !openedRef.current.has(`house:${house.id}`) && !houseRead(`house:${house.id}`) && ready(`house:${house.id}`)) {
      openedRef.current.add(`house:${house.id}`); pushModal("house_change"); markOpened(`house:${house.id}`); return;
    }
    if (famine !== null && famine.choices.length > 0 && !openedRef.current.has(famine.eventId) && ready(`famine:${famine.eventId}`)) {
      openedRef.current.add(famine.eventId); pushModal("decision"); return;
    }
    if (petition !== undefined && !openedRef.current.has(petition.id) && ready(`petition:${petition.id}`)) {
      openedRef.current.add(petition.id); pushModal("petition"); return;
    }
    if (home !== undefined && !openedRef.current.has(home.id) && ready(`home-petition:${home.id}`)) {
      openedRef.current.add(home.id); pushModal("estate_petition"); return;
    }
    if (offer !== undefined && !openedRef.current.has(offer.id) && ready(`registry:${offer.id}`)) {
      openedRef.current.add(offer.id); pushModal("registry_offer"); return;
    }
    const chapterKey = end === null ? null : `chapter:${end.chapter}`;
    const since = chapterKey === null || openedRef.current.has(chapterKey) ? undefined : chapterSeenRef.current.get(chapterKey);
    // QA-032: marked seen as it opens (as the refs did), so the "pause" autosave the page's modal pause writes already
    // holds the mark, and a save with the page still open does not show it again.
    if (end !== null && chapterKey !== null && since !== undefined && nowMs - since >= delayMs) { openedRef.current.add(chapterKey); pushModal("chronicle"); markChapterSeen(end.chapter); return; }
    // DEC-CARD: the year's card, last (after the year's decisions and pages): once per year, a modal (time stops once).
    const due = yearDueRef.current;
    if (due !== null && nowMs - due.sinceMs >= delayMs) {
      yearDueRef.current = null; yearShownRef.current.add(due.year); pushModal("year_review"); markOpened(yearCardId(due.year));
    }
  });
  // CODE-1c: no presentation clock for the story — one timer wakes this hook when the next chip is due (its delay out),
  // a lingering chip goes, or a chapter end's chronicle may open. App's 100 ms clock stops when nothing else needs it.
  const wakes: number[] = [];
  for (const entry of seenRef.current.values()) {
    if (entry.dismissed) continue;
    if (nowMs - entry.firstSeenMs < delayMs) wakes.push(entry.firstSeenMs + delayMs);
    else if (!current.has(entry.beat.id) && nowMs - entry.lastSeenMs < LINGER_MS) wakes.push(entry.lastSeenMs + LINGER_MS);
  }
  const chapterSince = end === null || openedRef.current.has(`chapter:${end.chapter}`) ? undefined : chapterSeenRef.current.get(`chapter:${end.chapter}`);
  if (chapterSince !== undefined) wakes.push(chapterSince + delayMs);
  if (yearDueRef.current !== null) wakes.push(yearDueRef.current.sinceMs + delayMs);
  if (sliceEndSinceRef.current !== null && !openedRef.current.has("slice_end")) wakes.push(sliceEndSinceRef.current + delayMs);
  const nextWakeMs = wakes.length === 0 ? null : Math.min(...wakes);
  useEffect(() => {
    if (nextWakeMs === null) return undefined;
    const timer = window.setTimeout(() => setRevision(revision => revision + 1), Math.max(0, nextWakeMs - Date.now()) + 1);
    return () => window.clearTimeout(timer);
  }, [nextWakeMs]);
  return {
    visible,
    dismiss: (id: string) => { const entry = seenRef.current.get(id); if (entry !== undefined) { entry.dismissed = true; setRevision(revision => revision + 1); } },
  };
}
