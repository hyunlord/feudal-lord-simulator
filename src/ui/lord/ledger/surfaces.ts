import type { SurfaceRow } from "../../surfaces.registry";
import { lord2Scene, openLordScreen } from "../screen/surfaces";

// LM-R2 (ledger area): this area's ui-geometry rows, spread into SURFACES (src/ui/surfaces.registry.ts). Scenes and open
// steps for the lord screen: src/ui/lord/screen/surfaces.ts (LORD2, openLordScreen). Each row measures the host with the
// ledger open in it (the host's frame; the menu and the screen scroll on their own).

const HOST = { root: ".slot-panel.lord-screen", frame: "css", scrollParts: [".lord-screen-nav", ".lord-screen-content"] } as const;
const OPEN = openLordScreen("ledger");

export const LEDGER_SURFACES: readonly SurfaceRow[] = [
  { id: "lord.ledger.promises", ...HOST, scene: lord2Scene("promises"), open: OPEN,
    requires: [".lord-ledger-book", ".lord-ledger-promise", ".lord-ledger-keep", ".lord-ledger-claim"], siblingsNoOverlap: [".lord-ledger-promise"],
    data: "the promise ledger with kept, broken and open debt instalments (the lord keeps them from the treasury), the lord's open claim" },
  { id: "lord.ledger.empty", ...HOST, scene: lord2Scene("offer-countered"), open: OPEN,
    requires: [".lord-ledger-book", ".lord-ledger-empty", ".lord-ledger-claim", ".lord-ledger-file[data-cost]", ".lord-ledger-claim-hearing"],
    data: "no promise yet (the marriage only offered): the empty ledger's lines, no timed terms, the lord's claim with its filing button (PLAY-2: its cost, the hearing's sides)" },
  { id: "lord.ledger.suit", ...HOST, scene: lord2Scene("contested"), open: OPEN,
    requires: [".lord-ledger-suit", ".lord-ledger-track", ".lord-ledger-step", ".lord-ledger-bring"], siblingsNoOverlap: [".lord-ledger-step", ".lord-ledger-claim"],
    data: "the contested inheritance's suit just filed: the stage track, the hearing's two sides, the five evidence kinds to bring; two claims to file" },
  { id: "lord.ledger.neighbour", ...HOST, scene: lord2Scene("neighbour-suit"), open: OPEN,
    requires: [".lord-ledger-suit"], siblingsNoOverlap: [".lord-ledger-suit"],
    data: "the lord's two closed suits (judged, enforced) and a neighbour's recovery suit against him, shown with no command" },
];
