import type { GameState } from "../../../engine/engine.types";
import type { GameAction } from "../../../state/gameStore.types";

// LM-R2: the contract between the lord screen host (LordScreen.tsx) and each area's screen
// (src/ui/lord/<area>/*Panel.tsx). An area fills its panel and its gate; the host owns the menu, the frame and the slot.

/** The left menu's items (lord-components-region nav_*_40, plus `ledger` for promises and suits). */
export type LordScreenId = "character" | "dynasty" | "region" | "estates" | "council" | "marriage" | "ledger" | "petitions" | "military";

export type LordPanelProps = {
  readonly state: GameState;
  readonly dispatch: (action: GameAction) => void;
  /** An engine id the screen was opened on (an estate, a suit, a promise), or null. */
  readonly focus: string | null;
  /** Open another lord screen, optionally on one of its ids (a contested marriage → its suit; a map site → its estate card). */
  readonly onOpen: (screen: LordScreenId, focus?: string) => void;
  readonly onPerson: ((personId: string) => void) | undefined;
  /** Open one of the lord's decision cards (the lead's modals; each shows the first waiting decision of its kind). */
  readonly onDecide?: (modal: LordDecisionModal) => void;
};

/** The decision cards a lord screen can open: an audit's finding, a home estate's petition, an off-map estate's petition. */
export type LordDecisionModal = "audit_decision" | "estate_petition" | "estate_petition_offmap";

/** Whether the item opens: null, or the reason it is shut (player copy from a *.ko.ts), read from the game each render. */
export type LordNavGate = (state: GameState) => string | null;
