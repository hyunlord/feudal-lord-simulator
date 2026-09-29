import type { CSSProperties } from "react";
import { EmblemImage } from "../heraldry/EmblemImage";
import { Button } from "../kit";
import { portraitStyle } from "../portraitArt";
import { personPortraitStateClass, personStateOrnamentStyle } from "../persons/personStates";
import { wave19ImageStyle, wave19Url } from "../wave19Art";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";
import { leaderName, type FactionPageView } from "./factionTabModel";
// UI-9: revolt pressure section (RG-8) below the faction page art frame.
import { FACTION_INFLUENCE_COPY as INFLUENCE } from "./factionInfluenceCopy.ko";

// CHRON-2 faction chronicle page (CHRONICLE_DESIGN 2.3; UI-6 first pass). The Wave 19 `frame_faction_page` (640 x 800
// art, drawn at one scale so its printed slots stay where they are): the leader's portrait in the circle, the arms in
// the shield, the faction's name with its leader beside them, the relation scale (`relation_scale_track` +
// `relation_scale_pin`, hostile −100 to friendly +100) with its reading under it, the demands and the promises in the
// two boxes, and in the long box at the foot the records it remembers (each a link: that record in the chronicle) and
// its own timeline.
export const FACTION_PAGE = { width: 640, height: 800 } as const;

const slot = (left: number, top: number, width: number, height: number): CSSProperties =>
  ({ left: `${left / 6.4}%`, top: `${top / 8}%`, width: `${width / 6.4}%`, height: `${height / 8}%` });
/**
 * UI-6b: the art drawn in horizontal bands, so the records' box at the foot is taller and the demands' and promises'
 * boxes shorter, their ornaments untouched: rows 380–520 (the two boxes' plain sides, 371–530 on the art) are drawn
 * 70 px tall, rows 610–730 (the foot box's plain sides, 603–738) 190 px; the rest at its size. The page stays 800 tall.
 */
export const FACTION_PAGE_BANDS: readonly Readonly<{ from: number; to: number; at: number; height: number }>[] = [
  { from: 0, to: 380, at: 0, height: 380 }, { from: 380, to: 520, at: 380, height: 70 }, { from: 520, to: 610, at: 450, height: 90 },
  { from: 610, to: 730, at: 540, height: 190 }, { from: 730, to: 800, at: 730, height: 70 },
];
/** Measured on frame_faction_page.png, then moved with the bands (the boxes 70 shorter, the foot box 70 taller). */
export const FACTION_PAGE_SLOTS = {
  leader: slot(66, 92, 148, 148), crest: slot(490, 92, 88, 104), name: slot(236, 84, 240, 180), relation: slot(70, 296, 500, 32),
  relationText: slot(70, 330, 500, 24), demands: slot(50, 364, 266, 102), promises: slot(326, 364, 268, 102),
  ourEvents: slot(50, 528, 276, 218), theirEvents: slot(326, 528, 268, 218),
} as const;

function PageArt({ scale }: { readonly scale: number }) {
  const url = `url("${wave19Url("frame_faction_page")}")`;
  return <>{FACTION_PAGE_BANDS.map(band => {
    const stretch = band.height / (band.to - band.from);
    return <span key={band.from} className="chronicle-faction-band" aria-hidden="true" style={{ top: band.at * scale, height: band.height * scale, backgroundImage: url,
      backgroundSize: `${FACTION_PAGE.width * scale}px ${FACTION_PAGE.height * scale * stretch}px`, backgroundPosition: `0 ${-band.from * scale * stretch}px` }} />;
  })}</>;
}

/** The shield's inside on the art (the printed outline around it stays visible). */
const CREST_ART = 88;

export function FactionPage({ view, scale, onRecord }: {
  readonly view: FactionPageView; readonly scale: number; readonly onRecord: (recordId: string, tick: number) => void;
}) {
  const leader = view.leader === null ? null : portraitStyle(view.leader.portraitId, Math.round(148 * scale));
  // UI-9: revolt pressure goes AFTER the art frame in document order; the art frame is position:absolute-based so adding
  // content inside it would escape the 640×800 box. Wrapping in a fragment keeps the parent's justify-items:center layout.
  return (
    <>
    <article className="chronicle-faction" aria-label={COPY.factionTitle(view.name)} data-faction={view.id} data-relation={view.relation}
      style={{ width: FACTION_PAGE.width * scale, height: FACTION_PAGE.height * scale }}>
      <PageArt scale={scale} />
      {leader === null || view.leader === null ? null
        : <span className={`chronicle-faction-leader ${personPortraitStateClass(view.leader.ornament) === "" ? "" : "portrait-greyscale"}`} role="img"
          aria-label={leaderName(view.leader)} data-portrait={view.leader.portraitId} data-person-state={view.leader.ornament ?? undefined}
          style={{ ...FACTION_PAGE_SLOTS.leader, ...leader }} />}
      {view.leader === null || view.leader.ornament === undefined || view.leader.ornament === null ? null : <span className="chronicle-faction-ornament person-state-ornament" aria-hidden="true"
        data-ornament={view.leader.ornament} style={{ ...FACTION_PAGE_SLOTS.leader, ...personStateOrnamentStyle(view.leader.ornament, Math.round(148 * scale)) }} />}
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
    {/* UI-9: RG-8 revolt pressure — below the art frame, width matching the scaled page. */}
    {view.revoltPressure !== null ? (
      <section className="chronicle-faction-pressure" aria-label={INFLUENCE.pressureHeading}
        style={{ width: FACTION_PAGE.width * scale }}>
        <h4>{INFLUENCE.pressureHeading}</h4>
        <p>{view.revoltPressure.totalLabel}</p>
        <p className="chronicle-faction-pressure-threshold">{view.revoltPressure.thresholdLine}</p>
        {view.revoltPressure.causes.length > 0
          ? <ul>{view.revoltPressure.causes.map(c => <li key={c.key}>{c.line}</li>)}</ul>
          : null}
        {view.revoltPressure.outcome !== null
          ? <p className="chronicle-faction-pressure-outcome">{view.revoltPressure.outcome}</p>
          : null}
      </section>
    ) : null}
    </>
  );
}
