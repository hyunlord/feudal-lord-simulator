import type { SurfaceRow } from "../../surfaces.registry";
import { lord2Scene, openLordScreen } from "../screen/surfaces";

// DEC-CARD-2 (steward area): this area's ui-geometry rows, spread into SURFACES (src/ui/surfaces.registry.ts) — the lord
// screen's 상시 방침 (closed, and one kind open with its four settings) and the season card's "청지기가 처리한 일" on a
// lord-mode state (the lord2 set, scripts/lmr2States.ts: lord mode, its steward answering). The season card opens at the
// next season's close (run at 3×, as modal.season-ledger).

const HOST = { root: ".slot-panel.lord-screen", frame: "css", scrollParts: [".lord-screen-nav", ".lord-screen-content"] } as const;
const OPEN = openLordScreen("petitions");

export const STEWARD_SURFACES: readonly SurfaceRow[] = [
  { id: "lord.standing", ...HOST, scene: lord2Scene("attention-overloaded"), open: OPEN,
    requires: [".lord-standing h3", ".lord-standing-family", ".lord-standing-open", ".lord-standing-all-toggle"], siblingsNoOverlap: [".lord-standing-open"],
    data: "the standing policies: the manor's twelve petitions (with the all-to-the-lord switch, rules.recurring), the off-map estates' six, the senders' five, each with its setting" },
  { id: "lord.standing.kind", ...HOST, scene: lord2Scene("attention-overloaded"), open: [...OPEN, { click: "[data-kind='heriot'] .lord-standing-open" }, { pause: 400 }],
    requires: [".lord-standing-detail", ".lord-standing-set", ".lord-standing-does li"], siblingsNoOverlap: [".lord-standing-set"],
    data: "the heriot opened: the four settings (all secondary, the one in force pressed) and what each would do, this year's count" },
  { id: "modal.season-ledger.steward", root: ".season-ledger-card", frame: "layer", frameLayer: ".season-ledger-frame", contentSlot: ".season-ledger-body",
    frameSlots: [".season-ledger-scenes"], scene: { kind: "state", set: "lord2", name: "attention-overloaded", tile: "house", zoom: 1.1, query: "&story-delay=600000&auto-pause=off", run: true },
    open: [{ key: "Digit3" }, { wait: ".season-ledger-card .season-steward", timeout: 120_000 }, { pause: 900 }],
    requires: ["h2", ".season-steward h3", ".season-steward-line", ".season-ledger-resume"], scrollParts: [".season-ledger-content"],
    data: "a lord-mode season close with the steward's section: what he handled by which policy (each a drill-in), the money and factions, what he brought" },
];
