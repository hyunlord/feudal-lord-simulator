import { useEffect, useState, type CSSProperties } from "react";
import { EmblemImage } from "../heraldry/EmblemImage";
import { portraitStyle } from "../portraitArt";
import { UiIcon } from "../UiIcon";
import { WAVE14_IMAGES } from "../wave14ArtManifest.generated";
import { frameArtSpaceStyle, frameBoxStyle, frameSafe } from "../frameBox";
import { FRAME_GAP } from "../frameTokens.generated";
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
// UI-AUDIT-1: the card's border is the painting's safe inset (frame kind `person-card`, its padding the gap) at the
// card's own scale; the text and the buttons are rows in that content box, and the painting (a 9-slice that grows down),
// the portrait and the shield's cover stay in the art's own coordinates on a layer over the border box.
const FADE_MS = 600;
const CARD = WAVE14_IMAGES.frame_person_card;
/** UI-7b: the card's printed shield with its fleurons (x 260–304, y 23–75), covered inside the inner rule (y 20–22 and
 * x 305–307 stay printed), and a blank parchment area to cover it with. */
const CARD_SHIELD = { x: 258, y: 23, width: 47, height: 54 } as const;
const CARD_BLANK = { x: 200, y: 96 } as const;

export function PersonPortrait({ portraitId, size, className = "", ornament = null, ornamentBox }: {
  readonly portraitId: string; readonly size: number; readonly className?: string; readonly ornament?: PersonStateId | null;
  /** Where the ornament's canvas lies over the portrait (default: the portrait's square). */
  readonly ornamentBox?: CSSProperties;
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
      {ornament === null ? null : <span className="person-state-ornament" data-ornament={ornament} style={{ ...personStateOrnamentStyle(ornament, size), ...ornamentBox }} />}
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

/** UI-AUDIT-1: the card is the medium box wide (NAT-1 `--box-w-medium`: 360, 414 on a coarse pointer), so the painting
 * is drawn at that width over its 320; its height is its rows' (at least the painting's own 200 × scale). */
const CARD_WIDTH = { fine: 360, coarse: 414 } as const;
/** The painting as a 9-slice that only grows down (art px): the top keeps the ring and the shield (the ring's lower
 * fleuron ends at y 139), the bottom the inner rule (y 177–179) and the wood; the band between is plain (PIL). */
const CARD_SLICE = { top: 140, right: 64, bottom: 24, left: 112 } as const;
/** The printed ring (PIL, UI-AUDIT-1 survey §4): centre (59.5, 83.5), its opening r 33.5. The manifest's portrait slot
 * (60, 94, r 39) sits 10 art px low and is wider than the ring. */
const CARD_RING = { x: 59.5, y: 83.5, opening: 33.5 } as const;
/** The state ornament on the ring's bottom-right: its canvas `size` art px square, the canvas's far corner `far` px right
 * and down of the ring's centre, so every Wave 23 ornament stays within 37 art px of it (on the printed ring, never
 * outside it); the canvas beyond the face's square is clipped (it is transparent there). */
const CARD_ORNAMENT = { size: 80, far: 28 } as const;
/** The text column starts past the ring's right fleuron (x 104). */
const CARD_TEXT_LEFT = 108;

const COARSE_POINTER = "(pointer: coarse)";
const coarseQuery = () => typeof window === "undefined" || typeof window.matchMedia !== "function" ? null : window.matchMedia(COARSE_POINTER);
/** Whether the pointer is coarse (the touch box widths), following a change. */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => coarseQuery()?.matches ?? false);
  useEffect(() => {
    const query = coarseQuery();
    if (query === null) return undefined;
    const update = () => setCoarse(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return coarse;
}

export function PersonCardModal({ view, onClose, onBiography }: { readonly view: PersonCardView; readonly onClose: () => void; readonly onBiography: (personId: string) => void }) {
  const emblem = CARD.slots.emblem;
  const developer = usePresentationPreference("developerInfo");
  const cardUrl = assetUrlForBase(CARD.url, import.meta.env?.BASE_URL ?? "/");
  const scale = (useCoarsePointer() ? CARD_WIDTH.coarse : CARD_WIDTH.fine) / CARD.width;
  const art = (value: number) => value * scale;
  const safe = frameSafe("person-card", scale);
  const face = Math.round(art(CARD_RING.opening * 2));
  const ornamentAt = face / 2 + art(CARD_ORNAMENT.far - CARD_ORNAMENT.size);
  const { top, right, bottom, left } = CARD_SLICE;
  const sliceWidth = `${art(top)}px ${art(right)}px ${art(bottom)}px ${art(left)}px`;
  // why: the painting's 9-slice is handed to the art layer's ::before as custom properties (React has no type for them)
  const artLayer = { ...frameArtSpaceStyle("person-card", scale), "--person-card-art": `url("${cardUrl}") ${top} ${right} ${bottom} ${left} fill / ${sliceWidth} / 0 stretch`,
    "--person-card-art-width": sliceWidth } as CSSProperties;
  return (
    <div className="person-card-backdrop" role="presentation">
      <section className="person-card" data-frame="person-card" role="dialog" aria-modal="true" aria-label={PERSONS_COPY.cardTitle(view.name)} data-person={view.id}
        data-portrait={view.portraitId} data-portrait-exact={view.exact ? "true" : "false"}
        style={{ ...frameBoxStyle("person-card", scale), width: art(CARD.width), minHeight: art(CARD.height),
          gridTemplateColumns: `${art(CARD_TEXT_LEFT) - safe.left - FRAME_GAP}px minmax(0, 1fr)` }}>
        <div className="person-card-art" style={artLayer}>
          <span className="person-card-portrait" style={{ left: art(CARD_RING.x) - face / 2, top: art(CARD_RING.y) - face / 2, width: face, height: face }}>
            <PersonPortrait portraitId={view.portraitId} size={face} ornament={view.ornament}
              ornamentBox={{ left: ornamentAt, top: ornamentAt, width: art(CARD_ORNAMENT.size), height: art(CARD_ORNAMENT.size) }} />
          </span>
          {/* UI-7b: the printed shield is covered with the card's own blank parchment; the arms or mark, when there are any,
              sit in the text column's corner inside the content box. */}
          <span className="person-card-emblem-cover" aria-hidden="true" data-emblem-kind={view.emblem === null ? "none" : undefined}
            style={artPatchStyle(cardUrl, CARD.width, CARD.height, scale, CARD_SHIELD, CARD_BLANK)} />
        </div>
        <div className="person-card-text">
          {view.emblem === null ? null : <span className="person-card-emblem" style={{ width: art(emblem.width), height: art(emblem.height) }}
            data-emblem-kind={view.emblem.kind}><EmblemImage emblem={view.emblem} size={Math.round(art(emblem.width))} label={view.emblemLabel} /></span>}
          <h2>{view.name}</h2>
          <p>{view.role}</p>
          <p>{view.life}</p>
          <p>{view.household}</p>
          {view.ornament === null ? null : <p className="person-card-state" data-person-state={view.ornament}>{PERSON_STATE_COPY.cardLine(PERSON_STATE_COPY.label(view.ornament))}</p>}
          {view.deathCause === null ? null : <p className="person-card-cause">{view.deathCause}</p>}
          {developer ? <p className="person-card-match" data-exact={view.exact ? "true" : "false"}>{view.match}</p> : null}
          {view.emblem === null ? null : <p className="person-card-emblem-label">{view.emblemLabel}</p>}
        </div>
        <div className="person-card-actions">
          <Button type="button" className="person-card-action" onPress={() => onBiography(view.id)} variant="secondary"><UiIcon sheet="action" cell="log" />{PERSONS_COPY.biography}</Button>
          <Button type="button" className="person-card-action" aria-label={PERSONS_COPY.closeLabel} onPress={() => onClose()} variant="secondary">{PERSONS_COPY.close}</Button>
        </div>
      </section>
    </div>
  );
}
