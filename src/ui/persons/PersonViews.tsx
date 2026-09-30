import { useEffect, useState } from "react";
import { EmblemImage } from "../heraldry/EmblemImage";
import { portraitStyle } from "../portraitArt";
import { UiIcon } from "../UiIcon";
import { WAVE14_IMAGES } from "../wave14ArtManifest.generated";
import { frameArtSpaceStyle, frameToken } from "../frameBox";
import { assetUrlForBase } from "../../render/worldAssets";
import type { PersonCardView, PersonRow } from "./personModels";
import { PERSONS_COPY } from "./personsCopy.ko";
import { PERSON_STATE_COPY } from "./personStateCopy.ko";
import { personPortraitStateClass, personStateOrnamentStyle, type PersonStateId } from "./personStates";
import { Button } from "../kit";
import { artPatchStyle } from "../artPatch";
import { usePresentationPreference } from "../../render/PresentationToggle";

// UI-5 people on screen: a portrait (the pool's 96 px JPEG, the 256 px one at 2x; when the person's age band moves to
// the next picture of their aging chain the new one fades in over the old), a person chip (portrait, name, line — a
// button that opens the person card) and the person card (Wave 14 `frame_person_card`: the portrait in its recess, the
// lord's arms or a merchant's mark in its emblem slot — UI-7b: else the printed shield covered — name, role, life,
// house, and with the developer display how the portrait matches).
// INSTALL-23 ④: a portrait wears its person's state ornament (`personStates.ts`) over the frame's bottom-right — the
// ornament is not clipped by the round face — and a death draws the face greyscale; the state is also in words (the
// chip's line and button name, the card's line), so the small ornament is never the only sign.
// UI-AUDIT-1: the card's border is the painting's safe inset (frame kind `person-card`, its padding the gap); its parts
// stay in the art's own coordinates on a layer over the border box.
const FADE_MS = 600;
const CARD = WAVE14_IMAGES.frame_person_card;
/** UI-7b: the card's printed shield with its fleurons, and a blank parchment area to cover it with. */
const CARD_SHIELD = { x: 257, y: 20, width: 48, height: 60 } as const;
const CARD_BLANK = { x: 200, y: 96 } as const;
const CARD_SCALE = frameToken("person-card").scale;

export function PersonPortrait({ portraitId, size, className = "", ornament = null }: {
  readonly portraitId: string; readonly size: number; readonly className?: string; readonly ornament?: PersonStateId | null;
}) {
  const [shown, setShown] = useState(portraitId);
  const [previous, setPrevious] = useState<string | null>(null);
  useEffect(() => {
    if (portraitId === shown) return undefined;
    setPrevious(shown); setShown(portraitId);
    const timer = window.setTimeout(() => setPrevious(null), FADE_MS);
    return () => window.clearTimeout(timer);
  // why: the crossfade starts when the portrait id changes; the face shown until then is read at that moment
  }, [portraitId]); // eslint-disable-line react-hooks/exhaustive-deps
  const style = (id: string) => portraitStyle(id, size) ?? { width: size, height: size };
  return (
    <span className={`person-portrait ${personPortraitStateClass(ornament)} ${className}`} aria-hidden="true" data-portrait={shown}
      data-person-state={ornament ?? undefined} style={{ width: size, height: size }}>
      {previous === null ? null : <span className="person-portrait-layer person-portrait-layer--out" style={style(previous)} />}
      <span key={shown} className={`person-portrait-layer${previous === null ? "" : " person-portrait-layer--in"}`} style={style(shown)} />
      {ornament === null ? null : <span className="person-state-ornament" data-ornament={ornament} style={personStateOrnamentStyle(ornament, size)} />}
    </span>
  );
}

/** The chip's text: name, line, and the state in words when the portrait wears one. */
function PersonChipText({ row }: { readonly row: PersonRow }) {
  const state = row.ornament ?? null;
  return <span className="person-chip-text"><strong>{row.name}</strong><span>{row.line}</span>
    {state === null ? null : <span className="person-chip-state" data-person-state={state}>{PERSON_STATE_COPY.label(state)}</span>}</span>;
}

export function PersonChip({ row, onOpen, size = 48 }: { readonly row: PersonRow; readonly onOpen: (personId: string) => void; readonly size?: number }) {
  const state = row.ornament ?? null;
  return (
    <Button type="button" className="person-chip" data-person={row.id} data-portrait-exact={row.exact ? "true" : "false"}
      aria-label={state === null ? PERSONS_COPY.openCard(row.name) : PERSON_STATE_COPY.openCard(row.name, PERSON_STATE_COPY.label(state))}
      onPress={() => onOpen(row.id)} variant="secondary">
      <PersonPortrait portraitId={row.portraitId} size={size} ornament={state} />
      <PersonChipText row={row} />
    </Button>
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
        ? <span className="person-chip" data-person={row.id} data-portrait-exact={row.exact ? "true" : "false"}><PersonPortrait portraitId={row.portraitId} size={48} ornament={row.ornament ?? null} />
          <PersonChipText row={row} /></span>
        : <PersonChip row={row} onOpen={onOpen} />}</li>)}</ul>
      {shown.length === rows.length && !open ? null : <Button type="button" className="person-list-toggle" aria-expanded={open}
        onPress={() => setOpen(value => !value)} variant="toggle">{open ? PERSONS_COPY.membersFewer : PERSONS_COPY.membersAll(rows.length)}</Button>}
    </>
  );
}

const slot = (left: number, top: number, width: number, height: number) => ({ left: left * CARD_SCALE, top: top * CARD_SCALE, width: width * CARD_SCALE, height: height * CARD_SCALE });

export function PersonCardModal({ view, onClose, onBiography }: { readonly view: PersonCardView; readonly onClose: () => void; readonly onBiography: (personId: string) => void }) {
  const portrait = CARD.slots.portrait; const emblem = CARD.slots.emblem;
  const developer = usePresentationPreference("developerInfo");
  const cardUrl = assetUrlForBase(CARD.url, import.meta.env?.BASE_URL ?? "/");
  return (
    <div className="person-card-backdrop" role="presentation">
      <section className="person-card" data-frame="person-card" role="dialog" aria-modal="true" aria-label={PERSONS_COPY.cardTitle(view.name)} data-person={view.id}
        data-portrait={view.portraitId} data-portrait-exact={view.exact ? "true" : "false"}
        style={{ width: CARD.width * CARD_SCALE, height: CARD.height * CARD_SCALE, backgroundImage: `url("${cardUrl}")` }}>
        <div className="person-card-art" style={frameArtSpaceStyle("person-card")}>
        <span className="person-card-portrait" style={slot(portrait.x - portrait.radius, portrait.y - portrait.radius, portrait.radius * 2, portrait.radius * 2)}>
          <PersonPortrait portraitId={view.portraitId} size={Math.round(portrait.radius * 2 * CARD_SCALE)} ornament={view.ornament} />
        </span>
        {/* UI-7b: no arms or mark — the printed shield is covered with the card's own blank parchment. */}
        {view.emblem === null ? <span className="person-card-emblem-cover" aria-hidden="true" data-emblem-kind="none"
          style={artPatchStyle(cardUrl, CARD.width, CARD.height, CARD_SCALE, CARD_SHIELD, CARD_BLANK)} />
          : <span className="person-card-emblem" style={slot(emblem.x - emblem.width / 2, emblem.y - emblem.height / 2, emblem.width, emblem.height)}
            data-emblem-kind={view.emblem.kind}><EmblemImage emblem={view.emblem} size={Math.round(emblem.width * CARD_SCALE)} label={view.emblemLabel} /></span>}
        <div className="person-card-text" style={slot(112, 24, 146, 122)}>
          <h2>{view.name}</h2>
          <p>{view.role}</p>
          <p>{view.life}</p>
          <p>{view.household}</p>
          {view.ornament === null ? null : <p className="person-card-state" data-person-state={view.ornament}>{PERSON_STATE_COPY.cardLine(PERSON_STATE_COPY.label(view.ornament))}</p>}
          {view.deathCause === null ? null : <p className="person-card-cause">{view.deathCause}</p>}
          {developer ? <p className="person-card-match" data-exact={view.exact ? "true" : "false"}>{view.match}</p> : null}
          {view.emblem === null ? null : <p className="person-card-emblem-label">{view.emblemLabel}</p>}
        </div>
        <div className="person-card-actions" style={slot(112, 148, 196, 40)}>
          <Button type="button" className="person-card-action" onPress={() => onBiography(view.id)} variant="secondary"><UiIcon sheet="action" cell="log" />{PERSONS_COPY.biography}</Button>
          <Button type="button" className="person-card-action" aria-label={PERSONS_COPY.closeLabel} onPress={() => onClose()} variant="secondary">{PERSONS_COPY.close}</Button>
        </div>
        </div>
      </section>
    </div>
  );
}
