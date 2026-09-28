import type { CSSProperties } from "react";
import { portraitStyle } from "../portraitArt";
import { PERSON_STATE_COPY } from "../persons/personStateCopy.ko";
import { personPortraitStateClass, personStateOrnamentStyle } from "../persons/personStates";
import { wave19ImageStyle, wave19Url } from "../wave19Art";
import type { BiographyView } from "./chronicleScreenModel";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";
import { Button } from "../kit";

// CHRON-1 biography (CHRONICLE_DESIGN 2.2): the Wave 19 `frame_biography` page (640 x 800 art, drawn at one scale so
// its printed slots stay where they are): the portrait in the great circle (the pool picture of the person's age now,
// with how well it matches), the spouse or the head of the house in the small one, the name, the life and the house
// at the top of the right column (UI-7: with what they have of their parents, "닮은 점"), the life along the page's own line (`biography_life_dot`, `biography_life_end` for
// a death or a leaving), then the household and the offices, and the records they share with the town.
export const BIOGRAPHY_PAGE = { width: 640, height: 800 } as const;

/** A slot on the page art, in art pixels (measured on frame_biography.png). */
const slot = (left: number, top: number, width: number, height: number): CSSProperties =>
  ({ left: `${left / 6.4}%`, top: `${top / 8}%`, width: `${width / 6.4}%`, height: `${height / 8}%` });
const SLOTS = {
  portrait: slot(62, 117, 196, 196), companion: slot(189, 370, 86, 86), companionCaption: slot(170, 470, 124, 20), match: slot(36, 494, 262, 44),
  header: slot(330, 44, 272, 146), life: slot(296, 196, 310, 326), relations: slot(40, 556, 562, 90), records: slot(40, 660, 562, 106),
} as const;

export function BiographyPage({ view, scale, onPerson, onRecord }: {
  readonly view: BiographyView; readonly scale: number; readonly onPerson: (personId: string) => void; readonly onRecord: (recordId: string, tick: number) => void;
}) {
  const portrait = portraitStyle(view.portraitId, Math.round(196 * scale));
  const companion = view.companion === null ? null : portraitStyle(view.companion.portraitId, Math.round(86 * scale));
  return (
    <article className="chronicle-biography" aria-label={COPY.biographyTitle(view.name)} data-person={view.id} data-portrait={view.portraitId}
      data-portrait-exact={view.portraitExact ? "true" : "false"}
      style={{ width: BIOGRAPHY_PAGE.width * scale, height: BIOGRAPHY_PAGE.height * scale, backgroundImage: `url("${wave19Url("frame_biography")}")` }}>
      <span className={`chronicle-biography-portrait ${personPortraitStateClass(view.ornament) === "" ? "" : "portrait-greyscale"}`} role="img"
        aria-label={view.ornament === null ? view.portraitLine : PERSON_STATE_COPY.withState(view.portraitLine, PERSON_STATE_COPY.label(view.ornament))}
        data-person-state={view.ornament ?? undefined} style={{ ...SLOTS.portrait, ...portrait }} />
      {/* INSTALL-23 ④: the state ornament over the great circle's bottom-right (a sibling: the greyscale stays on the face). */}
      {view.ornament === null ? null : <span className="chronicle-biography-ornament person-state-ornament" aria-hidden="true" data-ornament={view.ornament}
        style={{ ...SLOTS.portrait, ...personStateOrnamentStyle(view.ornament, Math.round(196 * scale)) }} />}
      {companion === null || view.companion === null ? null : <>
        <span className="chronicle-biography-companion" aria-hidden="true" style={{ ...SLOTS.companion, ...companion }} />
        <span className="chronicle-biography-caption" style={SLOTS.companionCaption}>{view.companion.label}</span>
      </>}
      <p className="chronicle-biography-match" data-exact={view.portraitExact ? "true" : "false"} style={SLOTS.match}>{view.portraitLine}</p>
      <header className="chronicle-biography-header" style={SLOTS.header}>
        <h3>{view.name}</h3>
        <p>{view.life}</p>
        <p>{COPY.roleHousehold(view.role, view.household)}</p>
        {view.offices.map(office => <p key={office} className="chronicle-biography-office">{COPY.employment(office)}</p>)}
        {/* UI-7: the resemblance last in the header slot (it clips there, never over the life below). */}
        {view.resemblance === null ? null : <p className="chronicle-biography-resemblance">{view.resemblance}</p>}
      </header>
      <section className="chronicle-biography-life" aria-label={COPY.lifeHeading} style={SLOTS.life}>
        {view.events.length === 0 ? <p className="chronicle-biography-empty">{COPY.lifeEmpty}</p> : (
          <ol>{view.events.map(event => (
            <li key={event.id} data-last={event.last ? "true" : undefined}>
              <span className="chronicle-biography-dot" aria-hidden="true" style={wave19ImageStyle(event.last ? "biography_life_end" : "biography_life_dot", 16)} />
              <span className="chronicle-biography-date">{event.date}</span>
              <span>{event.sentence}</span>
            </li>
          ))}</ol>)}
      </section>
      <section className="chronicle-biography-band" aria-label={COPY.relationsHeading} style={SLOTS.relations}>
        <h4>{view.survivors ? COPY.survivors : COPY.relationsHeading}</h4>
        {view.relations.length === 0 ? <p className="chronicle-biography-empty">{COPY.noRelations}</p> : (
          <ul>{view.relations.map(relation => {
            const face = relation.portraitId === null ? null : portraitStyle(relation.portraitId, 32);
            return <li key={relation.id}><Button type="button" className="chronicle-biography-chip" onPress={() => onPerson(relation.id)} variant="secondary">
              {face === null ? null : <span aria-hidden="true" className="chronicle-biography-chip-face" style={face} />}{relation.line}</Button></li>;
          })}</ul>)}
      </section>
      <section className="chronicle-biography-band" aria-label={COPY.recordsHeading} style={SLOTS.records}>
        <h4>{COPY.recordsHeading}</h4>
        {view.records.length === 0 ? <p className="chronicle-biography-empty">{COPY.recordsEmpty}</p> : (
          <ul>{view.records.map(record => (
            <li key={record.id}><Button type="button" className="chronicle-biography-chip chronicle-biography-record" onPress={() => onRecord(record.id, record.tick)} variant="secondary">
              <span className="chronicle-biography-date">{record.date}</span>{record.sentence}</Button></li>
          ))}</ul>)}
      </section>
    </article>
  );
}
