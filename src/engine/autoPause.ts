/**
 * LM-E8 (spec docs/design/lord-slice.md LS-2, lord-mode design 3.5): the auto-pause's reasons. The engine only names
 * why the game should stop between two states (a tick's before and after); the screen stops it. It stops for a counter
 * come in, a great person's death or an inheritance, a judgment, a petition that puts a right at stake, an estate's
 * crisis, an estate gained or lost — never for a house finished or a shop opened. Each reason is read from what the
 * tick left: its ledger lines and the petitions come in.
 */
import { CRISIS_EVENT_DEFS, PAUSE_TEMPLATES, RIGHTS_PETITION_IDS, type PauseReason } from "../content/lordSliceConfig";
import type { GameState } from "./engine.types";
import { LORD } from "./estates";

export interface PauseEvent {
  readonly reason: PauseReason;
  readonly tick: number;
  /** The ledger line it was read from, or the petition. */
  readonly recordId?: string;
  readonly petitionId?: string;
  readonly template?: string;
}

/**
 * LS-2 API: why the game stops after `before` became `after` (a tick, or a command and a tick; empty: it runs on).
 * Oldest first, one per ledger line or petition; an estate gained or lost is one stop (its title and possession lines).
 */
export function pauseReasons(before: Pick<GameState, "tick" | "history">, after: Pick<GameState, "tick" | "history" | "politics">): readonly PauseEvent[] {
  const events: PauseEvent[] = [];
  const seen = new Set<string>();
  for (const record of newRecords(before, after)) {
    const params = record.params ?? {};
    const reason = reasonOf(record.template, params);
    if (reason === null) continue;
    const key = reason === "estate_gained" || reason === "estate_lost" ? `${reason}:${record.tick}:${String(params.estate)}` : record.id;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({ reason, tick: record.tick, recordId: record.id, template: record.template });
  }
  for (const petition of after.politics?.petitions ?? []) {
    if (petition.arrivedTick > before.tick && petition.arrivedTick <= after.tick && RIGHTS_PETITION_IDS.includes(petition.defId)) {
      events.push({ reason: "rights_petition", tick: petition.arrivedTick, petitionId: petition.id });
    }
  }
  return events;
}

/** The ledger lines `after` has past `before`'s last (lines are appended; a folded old line is never new). */
function newRecords(before: Pick<GameState, "tick" | "history">, after: Pick<GameState, "history">) {
  const records = after.history?.records ?? [];
  const last = before.history?.records.at(-1)?.id;
  if (last === undefined) return records;
  for (let index = records.length - 1; index >= 0; index -= 1) if (records[index]!.id === last) return records.slice(index + 1);
  return records.filter(record => record.tick > before.tick);
}

function reasonOf(template: string, params: Readonly<Record<string, string | number>>): PauseReason | null {
  const fixed = PAUSE_TEMPLATES[template];
  if (fixed !== undefined) return fixed;
  // A neighbour house's head (the old lord among them) dying; their kin and the steward candidates do not stop it.
  if (template === "estate.person_died") return params.role === "head" ? "major_death" : null;
  if (template === "event.arrived") return CRISIS_EVENT_DEFS.includes(String(params.defId)) ? "estate_crisis" : null;
  // A whole estate (no piece) coming to the lord or leaving him; its pieces alone do not stop it.
  if ((template === "estate.title_changed" || template === "estate.possession_changed") && params.piece === "") {
    if (params.to === LORD) return "estate_gained";
    if (params.from === LORD) return "estate_lost";
  }
  // A steward bringing a petition that changes a right (the exceptions' rights rule).
  if (template === "stewardship.escalated" && params.rule === "rights") return "rights_petition";
  return null;
}
