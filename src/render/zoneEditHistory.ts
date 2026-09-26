import type { GameAction } from "../state/gameStore.types";
import { ZONE_UNDO_LIMIT } from "../content/zoneConfig";

// UX-3R2 zone redo (UX3R 5절 "되돌리기 20단계", toolbar ↶ ↷). The engine keeps the undo records (`zoneUndo`, Z-17,
// ZONE_UNDO_LIMIT = 20) but has no redo; redo re-sends the paint or erase that the last undo took back, which the
// reducer applies to the same zones it was first applied to (nothing else changed them in between: any new edit
// clears the redo list, and so does leaving the zone tool). Presentation state only, never saved.
type ZoneEdit = Extract<GameAction, { readonly type: "zone_paint" | "zone_erase" }>;

let done: ZoneEdit[] = [];
let undone: ZoneEdit[] = [];
const listeners = new Set<() => void>();
const changed = () => { for (const listener of listeners) listener(); };

export const zoneEditHistory = {
  /** A paint or erase was dispatched: it can be undone, and nothing can be redone any more. */
  record(action: GameAction): void {
    if (action.type !== "zone_paint" && action.type !== "zone_erase") return;
    done = [...done, action].slice(-ZONE_UNDO_LIMIT); undone = []; changed();
  },
  /** `zone_undo_stroke` was dispatched: the newest edit moves to the redo list. */
  undid(): void {
    const last = done[done.length - 1];
    if (last === undefined) return;
    done = done.slice(0, -1); undone = [...undone, last]; changed();
  },
  /** The edit to redo (removed from the list; the caller dispatches it and records it again). */
  takeRedo(): ZoneEdit | null {
    const next = undone[undone.length - 1];
    if (next === undefined) return null;
    undone = undone.slice(0, -1); changed();
    return next;
  },
  canRedo: (): boolean => undone.length > 0,
  /** Leaving the zone tool, a new game or a load: redo would no longer apply to the zones it came from. */
  clear(): void { if (done.length === 0 && undone.length === 0) return; done = []; undone = []; changed(); },
  subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; },
};
