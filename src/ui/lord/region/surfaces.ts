import type { SurfaceRow } from "../../surfaces.registry";
import { lord2Scene, openLordScreen } from "../screen/surfaces";

// LM-R2 (region area): this area's ui-geometry rows, spread into SURFACES (src/ui/surfaces.registry.ts). Scenes and open
// steps for the lord screen: src/ui/lord/screen/surfaces.ts (LORD2, openLordScreen).
const REGION = { root: ".slot-panel.lord-screen", frame: "css", scrollParts: [".lord-screen-nav", ".lord-screen-content"] } as const;
const OPEN_REGION = openLordScreen("region");
const CHOOSE_DELEGATED = { click: ".lord-region-site[data-region-estate='estate-neighbour-3']" } as const;

export const REGION_SURFACES: readonly SurfaceRow[] = [
  { id: "lord.region", ...REGION, scene: lord2Scene("inherited"), open: [...OPEN_REGION, CHOOSE_DELEGATED, { pause: 300 }],
    requires: ["h3", ".lord-region-map", ".lord-region-site", ".lord-region-zoom", ".lord-region-open"], siblingsNoOverlap: [".lord-region-site", ".lord-region-zoom"],
    data: "the region map on the inherited state: the home direct, the inherited estate delegated to its steward (chosen, its line under the map), two neighbours; the map fitted" },
  { id: "lord.region.zoomed", ...REGION, scrollParts: [...REGION.scrollParts, ".lord-region-map"], scene: lord2Scene("neighbour-suit"),
    open: [...OPEN_REGION, { click: ".lord-region-site[data-region-estate='estate-neighbour-1']" }, { click: "[data-region-zoom-step='full']" }, { pause: 300 }],
    requires: ["h3", ".lord-region-map", ".lord-region-site", ".lord-region-open"],
    data: "the region map at full zoom on the neighbour-suit state: the first neighbour chosen (its flag a neighbour's, the pieces the lord won of it listed), the map scrolled to it" },
];
