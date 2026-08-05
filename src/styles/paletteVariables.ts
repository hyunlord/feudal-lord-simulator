import { SEMANTIC_PALETTE } from "../content/palette";

type PaletteVariableName = `--palette-${string}`;

function toKebabCase(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export const PALETTE_CSS_VARIABLES = Object.freeze(
  Object.fromEntries(
    Object.entries(SEMANTIC_PALETTE).map(([name, colour]) => [
      `--palette-${toKebabCase(name)}`,
      colour,
    ]),
  ),
) as Readonly<Record<PaletteVariableName, string>>;
