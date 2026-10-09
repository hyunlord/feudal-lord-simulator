import type { SurfaceRow } from "../../surfaces.registry";
import { lord2Scene, openLordScreen } from "../screen/surfaces";

// LM-R2 (negotiation area): this area's ui-geometry rows, spread into SURFACES (src/ui/surfaces.registry.ts). Scenes and open
// steps for the lord screen: src/ui/lord/screen/surfaces.ts (LORD2, openLordScreen).
// The draft needs a lord-mode town before any offer: LM-R1's `lord-receipts` (scripts/lmr1LordStates.ts, ~/fls-lord-states —
// the lord's slice played to 1301 with no marriage offered); every lord2 state already holds one (an offer, a contract).

const HOST = { root: ".slot-panel.lord-screen", frame: "css", scrollParts: [".lord-screen-nav", ".lord-screen-content"] } as const;
const OPEN = openLordScreen("marriage");
const PRE_OFFER = { kind: "state", set: "lord", name: "lord-receipts", tile: "house", zoom: 1.1, query: "&story-delay=600000" } as const;

export const NEGOTIATION_SURFACES: readonly SurfaceRow[] = [
  { id: "lord.negotiation.draft", ...HOST, scene: PRE_OFFER, open: OPEN,
    requires: [".lord-neg-head h3", ".lord-neg-groom", ".lord-neg-clause .lord-neg-step", ".lord-neg-treaty", ".lord-neg-row", ".lord-neg-reason", ".lord-neg-send"],
    siblingsNoOverlap: [".lord-neg-groom", ".lord-neg-clause .ui-btn"],
    data: "the marriage offer before any is sent: the grooms, the clause editor, the draft treaty (consent alone), the counterpart's tier and reasons, the refusal (no terms) under a shut offer button" },
  { id: "lord.negotiation.counter", ...HOST, scene: lord2Scene("offer-countered"), open: OPEN,
    requires: [".lord-neg-treaty", ".lord-neg-row[data-mark='changed']", ".lord-neg-reason", ".lord-neg-outlook-answer .decision-card-part", ".lord-neg-accept", ".lord-neg-refuse"],
    siblingsNoOverlap: [".lord-neg-answers .ui-btn", ".lord-neg-outlook-answer"],
    data: "the counterpart's counter waiting a season: the clauses with the one it added marked, its tier and reasons, the deadline and what silence means, each answer's now / later / who remembers (DEC-CARD), accept and refuse as equal choices" },
  { id: "lord.negotiation.will-change", ...HOST, scene: lord2Scene("will-change"), open: OPEN,
    requires: [".lord-neg-timeline", ".lord-neg-events li", ".lord-neg-due", ".lord-decide[data-decide='marriage_decision']", ".lord-neg-treaty"],
    data: "the marriage's progress with the will change due: the events as they fell, the deferred debt, the engine's deadline as a season and the decide button to the will's card (SUIT-THREAD: where the will's chip opens), the contract's clauses under a stamped seal" },
  { id: "lord.negotiation.contested", ...HOST, scene: lord2Scene("contested"), open: OPEN,
    requires: [".lord-neg-timeline", ".lord-neg-outcome", ".lord-neg-open-suit"],
    data: "the estate contested after the will stood: the rival named, the outcome, the way to its suit on the ledger screen" },
];
