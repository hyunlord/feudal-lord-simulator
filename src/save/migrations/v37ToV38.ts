/**
 * v38 is LM-E2 (spec `docs/design/estates.md` ES-3, ES-9): the lord's lost rights move from `lordship.lostRights` to the
 * home estate's pieces — the title stays the lord's, the possession is the overlord's (suspended) or the merchants'
 * (seized), from the tick it was lost. A save that lost nothing keeps no `estates` (the opening portfolio is read from
 * the seed); `lostRights` leaves the lordship either way.
 */
import { HOME_ESTATE_ID } from "../../content/estateConfig";
import type { GameState } from "../../engine/engine.types";
import { initialEstates, PIECE_OF_RIGHT } from "../../engine/estates";
import type { LordRightId } from "../../content/lordshipConfig";

interface V37LostRight { readonly id: LordRightId; readonly status: "suspended" | "seized"; readonly by: string; readonly since: number }

export function migrateV37ToV38(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v37 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v37 save has no state");
  const state = envelope.state as GameState & { readonly lordship?: { readonly lostRights?: readonly V37LostRight[] } };
  const lordship = state.lordship;
  if (lordship === undefined) return { ...envelope, schemaVersion: 38 };
  const { lostRights = [], ...rest } = lordship;
  let next: GameState = { ...state, lordship: rest as GameState["lordship"] & object };
  if (lostRights.length > 0) {
    const estates = initialEstates(next);
    const lost = new Map(lostRights.map(right => [PIECE_OF_RIGHT[right.id], right]));
    next = { ...next, estates: { ...estates, estates: estates.estates.map(estate => estate.id !== HOME_ESTATE_ID ? estate : {
      ...estate, pieces: estate.pieces.map(piece => {
        const right = lost.get(piece.id);
        return right === undefined ? piece : { ...piece, possessor: right.by, possessedSince: right.since, loss: right.status };
      }),
    }) } };
  }
  return { ...envelope, state: next, schemaVersion: 38 };
}
