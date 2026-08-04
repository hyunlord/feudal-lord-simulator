export const PALETTE = {
  ink: "#3A2E1F",
  inkLight: "#5A4A35",
  parchment: "#E8DCC0",
  parchmentDark: "#C9B896",
  vellum: "#F2E9D4",
  vermilion: "#C8102E",
  gold: "#D4AF37",
  goldDark: "#A8862A",
  ultramarine: "#1E3A8A",
  sage: "#7A8450",
  sageDark: "#5C6640",
  forest: "#42522F",
  earth: "#8A6F4E",
  earthDark: "#6B5438",
  stone: "#8A8578",
  stoneDark: "#615D53",
  water: "#4A6B7C",
  winterGrey: "#8A9BA8",
  snow: "#DCE4E8",
} as const;

export type PaletteName = keyof typeof PALETTE;
export type PaletteColor = (typeof PALETTE)[PaletteName];
