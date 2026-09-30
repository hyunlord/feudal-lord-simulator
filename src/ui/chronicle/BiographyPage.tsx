import type { CSSProperties } from "react";
import { portraitStyle } from "../portraitArt";
import { PERSON_STATE_COPY } from "../persons/personStateCopy.ko";
import { personPortraitStateClass, personStateOrnamentStyle } from "../persons/personStates";
import { wave19ImageStyle, wave19Url } from "../wave19Art";
import type { BiographyView } from "./chronicleScreenModel";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";
import { Button } from "../kit";
import { artPatchStyle } from "../artPatch";
import { EmblemImage } from "../heraldry/EmblemImage";
import { usePresentationPreference } from "../../render/PresentationToggle";
import { frameArtSpaceStyle, frameBoxStyle } from "../frameBox";
import { slotInside, type ArtRect } from "./paintedSlots";

// CHRON-1 biography (CHRONICLE_DESIGN 2.2): the Wave 19 `frame_biography` page (640 x 800 art, drawn at one scale so
// its printed slots stay where they are): the portrait in the great circle (the pool picture of the person's age now;
// UI-7b: how it was chosen only with the developer display), a house's arms in the shield and a merchant's mark in the
// small circle (UI-7b: an empty one covered with the page's own blank parchment; family stays in the relations below),
// the name, the life and the house at the top of the right column (UI-7: with what they have of their parents,
// "닮은 점"), the life along the page's own line (`biography_life_dot`, `biography_life_end` for a death or a leaving),
// then the household and the offices, and the records they share with the town. UI-AUDIT-1: the page's border is the
// painting's safe inset at the page's scale (frame kind `biography`), its parts in the art's coordinates over it.
export const BIOGRAPHY_PAGE = { width: 640, height: 800 } as const;

/** A slot on the page art, in art pixels (measured on frame_biography.png). */
const slot = (left: number, top: number, width: number, height: number): CSSProperties =>
  ({ left: `${left / 6.4}%`, top: `${top / 8}%`, width: `${width / 6.4}%`, height: `${height / 8}%` });
/** The printed circle, shield and small circle (their art is the frame's; the audit reads them as slots). */
const SLOTS = { portrait: slot(62, 117, 196, 196), arms: slot(52, 352, 96, 116), mark: slot(189, 370, 86, 86) } as const;
/** UI-AUDIT-1: the text slots, cut to the page's content box at its scale (paintedSlots.ts). */
const TEXT_SLOTS = {
  match: { left: 36, top: 494, width: 262, height: 44 }, header: { left: 330, top: 44, width: 272, height: 146 }, life: { left: 296, top: 196, width: 310, height: 326 },
  relations: { left: 40, top: 556, width: 562, height: 90 }, records: { left: 40, top: 660, width: 562, height: 106 },
} as const satisfies Record<string, ArtRect>;

/** UI-7b: the printed shield and small circle (with their fleurons) and a blank parchment area of the right column to cover them with. */
const PRINTED = { arms: { x: 42, y: 338, width: 114, height: 148 }, mark: { x: 166, y: 346, width: 134, height: 136 } } as const;
const BLANK = { arms: { x: 340, y: 310 }, mark: { x: 460, y: 320 } } as const;

export function BiographyPage({ view, scale, onPerson, onRecord }: {
  readonly view: BiographyView; readonly scale: number; readonly onPerson: (personId: string) => void; readonly onRecord: (recordId: string, tick: number) => void;
}) {
  const portrait = portraitStyle(view.portraitId, Math.round(196 * scale));
  const developer = usePresentationPreference("developerInfo");
  const page = wave19Url("frame_biography");
  const text = (key: keyof typeof TEXT_SLOTS) => slotInside("biography", BIOGRAPHY_PAGE, scale, TEXT_SLOTS[key]);
  const cover = (key: keyof typeof PRINTED) => <span className={`chronicle-biography-cover chronicle-biography-cover--${key}`} aria-hidden="true"
    style={artPatchStyle(page, BIOGRAPHY_PAGE.width, BIOGRAPHY_PAGE.height, scale, PRINTED[key], BLANK[key], "var(--palette-parchment)")} />;
  return (
    <article className="chronicle-biography" data-frame="biography" aria-label={COPY.biographyTitle(view.name)} data-person={view.id} data-portrait={view.portraitId}
      data-portrait-exact={view.portraitExact ? "true" : "false"}
      style={{ width: BIOGRAPHY_PAGE.width * scale, height: BIOGRAPHY_PAGE.height * scale, backgroundImage: `url("${page}")`, ...frameBoxStyle("biography", scale) }}>
      <div className="chronicle-page-art" style={frameArtSpaceStyle("biography", scale)}>
      <span className={`chronicle-biography-portrait ${personPortraitStateClass(view.ornament) === "" ? "" : "portrait-greyscale"}`} role="img"
        aria-label={view.ornament === null ? view.portraitLine : PERSON_STATE_COPY.withState(view.portraitLine, PERSON_STATE_COPY.label(view.ornament))}
        data-person-state={view.ornament ?? undefined} style={{ ...SLOTS.portrait, ...portrait }} />
      {/* INSTALL-23 ④: the state ornament over the great circle's bottom-right (a sibling: the greyscale stays on the face). */}
      {view.ornament === null ? null : <span className="chronicle-biography-ornament person-state-ornament" aria-hidden="true" data-ornament={view.ornament}
        style={{ ...SLOTS.portrait, ...personStateOrnamentStyle(view.ornament, Math.round(196 * scale)) }} />}
      {view.arms === null ? cover("arms") : <span className="chronicle-biography-arms" style={SLOTS.arms}><EmblemImage emblem={view.arms} size={Math.round(96 * scale)} label={view.emblemLabel} /></span>}
      {view.mark === null ? cover("mark") : <span className="chronicle-biography-mark" style={SLOTS.mark}><EmblemImage emblem={view.mark} size={Math.round(86 * scale)} label={view.emblemLabel} /></span>}
      {developer ? <p className="chronicle-biography-match" data-exact={view.portraitExact ? "true" : "false"} style={text("match")}>{view.portraitLine}</p> : null}
      <header className="chronicle-biography-header" style={text("header")}>
        <h3>{view.name}</h3>
        <p>{view.life}</p>
        {view.deathCause === null ? null : <p className="chronicle-biography-cause">{view.deathCause}</p>}
        <p>{COPY.roleHousehold(view.role, view.household)}</p>
        {view.offices.map(office => <p key={office} className="chronicle-biography-office">{COPY.employment(office)}</p>)}
        {/* UI-7: the resemblance last in the header slot (it clips there, never over the life below). */}
        {view.resemblance === null ? null : <p className="chronicle-biography-resemblance">{view.resemblance}</p>}
      </header>
      <section className="chronicle-biography-life" aria-label={COPY.lifeHeading} style={text("life")}>
        {view.events.length === 0 ? <p className="chronicle-biography-empty">{COPY.lifeEmpty}</p> : (
          <ol>{view.events.map(event => (
            <li key={event.id} data-last={event.last ? "true" : undefined}>
              <span className="chronicle-biography-dot" aria-hidden="true" style={wave19ImageStyle(event.last ? "biography_life_end" : "biography_life_dot", 16)} />
              <span className="chronicle-biography-date">{event.date}</span>
              <span>{event.sentence}</span>
            </li>
          ))}</ol>)}
      </section>
      <section className="chronicle-biography-band" aria-label={COPY.relationsHeading} style={text("relations")}>
        <h4>{view.survivors ? COPY.survivors : COPY.relationsHeading}</h4>
        {view.relations.length === 0 ? <p className="chronicle-biography-empty">{COPY.noRelations}</p> : (
          <ul>{view.relations.map(relation => {
            const face = relation.portraitId === null ? null : portraitStyle(relation.portraitId, 32);
            return <li key={relation.id}><Button type="button" className="chronicle-biography-chip" onPress={() => onPerson(relation.id)} variant="secondary">
              {face === null ? null : <span aria-hidden="true" className="chronicle-biography-chip-face" style={face} />}{relation.line}</Button></li>;
          })}</ul>)}
      </section>
      <section className="chronicle-biography-band" aria-label={COPY.recordsHeading} style={text("records")}>
        <h4>{COPY.recordsHeading}</h4>
        {view.records.length === 0 ? <p className="chronicle-biography-empty">{COPY.recordsEmpty}</p> : (
          <ul>{view.records.map(record => (
            <li key={record.id}><Button type="button" className="chronicle-biography-chip chronicle-biography-record" onPress={() => onRecord(record.id, record.tick)} variant="secondary">
              <span className="chronicle-biography-date">{record.date}</span>{record.sentence}</Button></li>
          ))}</ul>)}
      </section>
      </div>
    </article>
  );
}
