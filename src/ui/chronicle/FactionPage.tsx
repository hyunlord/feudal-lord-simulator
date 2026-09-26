import type { CSSProperties } from "react";
import { portraitStyle } from "../portraitArt";
import { wave19ImageStyle, wave19Url } from "../wave19Art";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";

// CHRON-1 faction chronicle page (CHRONICLE_DESIGN 2.3), registered as a frame only: the ledger has no factions until
// the E stage, so nothing opens this page yet. The Wave 19 `frame_faction_page` (640 x 800 art) and its printed slots —
// the leader's portrait circle, the crest shield, the relation scale (`relation_scale_track` + `relation_scale_pin`,
// hostile −100 to friendly +100), demands and promises, the events with us, the faction's own events.
export const FACTION_PAGE = { width: 640, height: 800 } as const;

const slot = (left: number, top: number, width: number, height: number): CSSProperties =>
  ({ left: `${left / 6.4}%`, top: `${top / 8}%`, width: `${width / 6.4}%`, height: `${height / 8}%` });
/** Measured on frame_faction_page.png. */
export const FACTION_PAGE_SLOTS = {
  leader: slot(66, 92, 148, 148), crest: slot(490, 92, 88, 104), name: slot(240, 110, 230, 100), relation: slot(70, 296, 500, 32),
  demands: slot(50, 370, 262, 160), promises: slot(330, 370, 262, 160), ourEvents: slot(50, 600, 270, 140), theirEvents: slot(330, 600, 262, 140),
} as const;

export type FactionPageView = Readonly<{
  id: string; name: string; leaderPortraitId: string | null; relation: number;
  demands: readonly string[]; promises: readonly string[]; ourEvents: readonly string[]; theirEvents: readonly string[];
}>;

export function FactionPage({ view, scale }: { readonly view: FactionPageView; readonly scale: number }) {
  const leader = view.leaderPortraitId === null ? null : portraitStyle(view.leaderPortraitId, Math.round(148 * scale));
  const pin = Math.min(1, Math.max(0, (view.relation + 100) / 200));
  return (
    <article className="chronicle-faction" aria-label={COPY.factionTitle(view.name)} data-faction={view.id}
      style={{ width: FACTION_PAGE.width * scale, height: FACTION_PAGE.height * scale, backgroundImage: `url("${wave19Url("frame_faction_page")}")` }}>
      {leader === null ? null : <span className="chronicle-faction-leader" aria-hidden="true" style={{ ...FACTION_PAGE_SLOTS.leader, ...leader }} />}
      <h3 className="chronicle-faction-name" style={FACTION_PAGE_SLOTS.name}>{view.name}</h3>
      <div className="chronicle-faction-relation" style={FACTION_PAGE_SLOTS.relation}>
        <span aria-hidden="true" className="chronicle-faction-track" style={{ backgroundImage: `url("${wave19Url("relation_scale_track")}")` }} />
        <span aria-hidden="true" className="chronicle-faction-pin" style={{ left: `${pin * 100}%`, ...wave19ImageStyle("relation_scale_pin", 24) }} />
      </div>
      {([["demands", view.demands], ["promises", view.promises], ["ourEvents", view.ourEvents], ["theirEvents", view.theirEvents]] as const).map(([key, lines]) => (
        <ul key={key} className="chronicle-faction-list" style={FACTION_PAGE_SLOTS[key]}>{lines.map(line => <li key={line}>{line}</li>)}</ul>
      ))}
    </article>
  );
}
