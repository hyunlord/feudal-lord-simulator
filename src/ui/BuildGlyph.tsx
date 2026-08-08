import type { PlacementTool } from "../render/renderer";

const GLYPH_PATHS: Record<PlacementTool, readonly string[]> = {
  house: ["M3 11 12 4l9 7", "M5 10v10h14V10", "M10 20v-6h4v6"],
  well: ["M5 10q7-4 14 0v7q-7 4-14 0Z", "M7 10V6m10 4V6", "M6 6q6-4 12 0"],
  storehouse: ["M3 10 12 4l9 6v10H3Z", "M8 20v-7h8v7", "M5 11h14"],
  granary: ["M6 7q6-5 12 0v11H6Z", "M8 18v3m8-3v3", "M6 11h12M6 15h12"],
  chapel: ["M12 3v5", "M8 8h8l3 4v9H5v-9Z", "M9 21v-6h6v6"],
  wheat_farm: ["M12 22V4", "M12 8 8 5m4 7 5-3m-5 7-5-3m5 7 5-3", "M5 22h14"],
  mill: ["M4 20h11V9L9 5 4 9Z", "M16 13a4 4 0 1 0 0 8 4 4 0 0 0 0-8", "M16 13v8m-4-4h8"],
  logging_camp: ["M4 17 9 8l5 9Z", "M9 8l3-4 3 4", "M5 21l14-4m-12 4 14-4"],
  sawmill: ["M3 20V9l8-5 4 4 6-3v15Z", "M6 15h12", "M7 18l2-3 2 3 2-3 2 3 2-3"],
  quarry: ["M4 18 9 7h11l-5 11Z", "M8 16l4-5 4 5", "M6 21h12"],
  masonry: ["M4 19h16", "M6 15h12v4H6Z", "M8 11h8v4H8Z"],
  market: ["M4 10h16l-2 4H6Z", "M6 14v7m12-7v7", "M8 18h3m2 0h3M7 10l1-5h8l1 5"],
  church: ["M12 2v5", "M7 9h10l3 4v8H4v-8Z", "M10 21v-6h4v6M8 9l4-4 4 4"],
  keep: ["M5 21V8l3-2 4 2 4-2 3 2v13", "M8 21v-6h8v6", "M6 10h12M9 6V3m6 3V3"],
  road: ["M7 22 10 2m7 20L14 2", "M8 17h8m-7-5h6m-5-5h4"],
};

type BuildGlyphProps = { readonly tool: PlacementTool };

export function BuildGlyph({ tool }: BuildGlyphProps) {
  return (
    <svg
      className="seal-glyph"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {GLYPH_PATHS[tool].map((path) => <path key={path} d={path} />)}
    </svg>
  );
}
