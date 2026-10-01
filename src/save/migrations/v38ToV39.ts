/**
 * v39 is the QA rounds 3–14 engine fixes (decisions QA14-1, QA14-2):
 * - QA032: each chapter end may carry the tick its page was seen (`seenTick`). A v38 save never kept it, so every end
 *   before the save's own tick is marked seen then — a load does not open those pages again (only an end on the save's
 *   very tick may show once more).
 * - QA010: the town's living namesakes' pair bynames set right (`settlePairEpithets`): a lone survivor's pair byname
 *   goes, a pair turned round is put in age order.
 */
import type { GameState } from "../../engine/engine.types";
import { settlePairEpithets } from "../../engine/persons";

export function migrateV38ToV39(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v38 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v38 save has no state");
  const state = envelope.state as GameState;
  const politics = state.politics === undefined ? undefined : { ...state.politics,
    chapterEnds: state.politics.chapterEnds.map(end => end.seenTick === undefined && end.tick < state.tick ? { ...end, seenTick: end.tick } : end) };
  const persons = state.persons === undefined ? undefined : { ...state.persons, people: settlePairEpithets(state.persons.people) };
  return { ...envelope, schemaVersion: 39, state: { ...state, ...(politics === undefined ? {} : { politics }), ...(persons === undefined ? {} : { persons }) } };
}
