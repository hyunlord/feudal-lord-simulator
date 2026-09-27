import { useEffect, useState } from "react";
import { EmblemImage } from "../heraldry/EmblemImage";
import { portraitStyle } from "../portraitArt";
import { UiIcon } from "../UiIcon";
import { WAVE14_IMAGES } from "../wave14ArtManifest.generated";
import { assetUrlForBase } from "../../render/worldAssets";
import type { PersonCardView, PersonRow } from "./personModels";
import { PERSONS_COPY } from "./personsCopy.ko";

// UI-5 people on screen: a portrait (the pool's 96 px JPEG, the 256 px one at 2x; when the person's age band moves to
// the next picture of their aging chain the new one fades in over the old), a person chip (portrait, name, line — a
// button that opens the person card) and the person card (Wave 14 `frame_person_card`: the portrait in its recess, the
// lord's arms or a merchant's mark in its emblem slot, name, role, life, house, how the portrait matches).
const FADE_MS = 600;
const CARD = WAVE14_IMAGES.frame_person_card;
const CARD_SCALE = 1.5;

export function PersonPortrait({ portraitId, size, className = "" }: { readonly portraitId: string; readonly size: number; readonly className?: string }) {
  const [shown, setShown] = useState(portraitId);
  const [previous, setPrevious] = useState<string | null>(null);
  useEffect(() => {
    if (portraitId === shown) return undefined;
    setPrevious(shown); setShown(portraitId);
    const timer = window.setTimeout(() => setPrevious(null), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [portraitId]); // eslint-disable-line react-hooks/exhaustive-deps
  const style = (id: string) => portraitStyle(id, size) ?? { width: size, height: size };
  return (
    <span className={`person-portrait ${className}`} aria-hidden="true" data-portrait={shown} style={{ width: size, height: size }}>
      {previous === null ? null : <span className="person-portrait-layer person-portrait-layer--out" style={style(previous)} />}
      <span key={shown} className={`person-portrait-layer${previous === null ? "" : " person-portrait-layer--in"}`} style={style(shown)} />
    </span>
  );
}

export function PersonChip({ row, onOpen, size = 48 }: { readonly row: PersonRow; readonly onOpen: (personId: string) => void; readonly size?: number }) {
  return (
    <button type="button" className="person-chip" data-person={row.id} data-portrait-exact={row.exact ? "true" : "false"} aria-label={PERSONS_COPY.openCard(row.name)}
      onClick={() => onOpen(row.id)}>
      <PersonPortrait portraitId={row.portraitId} size={size} />
      <span className="person-chip-text"><strong>{row.name}</strong><span>{row.line}</span></span>
    </button>
  );
}

/** A house's members: the first few (head, spouse, then by age), the rest behind [식구 N명 모두 보기] so a crowded house
 * does not push the card's own sections away. */
const FIRST_MEMBERS = 4;
export function PersonList({ rows, onOpen }: { readonly rows: readonly PersonRow[]; readonly onOpen: ((personId: string) => void) | undefined }) {
  const [open, setOpen] = useState(false);
  const shown = open || rows.length <= FIRST_MEMBERS + 1 ? rows : rows.slice(0, FIRST_MEMBERS);
  return (
    <>
      <ul className="person-list">{shown.map(row => <li key={row.id}>{onOpen === undefined
        ? <span className="person-chip" data-person={row.id} data-portrait-exact={row.exact ? "true" : "false"}><PersonPortrait portraitId={row.portraitId} size={48} />
          <span className="person-chip-text"><strong>{row.name}</strong><span>{row.line}</span></span></span>
        : <PersonChip row={row} onOpen={onOpen} />}</li>)}</ul>
      {shown.length === rows.length && !open ? null : <button type="button" className="person-list-toggle" aria-expanded={open}
        onClick={() => setOpen(value => !value)}>{open ? PERSONS_COPY.membersFewer : PERSONS_COPY.membersAll(rows.length)}</button>}
    </>
  );
}

const slot = (left: number, top: number, width: number, height: number) => ({ left: left * CARD_SCALE, top: top * CARD_SCALE, width: width * CARD_SCALE, height: height * CARD_SCALE });

export function PersonCardModal({ view, onClose, onBiography }: { readonly view: PersonCardView; readonly onClose: () => void; readonly onBiography: (personId: string) => void }) {
  const portrait = CARD.slots.portrait; const emblem = CARD.slots.emblem;
  return (
    <div className="person-card-backdrop" role="presentation">
      <section className="person-card" role="dialog" aria-modal="true" aria-label={PERSONS_COPY.cardTitle(view.name)} data-person={view.id}
        data-portrait={view.portraitId} data-portrait-exact={view.exact ? "true" : "false"}
        style={{ width: CARD.width * CARD_SCALE, height: CARD.height * CARD_SCALE, backgroundImage: `url("${assetUrlForBase(CARD.url, import.meta.env?.BASE_URL ?? "/")}")` }}>
        <span className="person-card-portrait" style={slot(portrait.x - portrait.radius, portrait.y - portrait.radius, portrait.radius * 2, portrait.radius * 2)}>
          <PersonPortrait portraitId={view.portraitId} size={Math.round(portrait.radius * 2 * CARD_SCALE)} />
        </span>
        <span className="person-card-emblem" style={slot(emblem.x - emblem.width / 2, emblem.y - emblem.height / 2, emblem.width, emblem.height)}
          data-emblem-kind={view.emblem?.kind ?? "none"}>
          {view.emblem === null ? null : <EmblemImage emblem={view.emblem} size={Math.round(emblem.width * CARD_SCALE)} label={view.emblemLabel} />}
        </span>
        <div className="person-card-text" style={slot(112, 24, 146, 122)}>
          <h2>{view.name}</h2>
          <p>{view.role}</p>
          <p>{view.life}</p>
          <p>{view.household}</p>
          <p className="person-card-match" data-exact={view.exact ? "true" : "false"}>{view.match}</p>
          {view.emblem === null ? null : <p className="person-card-emblem-label">{view.emblemLabel}</p>}
        </div>
        <div className="person-card-actions" style={slot(112, 148, 196, 40)}>
          <button type="button" className="person-card-action" onClick={() => onBiography(view.id)}><UiIcon sheet="action" cell="log" />{PERSONS_COPY.biography}</button>
          <button type="button" className="person-card-action" aria-label={PERSONS_COPY.closeLabel} onClick={() => onClose()}>{PERSONS_COPY.close}</button>
        </div>
      </section>
    </div>
  );
}
