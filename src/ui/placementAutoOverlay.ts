import { buildingEntry } from "../content/buildingCatalog";
import type { OverlayMode } from "../engine/engine.types";
import type { PlacementTool } from "../render/renderer";

// UX-3 S-51: a building whose ground matters turns its overlay on while it is being placed (the previous overlay
// comes back when the tool is put down). Only the well has one in this build: water coverage. The farmstead's arable
// land is the zone layer itself (drawn in every mode); there is no fertility or orchard overlay yet.
// BLD-REG: the overlay is the kind's catalog `placementOverlay`.
export const autoPlacementOverlay = (tool: PlacementTool | null): OverlayMode | null =>
  tool === null || tool === "road" ? null : buildingEntry(tool).placementOverlay ?? null;
