import type { UiModal, UiState } from "../stateMachine/uiStateMachine";

// LS1-7 (lord-screen-v1.md; the user's ruling 2026-10-15): after a receipt the lord is back on the map. Its close pops its
// own card, then every card beneath it that can be put off — popped as its 나중에 would (each card's onLater is that one
// pop_modal), its deadline left as it is, its chip held on the rail (heldChipIds). A card that cannot be put off (the
// house's change, the year card, the slice's pages) stays and shows next.

/** The cards with 나중에 (AppModals: each one's onLater is `pop_modal`). */
export const DEFERRABLE_MODALS: ReadonlySet<UiModal> = new Set<UiModal>(["decision", "petition", "estate_petition", "lord_request", "registry_offer",
  "marriage_decision", "audit_decision", "estate_petition_offmap"]);

/** How many modals a receipt's close pops: its own card, then each card beneath it that can be put off. */
export function receiptPops(ui: Pick<UiState, "modals">): number {
  let pops = 1;
  for (let index = ui.modals.length - 2; index >= 0 && DEFERRABLE_MODALS.has(ui.modals[index]!.modal); index -= 1) pops += 1;
  return pops;
}
