import type { CSSProperties } from "react";
import { UiIcon } from "../UiIcon";
import { frameSafe, frameToken } from "../frameBox";
import { FRAME_GAP } from "../frameTokens.generated";
import { WAVE19_FRAME_KIND, wave19FrameLayerStyle } from "../wave19Art";
import { ChronicleArtView } from "./ChronicleArtView";
import type { RecordCard } from "./chronicleScreenModel";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";
import { Button } from "../kit";

// CHRON-1 record card (CHRONICLE_DESIGN 2.1): the kind's Wave 19 frame (drawn at CARD_SCALE: 320 x 160 art -> 112 px
// tall, stretched across), the record's picture, its date, one line and its numbers; [위치로] moves the current map's
// camera to the place, [그때 지도] shows the map as it was, [인물] opens the person's biography, [세력] (UI-6) the faction's page. The card body selects it.
// UI-AUDIT-1: the card's border is its frame's safe inset (frame kinds `record-*`, all drawn at the tokens' 0.7), its
// padding the gap; the card is as tall as its tallest frame box around the picture (the text's three lines fit the same
// 76 px), so every row of the virtual list keeps one height.
export const CARD_SCALE = frameToken("record-event").scale;
const ART_SIZE = 76;
const PORTRAIT_SIZE = 44;
const RECORD_KINDS = ["record-decision", "record-era", "record-event", "record-ledger", "record-milestone", "record-person"] as const;
export const CARD_HEIGHT = Math.max(...RECORD_KINDS.map(kind => { const safe = frameSafe(kind); return safe.top + safe.bottom; })) + 2 * FRAME_GAP + ART_SIZE;
/** One virtual list row: the card and the gap under it. */
export const CARD_ROW = CARD_HEIGHT + 8;

export function RecordCardView({ card, selected, position, total, style, onSelect, onLookAt, onMap, onPerson, onFaction }: {
  readonly card: RecordCard; readonly selected: boolean; readonly position: number; readonly total: number; readonly style: CSSProperties;
  readonly onSelect: (id: string) => void; readonly onLookAt: (tile: { readonly tx: number; readonly ty: number }) => void;
  readonly onMap: (id: string) => void; readonly onPerson: (personId: string) => void;
  /** UI-6: [세력] opens the faction's page (a relation record's faction, a petition's or a war record's). */
  readonly onFaction: (factionId: string) => void;
}) {
  return (
    <article className={`chronicle-card chronicle-card--${card.kind}${card.folded ? " chronicle-card--folded" : ""}`} data-frame={WAVE19_FRAME_KIND[card.frame]} role="listitem" aria-setsize={total} aria-posinset={position}
      data-record={card.id} data-kind={card.kind} data-place={card.place === null ? undefined : `${card.place.tx},${card.place.ty}`}
      data-selected={selected ? "true" : undefined} style={{ height: CARD_HEIGHT, ...style }}>
      <span className="chronicle-card-frame" aria-hidden="true" style={wave19FrameLayerStyle(card.frame, CARD_SCALE)} />
      <Button type="button" className="chronicle-card-body" aria-pressed={selected} aria-label={COPY.selectLabel(card.date, card.sentence)} onPress={() => onSelect(card.id)} variant="surface">
        <ChronicleArtView art={card.art} size={card.art?.kind === "portrait" ? PORTRAIT_SIZE : ART_SIZE} className="chronicle-card-art" />
        <span className="chronicle-card-text">
          <span className="chronicle-card-date">{card.date}</span>
          <span className="chronicle-card-line">{card.sentence}</span>
          {card.numbers === null ? null : <span className="chronicle-card-numbers">{card.numbers}</span>}
        </span>
      </Button>
      <div className="chronicle-card-actions">
        {card.place === null ? null : <Button type="button" className="chronicle-card-action" aria-label={COPY.lookAtLabel(card.date)}
          onPress={() => { if (card.place !== null) onLookAt(card.place); }} variant="secondary"><UiIcon sheet="action" cell="look" />{COPY.lookAt}</Button>}
        {card.snapshot === null ? null : <Button type="button" className="chronicle-card-action" aria-label={COPY.thenMapLabel(card.date)}
          onPress={() => onMap(card.id)} variant="secondary"><UiIcon sheet="layer" cell="zone" />{COPY.thenMap}</Button>}
        {card.personId === null || card.personName === null ? null : <Button type="button" className="chronicle-card-action" aria-label={COPY.personLabelFor(card.personName)}
          onPress={() => { if (card.personId !== null) onPerson(card.personId); }} variant="secondary"><UiIcon sheet="resource" cell="population" />{COPY.person}</Button>}
        {card.factionId === null || card.factionName === null ? null : <Button type="button" className="chronicle-card-action" aria-label={COPY.factionLabelFor(card.factionName)}
          onPress={() => { if (card.factionId !== null) onFaction(card.factionId); }} variant="secondary"><UiIcon sheet="cause" cell="rights" />{COPY.faction}</Button>}
      </div>
    </article>
  );
}
