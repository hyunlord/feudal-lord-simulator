import type { OpenStep, SurfaceRow } from "../../surfaces.registry";
import { lord2Scene, openLordScreen } from "../screen/surfaces";

// LM-R2 (estates area): this area's ui-geometry rows, spread into SURFACES (src/ui/surfaces.registry.ts). Scenes and open
// steps for the lord screen: src/ui/lord/screen/surfaces.ts (LORD2, openLordScreen). Each row is the lord screen host
// with the estates screen in it: the home card (opening on the home estate), the third neighbour's estate inherited and
// delegated (its oversight, candidates and summaries), the same estate taken direct with the attention over its limit,
// and a visit's audit waiting; then the ledger's lord tab with a subsidy on offer (the policy icons and the notice).

const HOST = { root: ".slot-panel.lord-screen", frame: "css", scrollParts: [".lord-screen-nav", ".lord-screen-content"] } as const;
const OPEN = openLordScreen("estates");
const NEIGHBOUR_3: readonly OpenStep[] = [...OPEN, { click: "[data-estate='estate-neighbour-3']" }, { pause: 400 }];
const CARD = [".lord-estates-totals", ".lord-estates-attention", ".lord-estates-pick", ".lord-estates-card", ".lord-estates-pieces"];

export const ESTATES_SURFACES: readonly SurfaceRow[] = [
  { id: "lord.estates.home", ...HOST, scene: lord2Scene("inherited"), open: OPEN, requires: [...CARD, ".lord-estates-rules", ".lord-estates-petitions"],
    siblingsNoOverlap: [".lord-estates-pick"],
    data: "the estates screen on the home estate: the totals, the attention, the four estates to choose, the home card with its pieces and grants, the exceptions, the petitions" },
  { id: "lord.estates.delegated", ...HOST, scene: lord2Scene("inherited"), open: NEIGHBOUR_3,
    requires: [...CARD, ".lord-estates-oversight", ".lord-estates-keeper", ".lord-estates-appoint", ".lord-estates-audit-mode"], siblingsNoOverlap: [".lord-estates-appoint"],
    data: "the inherited estate given to the greedy steward: its card with the overlay, the steward and the two other candidates, the audit by visit, its first season" },
  { id: "lord.estates.overloaded", ...HOST, scene: lord2Scene("attention-overloaded"), open: NEIGHBOUR_3,
    requires: [...CARD, ".lord-estates-warning", ".lord-estates-oversight", ".lord-estates-summaries"],
    data: "the same estate taken direct while a visit's year lowers the attention: load 2 over capacity 1, the warning, the receiver, three seasons" },
  { id: "lord.estates.audit-pending", ...HOST, scene: lord2Scene("audit-pending"), open: NEIGHBOUR_3, requires: [...CARD, ".lord-estates-pending", ".lord-estates-summaries"],
    data: "a visit's audit waiting for the lord's answer: what it found and the days left (the answer is the decision card's)" },
  { id: "slot.ledger.lord-policy-subsidy", root: ".slot-panel.ledger-drawer", frame: "css", scene: lord2Scene("neighbour-suit"), scroll: "y",
    open: [{ click: "[data-dock='ledger']" }, { click: "[data-ledger-tab='lord']" }, { pause: 500 }], requires: [".lord-policy-option", ".lord-policy-subsidies"],
    data: "the ledger's lord tab with a subsidy on offer: the four policies with their icons, the subsidy's notice and its row" },
];
