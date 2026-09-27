import type { CSSProperties } from "react";
import { EmblemImage } from "../heraldry/EmblemImage";
import { Button } from "../kit";
import { portraitStyle } from "../portraitArt";
import { wave19ImageStyle, wave19Url } from "../wave19Art";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";
import type { FactionPageView } from "./factionTabModel";

// CHRON-2 faction chronicle page (CHRONICLE_DESIGN 2.3; UI-6 first pass). The Wave 19 `frame_faction_page` (640 x 800
// art, drawn at one scale so its printed slots stay where they are): the leader's portrait in the circle, the arms in
// the shield, the faction's name with its leader beside them, the relation scale (`relation_scale_track` +
// `relation_scale_pin`, hostile −100 to friendly +100) with its reading under it, the demands and the promises in the
// two boxes, and in the long box at the foot the records it remembers (each a link: that record in the chronicle) and
// its own timeline.
export const FACTION_PAGE = { width: 640, height: 800 } as const;

const slot = (left: number, top: number, width: number, height: number): CSSProperties =>
  ({ left: `${left / 6.4}%`, top: `${top / 8}%`, width: `${width / 6.4}%`, height: `${height / 8}%` });
/** Measured on frame_faction_page.png. */
export const FACTION_PAGE_SLOTS = {
  leader: slot(66, 92, 148, 148), crest: slot(490, 92, 88, 104), name: slot(236, 84, 240, 180), relation: slot(70, 296, 500, 32),
  relationText: slot(70, 330, 500, 24), demands: slot(50, 364, 266, 172), promises: slot(326, 364, 268, 172),
  ourEvents: slot(50, 598, 276, 148), theirEvents: slot(326, 598, 268, 148),
} as const;

/** The shield's inside on the art (the printed outline around it stays visible). */
const CREST_ART = 88;

export function FactionPage({ view, scale, onRecord }: {
  readonly view: FactionPageView; readonly scale: number; readonly onRecord: (recordId: string, tick: number) => void;
}) {
  const leader = view.leader === null ? null : portraitStyle(view.leader.portraitId, Math.round(148 * scale));
  return (
    <article className="chronicle-faction" aria-label={COPY.factionTitle(view.name)} data-faction={view.id} data-relation={view.relation}
      style={{ width: FACTION_PAGE.width * scale, height: FACTION_PAGE.height * scale, backgroundImage: `url("${wave19Url("frame_faction_page")}")` }}>
      {leader === null || view.leader === null ? null
        : <span className="chronicle-faction-leader" role="img" aria-label={view.leader.name} data-portrait={view.leader.portraitId} style={{ ...FACTION_PAGE_SLOTS.leader, ...leader }} />}
      <span className="chronicle-faction-crest" style={FACTION_PAGE_SLOTS.crest}>
        <EmblemImage emblem={view.emblem} size={Math.round(CREST_ART * scale)} label={view.emblemLabel} />
      </span>
      <header className="chronicle-faction-name" style={FACTION_PAGE_SLOTS.name}>
        <h3>{view.name}</h3>
        {view.kind === view.name ? null : <p className="chronicle-faction-kind">{view.kind}</p>}
        <p className="chronicle-faction-leader-name">{view.leader === null ? COPY.noLeader : view.leader.name}</p>
        {view.leader === null ? null : <p>{view.leader.line}</p>}
      </header>
      <div className="chronicle-faction-relation" role="meter" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={view.relation}
        aria-valuetext={view.relationText} aria-label={COPY.relationScaleLabel(view.relationText)} style={FACTION_PAGE_SLOTS.relation}>
        <span aria-hidden="true" className="chronicle-faction-track" style={{ backgroundImage: `url("${wave19Url("relation_scale_track")}")` }} />
        <span aria-hidden="true" className="chronicle-faction-pin" style={{ left: `${view.relationX * 100}%`, ...wave19ImageStyle("relation_scale_pin", Math.round(32 * scale)) }} />
      </div>
      <p className="chronicle-faction-reading" aria-hidden="true" style={FACTION_PAGE_SLOTS.relationText}>
        <span>{COPY.relationEnds[0]}</span><strong>{view.relationText}</strong><span>{COPY.relationEnds[1]}</span>
      </p>
      <section className="chronicle-faction-box" aria-label={COPY.demandsHeading} style={FACTION_PAGE_SLOTS.demands}>
        <h4>{COPY.demandsHeading}</h4>
        {view.demands.length === 0 ? <p className="chronicle-faction-empty">{COPY.demandsEmpty}</p>
          : <ul>{view.demands.map(line => <li key={line.key}>{line.line}</li>)}</ul>}
      </section>
      <section className="chronicle-faction-box" aria-label={COPY.promisesHeading} style={FACTION_PAGE_SLOTS.promises}>
        <h4>{COPY.promisesHeading}</h4>
        {view.promises.length === 0 ? <p className="chronicle-faction-empty">{COPY.promisesEmpty}</p>
          : <ul>{view.promises.map(line => <li key={line.key}>{line.line}</li>)}</ul>}
      </section>
      <section className="chronicle-faction-box chronicle-faction-box--memory" aria-label={COPY.memoryHeading} style={FACTION_PAGE_SLOTS.ourEvents}>
        <h4>{COPY.memoryHeading}</h4>
        {view.memory.length === 0 ? <p className="chronicle-faction-empty">{COPY.memoryEmpty}</p> : (
          <ul>{view.memory.map(record => (
            <li key={record.recordId}>
              <Button type="button" className="chronicle-faction-record" data-record={record.recordId} aria-label={COPY.recordLinkLabel(record.date, record.line)}
                onPress={() => onRecord(record.recordId, record.tick)} variant="secondary">
                <span className="chronicle-faction-date">{record.date}</span><span className="chronicle-faction-record-line">{record.line}</span>
              </Button>
            </li>
          ))}</ul>)}
      </section>
      <section className="chronicle-faction-box" aria-label={COPY.timelineHeading} style={FACTION_PAGE_SLOTS.theirEvents}>
        <h4>{COPY.timelineHeading}</h4>
        {view.timeline.length === 0 ? <p className="chronicle-faction-empty">{COPY.timelineEmpty}</p>
          : <ul tabIndex={0} aria-label={COPY.timelineHeading}>{view.timeline.map(line => <li key={line.key}><span className="chronicle-faction-date">{line.date}</span>{line.line}</li>)}</ul>}
      </section>
    </article>
  );
}
