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
  // The ledger's two drawn parts (Wave 35: the book, the suit's track) as framed roots of their own, on the pages their
  // host rows open (they are painted backgrounds: `flat`).
  { id: "lord.ledger.book", extends: "lord.ledger.promises", root: ".lord-ledger-book", frame: "flat", scene: lord2Scene("promises"), open: [],
    requires: [".lord-ledger-promise"], data: "the promise book's drawn page inside the ledger: the promises' lines within it" },
  { id: "lord.ledger.track", extends: "lord.ledger.suit", root: ".lord-ledger-track", frame: "flat", scene: lord2Scene("contested"), open: [],
    requires: [".lord-ledger-step"], data: "the suit's drawn stage track inside the ledger: the stages within it" },
  { id: "lord.ledger.empty", ...HOST, scene: lord2Scene("offer-countered"), open: OPEN,
    requires: [".lord-ledger-book", ".lord-ledger-empty", ".lord-ledger-claim", ".lord-ledger-file[data-cost]", ".lord-ledger-claim-hearing"],
    data: "no promise yet (the marriage only offered): the empty ledger's lines, no timed terms, the lord's claim with its filing button (PLAY-2: its cost, the hearing's sides)" },
  { id: "lord.ledger.suit", ...HOST, scene: lord2Scene("contested"), open: OPEN,
    requires: [".lord-ledger-suit", ".lord-ledger-track", ".lord-ledger-step", ".lord-ledger-bring"], siblingsNoOverlap: [".lord-ledger-step", ".lord-ledger-claim"],
    data: "the contested inheritance's suit just filed: the stage track, the hearing's two sides, the five evidence kinds to bring; two claims to file" },
  { id: "lord.ledger.neighbour", ...HOST, scene: lord2Scene("neighbour-suit"), open: OPEN,
    requires: [".lord-ledger-suit", ".lord-ledger-defence", ".lord-ledger-bring", ".lord-ledger-concord", ".lord-ledger-hold"], siblingsNoOverlap: [".lord-ledger-suit"],
    data: "the lord's two closed suits (judged, enforced) and a neighbour's recovery suit against him just filed, with his defence (SUIT-THREAD: evidence, the concord's two terms, the hold shut with its stage)" },
  // SUIT-THREAD (DTR-23): states played on from lord2 neighbour-suit by commands (scripts/suitLedgerStates.ts), kept in
  // the lord2 folder as suit-<name>.json.
  { id: "lord.ledger.defence-enforcing", ...HOST, scene: lord2Scene("suit-defence-enforcing"), open: OPEN,
    requires: [".lord-ledger-defence", ".lord-ledger-hold", ".lord-ledger-concord"], siblingsNoOverlap: [".lord-ledger-suit"],
    data: "a house's suit against the lord judged for it, its enforcement under way: the lord's hold with its cost, the concord at the whole price" },
  { id: "lord.ledger.entry-threat", ...HOST, scene: lord2Scene("suit-entry-threat"), open: OPEN,
    requires: [".lord-ledger-threat", ".lord-ledger-guard", ".lord-ledger-appease"], siblingsNoOverlap: [".lord-ledger-threat"],
    data: "a forcible entry forewarned by a house past −60 (1344): the guard and the gift at the engine's costs, the engine's sentence" },
  { id: "lord.ledger.entry-forced", ...HOST, scene: lord2Scene("suit-entry-forced"), open: OPEN,
    requires: [".lord-ledger-claim[data-novel]", ".lord-ledger-file[data-cost]", "[data-block='past-entries']"], siblingsNoOverlap: [".lord-ledger-claim"],
    data: "the house came in by force: the lord's novel claim (a suit for the possession taken by force) with its filing cost and hearing, the entry in the engine's words" },
];
