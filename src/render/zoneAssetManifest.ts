// Zone surface art (Astra Wave 4 pilot, installed by C1b; provenance rows in docs/provenance/assets.csv).
// Fills are world-aligned 256x128 textures (2x2 tiles at 128 source px per tile). Props are drawn in the object
// pass, bottom-centre anchored: `displayWidth` is the screen width at zoom 1. The apple tree c is scaled to the
// existing orchard tree (phase16-landscape/orchard.png, 113 px canopy at displayWidth 40): its 240 px canopy of 256
// px also comes to 40 px (displayWidth 43), so the two read as one planting.
export const ZONE_ASSETS = [
  { "key": "pasture_fill", "url": "assets/zones/pasture_a-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "orchard_floor_fill", "url": "assets/zones/orchard_floor_a-v1.png", "width": 256, "height": 128, "role": "fill" },
  { "key": "haycock_a", "url": "assets/zones/haycock_a-v1.png", "width": 128, "height": 128, "role": "prop", "displayWidth": 30, "anchorY": 120 },
  { "key": "haycock_b", "url": "assets/zones/haycock_b-v1.png", "width": 128, "height": 128, "role": "prop", "displayWidth": 26, "anchorY": 120 },
  { "key": "orchard_apple_c", "url": "assets/zones/orchard_apple_c-v1.png", "width": 256, "height": 256, "role": "prop", "displayWidth": 43, "anchorY": 246 },
] as const;

export type ZoneAssetKey = (typeof ZONE_ASSETS)[number]["key"];
