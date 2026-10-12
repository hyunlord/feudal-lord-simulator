import type { GameState } from "../engine/engine.types";
import type { HistoryRecord } from "../engine/history.types";
import { lordMode } from "../engine/townAgency";
import type { StoryBeat } from "./eventStory";
import { recordSentence } from "./legacy/chapterRecords";
import { lordMomentWords } from "./lordMomentCopy.ko";
import { familyLine, familyPeople } from "./persons/familyNews";
import { FAMILY_NEWS_COPY } from "./persons/familyNewsCopy.ko";
import { wave40RecordArt, wave40RecordSide, type Wave40ImageId } from "./wave40Art";

// EVENT-ART (Wave 40): the lord's moments as story beats (lord mode only) — the marriage's stages, the inheritance, the suit
// and its possession, the wardship — read from the ledger the engine already writes. One beat per history record, its id
// the record's (`lord-moment:<record id>`), for the season after it: the chip comes once, the card shows the record's
// picture, its sentence and its advice. A record's id never changes, so the same moment is never announced twice.

/** A season's ticks: how long a moment's chip stays offered after its record. */
const SEASON = 1_000;
/** The moments that happen at the lord's seat ([위치로] looks there); the others are off the map (the neighbour, the court). */
const AT_SEAT: ReadonlySet<Wave40ImageId> = new Set(["moment_bride_arrival", "moment_first_child", "moment_child_lord_guardian", "moment_end_of_wardship"]);

/**
 * The season's moment records with their pictures, oldest first. An offer the counterpart took at once is one moment with
 * its contract (the same tick, the same negotiation): only the sealing is shown, not the offer as well. A suit's possession
 * is where its latest enforcement left it: attempts made one after another show the last one only (refused, or taken).
 */
export function lordMoments(state: Pick<GameState, "tick" | "history">): readonly { readonly record: HistoryRecord; readonly art: Wave40ImageId }[] {
  const records = state.history?.records ?? [];
  const moments: { record: HistoryRecord; art: Wave40ImageId }[] = [];
  const enforced = new Set<string>();
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index]!;
    if (state.tick - record.tick >= SEASON) break;
    const art = wave40RecordArt(record);
    if (art === null) continue;
    if (record.template === "estate.possession_enforced") {
      const suit = String(record.params?.suit ?? "");
      if (enforced.has(suit)) continue;
      enforced.add(suit);
    }
    moments.push({ record, art });
  }
  const sealed = new Set(moments.filter(entry => entry.art === "moment_marriage_sealing").map(entry => `${entry.record.tick}:${String(entry.record.params?.negotiation ?? "")}`));
  return moments.reverse().filter(entry => entry.art !== "moment_marriage_negotiation" || !sealed.has(`${entry.record.tick}:${String(entry.record.params?.negotiation ?? "")}`));
}

export function lordMomentBeats(state: GameState, seat: { readonly tx: number; readonly ty: number } | null): readonly StoryBeat[] {
  if (!lordMode(state)) return [];
  return lordMoments(state).map(({ record, art }) => {
    // PLAY-2 (friction 9): a marriage's or a birth's moment names its people, and opens its record (their biographies).
    // PLAY-2 §4: by their given names — the first child's three whole names in long copy ran its card under the action
    // dock (render-GROWKIN-geometry-01d0023); the whole names are in the record's chronicle, a press away.
    const people = familyLine(familyPeople(state, record), null, true);
    // Astra lordplay2 ②: a house's enforcement against the lord is his loss (or his hold), not "점유를 넘겨받았다".
    const side = wave40RecordSide(record);
    const words = lordMomentWords(art, side);
    return { id: `lord-moment:${record.id}`, kind: "lord_moment", illustration: art, tile: AT_SEAT.has(art) ? seat : null, decision: null,
      title: words.title, line: recordSentence(state, record), facts: people === null ? [] : [people], advice: words.advice,
      ...(side === "against" && art === "moment_possession_taken" ? { lasting: true } : {}),
      ...(people === null ? {} : { chronicle: { recordId: record.id, tick: record.tick, label: FAMILY_NEWS_COPY.openLabel(words.title) } }) };
  });
}
