import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState } from "../../engine/engine.types";
import { ChronicleArtView } from "../chronicle/ChronicleArtView";
import { EmblemImage } from "../heraldry/EmblemImage";
import { Button } from "../kit";
import { UiIcon } from "../UiIcon";
import { wave8ContentStyle, wave8FrameLayerStyle } from "../wave8Art";
import { LegacyAxes, LegacyEndingBlock, useChronicleExport } from "./LegacyEndingScreen";
import { LEGACY_SCREEN_COPY as COPY } from "./legacyScreenCopy.ko";
import { chronicleBookView, type BookLineView, type BookPage } from "./legacyScreenModel";

// UI-10 (LG-9): the chronicle book — the campaign's end (or, from the chronicle screen and the pause menu, the book so
// far) as pages turned one at a time: a title page with its contents, one page per chapter (its events with their
// pictures, its decisions with the answer chosen and the others, its one-line summary), the family tree, the nine
// factions, the legacy. The prev / next buttons, ← / → and a sideways swipe turn the page; the turn is a short flip
// (legacy.css; none under prefers-reduced-motion). A long page scrolls inside the book, never the page sideways.

/** A sideways swipe of at least this many px (and more sideways than down) turns the page. */
const SWIPE_PX = 56;

function Lines({ lines, empty, art = 48 }: { readonly lines: readonly BookLineView[]; readonly empty: string; readonly art?: number }) {
  if (lines.length === 0) return <p className="legacy-book-empty">{empty}</p>;
  return (
    <ol className="legacy-book-lines">
      {lines.map(line => (
        <li key={line.id} className="legacy-book-line" data-record={line.id}>
          <ChronicleArtView art={line.art} size={art} className="legacy-book-art" />
          <span className="legacy-book-year">{line.year}</span>
          <span className="legacy-book-text">{line.text}</span>
        </li>
      ))}
    </ol>
  );
}

function PageBody({ page, onGo }: { readonly page: BookPage; readonly onGo: (index: number) => void }) {
  switch (page.kind) {
    case "title": return (
      <div className="legacy-book-title-page">
        <EmblemImage emblem={page.emblem} size={96} label="" />
        <h2>{page.title}</h2>
        <p className="legacy-book-status">{page.status}</p>
        <h3>{COPY.book.contents}</h3>
        <ol className="legacy-book-contents">
          {page.contents.map((entry, index) => (
            <li key={entry}><Button type="button" className="legacy-book-contents-entry" onPress={() => onGo(index + 1)} variant="quiet">{entry}</Button></li>
          ))}
        </ol>
      </div>
    );
    case "chapter": return (
      <div className="legacy-book-chapter" data-chapter={page.chapter} data-closed={page.closed}>
        <h2>{page.heading}</h2>
        <p className="legacy-book-summary">{page.summary}</p>
        {page.closed ? null : <p className="legacy-book-writing">{COPY.book.writing}</p>}
        <div className="legacy-book-columns">
          <section><h3>{COPY.book.eventsHeading}</h3><Lines lines={page.events} empty={COPY.book.noEvents} art={64} /></section>
          <section><h3>{COPY.book.decisionsHeading}</h3>
            {page.decisions.length === 0 ? <p className="legacy-book-empty">{COPY.book.noDecisions}</p> : (
              <ol className="legacy-book-lines">
                {page.decisions.map(decision => (
                  <li key={decision.id} className="legacy-book-line legacy-book-decision" data-record={decision.id}>
                    <ChronicleArtView art={decision.art} size={48} className="legacy-book-art" />
                    <span className="legacy-book-year">{decision.year}</span>
                    <span className="legacy-book-text">{decision.text}</span>
                    <span className="legacy-book-chosen">{decision.chosen}</span>
                    {decision.alternatives === "" ? null : <span className="legacy-book-alternatives">{decision.alternatives}</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    );
    case "family": return (
      <div className="legacy-book-family">
        <h2>{page.heading}</h2>
        {page.houses.map(house => (
          <section key={house.order} className="legacy-book-house" data-house={house.order}>
            <h3>{house.name} <span>{house.years}</span></h3>
            {house.people.length === 0 ? <p className="legacy-book-empty">{COPY.book.noPeople}</p> : (
              <ol className="legacy-book-people">
                {house.people.map(person => (
                  <li key={person.id} className="legacy-book-person" data-person={person.id} data-head={person.head} data-generation={person.generation}
                    style={{ marginLeft: Math.min(5, person.generation - 1) * 20 }}>
                    <span className="legacy-book-generation">{person.generationLabel}</span>
                    <strong>{person.name}</strong>
                    <span>{person.life}</span>
                    {person.head ? <span className="legacy-book-head">{COPY.book.head}</span> : null}
                    {person.parents === "" ? null : <span className="legacy-book-parents">{person.parents}</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    );
    case "factions": return (
      <div className="legacy-book-factions">
        <h2>{page.heading}</h2>
        {page.factions.map(faction => (
          <section key={faction.id} className="legacy-book-faction" data-faction={faction.id}>
            <h3>{faction.name} <span>{faction.relationLine}</span></h3>
            <Lines lines={faction.entries} empty={COPY.book.noEntries} art={32} />
          </section>
        ))}
      </div>
    );
    case "legacy": return (
      <div className="legacy-book-legacy">
        <h2>{page.heading}</h2>
        {page.verdict === null ? <p className="legacy-book-empty">{COPY.book.noLegacy}</p> : <>
          {page.scoresLine === null ? null : <p className="legacy-book-summary">{page.scoresLine}</p>}
          <LegacyAxes axes={page.verdict.axes} />
          <p className="legacy-verdict-lines"><span>{page.verdict.leadLine}</span><span>{page.verdict.chosenLine}</span></p>
          <LegacyEndingBlock ending={page.verdict.ending} headingLevel={3} />
        </>}
      </div>
    );
  }
}

export function ChronicleBook({ state, onClose }: { readonly state: GameState; readonly onClose: () => void }) {
  // Time stands still while the book is open: the pages are built once per state.
  const book = useMemo(() => chronicleBookView(state), [state]);
  const [index, setIndex] = useState(0);
  const [turn, setTurn] = useState<"none" | "next" | "prev">("none");
  const exporting = useChronicleExport(state);
  const dialog = useRef<HTMLElement>(null);
  const swipe = useRef<{ readonly x: number; readonly y: number } | null>(null);
  const total = book.pages.length;
  const page = book.pages[Math.min(index, total - 1)]!;
  useEffect(() => { dialog.current?.focus(); }, []);
  const go = (next: number) => {
    const target = Math.max(0, Math.min(total - 1, next));
    if (target === index) return;
    setTurn(target > index ? "next" : "prev");
    setIndex(target);
  };
  return (
    <div className="story-modal-backdrop legacy-book-backdrop" role="presentation">
      <section ref={dialog} className="chronicle-page legacy-book" data-frame="chapter-page" role="dialog" aria-modal="true" aria-label={COPY.book.title} tabIndex={-1}
        data-page={page.key} data-pages={total} data-finished={book.finished}
        onKeyDown={event => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          // The keys turn the page here, not the camera under the book.
          event.preventDefault(); event.stopPropagation();
          go(index + (event.key === "ArrowRight" ? 1 : -1));
        }}
        onPointerDown={event => { swipe.current = event.pointerType === "touch" ? { x: event.clientX, y: event.clientY } : null; }}
        onPointerUp={event => {
          const start = swipe.current; swipe.current = null;
          if (start === null) return;
          const dx = event.clientX - start.x, dy = event.clientY - start.y;
          if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > 2 * Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
        }}
        onPointerCancel={() => { swipe.current = null; }}>
        <span className="chronicle-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_chronicle_page")} />
        <div className="legacy-book-body" style={wave8ContentStyle("frame_chronicle_page")}>
          <header className="legacy-book-header">
            <strong className="legacy-book-name">{COPY.book.title}</strong>
            <span className="legacy-book-count" aria-live="polite">{COPY.book.pageOf(index + 1, total)}</span>
            <Button type="button" className="legacy-export" onPress={() => exporting.run()} variant="secondary"><UiIcon sheet="action" cell="open" />{COPY.exportText}</Button>
            <Button type="button" className="legacy-book-close" aria-label={COPY.book.closeLabel} onPress={() => onClose()} variant="secondary">{COPY.book.close}</Button>
          </header>
          <p className="legacy-export-status" role="status">{exporting.status ?? ""}</p>
          <article key={page.key} className="legacy-book-page" data-kind={page.kind} data-turn={turn}>
            <PageBody page={page} onGo={go} />
          </article>
          <nav className="legacy-book-turns" aria-label={COPY.book.pagesLabel}>
            <Button type="button" className="legacy-book-prev" aria-label={COPY.book.prevLabel} disabled={index === 0} onPress={() => go(index - 1)} variant="secondary">
              {COPY.book.prev}</Button>
            <Button type="button" className="legacy-book-next" aria-label={COPY.book.nextLabel} disabled={index >= total - 1} onPress={() => go(index + 1)} variant="primary">
              {COPY.book.next}</Button>
          </nav>
        </div>
      </section>
    </div>
  );
}
