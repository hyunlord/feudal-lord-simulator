import { Button } from "../kit";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";
import { threadLinkLabel, type DecisionThreadView, type ThreadLink } from "./decisionThreadModel";

// DEC-CARD-2: the picked record's thread under its detail — the decisions it followed from, what followed a decision,
// who remembers it. Each linked line opens its record in the list (every record shown, so the link always lands).

function Links({ links, onOpen }: { readonly links: readonly ThreadLink[]; readonly onOpen: (recordId: string, tick: number) => void }) {
  return <ul className="chronicle-thread-links">{links.map(link => <li key={link.key}>
    <Button type="button" className="chronicle-thread-link" data-record={link.recordId} aria-label={threadLinkLabel(link)}
      onPress={() => onOpen(link.recordId, link.tick)} variant="secondary">{link.line}</Button>
  </li>)}</ul>;
}

export function DecisionThread({ view, onOpen }: { readonly view: DecisionThreadView; readonly onOpen: (recordId: string, tick: number) => void }) {
  return (
    <section className="chronicle-thread" aria-label={COPY.threadLabel} data-thread={view.followed === null ? "because" : "decision"}>
      {view.because.length === 0 ? null : <div className="chronicle-thread-part" data-part="because">
        <h4>{COPY.becauseHeading}</h4><Links links={view.because} onOpen={onOpen} /></div>}
      {view.followed === null ? null : <div className="chronicle-thread-part" data-part="followed">
        <h4>{COPY.followedHeading}</h4>
        {view.followed.length === 0 ? <p className="chronicle-thread-none">{COPY.followedNone}</p> : <Links links={view.followed} onOpen={onOpen} />}
        {view.more === 0 ? null : <p className="chronicle-thread-none">{COPY.followedMore(view.more)}</p>}
      </div>}
      {view.remembers.length === 0 ? null : <div className="chronicle-thread-part" data-part="remembers">
        <h4>{COPY.remembersHeading}</h4><ul className="chronicle-thread-minds">{view.remembers.map(line => <li key={line}>{line}</li>)}</ul></div>}
    </section>
  );
}
