import { useLayoutEffect } from "react";

// LS1-7 (lord-screen-v1.md; the user's rulings 2026-10-15): after a receipt the lord is back on the map. The receipt's
// close pops its own card; each card that then shows decides for itself whether it can be put off — a card with 나중에
// (every DecisionCard: its `onLater`) presses its own 나중에 at once, exactly as the lord would, so a new kind of card
// follows by itself; a card without 나중에 (the house's change, the year card, the slice's pages) does nothing and stays.
// The return ends at the first card that did not put itself off, or at the map once the cards that open by themselves
// there (the story's auto-open: a chip's card, the first time) have had their turn — such a card, opening just as the
// map is reached, is put off the same way (ID 056: the registry offer 092 opened by itself once 056's receipt closed).

const flow = { returning: false, laterPressed: false, landed: false, lastCard: null as string | null };

/** The receipt's close: the map is being returned to. */
export function startReturnToMap(): void {
  flow.returning = true; flow.laterPressed = false; flow.landed = false; flow.lastCard = null;
}

/** A card with 나중에, as it shows: while the map is being returned to, it is put off (its own 나중에) — once per card
 * (StrictMode runs a layout effect twice in development); true if it was. */
export function laterIfReturning(onLater: () => void, card: string): boolean {
  if (!flow.returning || flow.lastCard === card) return false;
  flow.lastCard = card; flow.laterPressed = true; onLater();
  return true;
}

/** DecisionCard: each card it shows (by its family and subject) puts itself off if the map is being returned to. */
export function useReturnToMap(onLater: () => void, card: string): void {
  // why: once per card shown; onLater is the card's own and changes identity on every render
  useLayoutEffect(() => { laterIfReturning(onLater, card); }, [card]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** AppModals, after each change of the top modal: at the map the return waits for the auto-open's turn; it ends at a card
 * that did not put itself off. */
export function settleReturnToMap(top: string | null): void {
  if (!flow.returning) return;
  if (top === null) flow.landed = true;
  else if (!flow.laterPressed) end();
  flow.laterPressed = false;
}

/** The story's auto-open, at the map (after AppModals' settle in the same commit): if it opened a card, the return goes on
 * (that card decides); if it opened none, the return is over. */
export function mapTurnTaken(opened: boolean): void {
  if (!flow.returning || !flow.landed) return;
  flow.landed = false;
  if (!opened) end();
}

function end(): void {
  flow.returning = false; flow.landed = false; flow.lastCard = null;
}

/** Whether the map is being returned to (tests). */
export const returningToMap = (): boolean => flow.returning;
