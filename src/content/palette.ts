export const PALETTE = {
  ink: "#2A2118",
  vermilion: "#A83232",
  gold: "#C9A227",
  ultramarine: "#2A4A8A",
} as const;

export const RAMPS = {
  thatch: ["#4A3B22", "#6B5530", "#8C7040", "#AD8C52", "#C9A868", "#E0C489"],
  timber: ["#2E2418", "#463625", "#5E4A33", "#786044", "#95795A", "#B29578"],
  plaster: ["#6B6152", "#8A8071", "#A99F8E", "#C4BAA8", "#DCD3C1", "#EFE8D8"],
  stone: ["#3D3D3B", "#565654", "#71706D", "#8D8C88", "#A9A8A3", "#C4C3BE"],
  slate: ["#2A3038", "#3D4650", "#525D6A", "#6A7684", "#85919F", "#A2ADB9"],
  earth: ["#33261A", "#4C3A28", "#664F37", "#806548", "#9A7C5C", "#B49573"],
  foliage: ["#1E2B18", "#2E4024", "#405633", "#546D43", "#6A8656", "#82A06B"],
  water: ["#1C3040", "#2A4557", "#3A5C70", "#4D758A", "#6390A6", "#7CACC2"],
} as const;

export const CANONICAL_PALETTE = [
  PALETTE.ink,
  PALETTE.vermilion,
  PALETTE.gold,
  PALETTE.ultramarine,
  ...RAMPS.thatch,
  ...RAMPS.timber,
  ...RAMPS.plaster,
  ...RAMPS.stone,
  ...RAMPS.slate,
  ...RAMPS.earth,
  ...RAMPS.foliage,
  ...RAMPS.water,
] as const;

export const SEMANTIC_PALETTE = {
  ink: PALETTE.ink,
  inkLight: RAMPS.timber[2],
  parchment: RAMPS.plaster[4],
  parchmentDark: RAMPS.plaster[3],
  vellum: RAMPS.plaster[5],
  vermilion: PALETTE.vermilion,
  gold: PALETTE.gold,
  goldDark: PALETTE.gold,
  ultramarine: PALETTE.ultramarine,
  sage: RAMPS.foliage[4],
  sageDark: RAMPS.foliage[3],
  forest: RAMPS.foliage[2],
  earth: RAMPS.timber[4],
  earthDark: RAMPS.earth[2],
  stone: RAMPS.plaster[1],
  stoneDark: RAMPS.plaster[0],
  water: RAMPS.water[3],
  winterGrey: RAMPS.slate[4],
  snow: RAMPS.plaster[5],
} as const satisfies Readonly<Record<string, PaletteColor>>;

export type PaletteName = keyof typeof PALETTE;
export type RampName = keyof typeof RAMPS;
export type PaletteColor = (typeof CANONICAL_PALETTE)[number];
export type SemanticPaletteName = keyof typeof SEMANTIC_PALETTE;
