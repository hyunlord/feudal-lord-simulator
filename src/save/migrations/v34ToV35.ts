/**
 * v35 is FIX-11: the lord's manor house is a building (`manor_house`, MH-1) — a v34 town gets one on the free grass 2×2
 * nearest to its opening village's north-west (MH-2, `placeManorSite`), or none when the town has no free 2×2 left.
 * The other FIX-11 fields are optional and start absent: a minor lord's wardship (`lordship.wardship`, from the next
 * year's turn), a dyehouse's dyed bolts by colour (`dyedColours`, from its next bolt), stuck stock's since-ticks
 * (`stuckSinceTick`, from the next check), the death cause "captivity".
 */
import type { GameState } from "../../engine/engine.types";
import { placeManorSite } from "../../state/openingVillage";

export function migrateV34ToV35(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v34 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v34 save has no state");
  return { ...envelope, schemaVersion: 35, state: placeManorSite(envelope.state as GameState) };
}
