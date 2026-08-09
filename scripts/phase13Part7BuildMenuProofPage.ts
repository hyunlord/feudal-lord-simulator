import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SEMANTIC_PALETTE } from "../src/content/palette";
import type { GameState } from "../src/engine/engine.types";
import { PALETTE_CSS_VARIABLES } from "../src/styles/paletteVariables";
import { BuildSeals } from "../src/ui/BuildMenu";

export async function pageHtml(input: { readonly state: GameState; readonly scenarioName: string }): Promise<string> {
  const css = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");
  const buildMenuMarkup = renderToStaticMarkup(
    createElement(BuildSeals, {
      selectedTool: null,
      state: input.state,
      onSelect: () => undefined,
    }),
  );
  const cssVariables = Object.entries(PALETTE_CSS_VARIABLES)
    .map(([name, value]) => `${name}: ${value};`)
    .join("\n");
  const paletteVariables = Object.entries(SEMANTIC_PALETTE)
    .map(([name, value]) => `--palette-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${value};`)
    .join("\n");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root {
${cssVariables}
${paletteVariables}
}
${css}
</style>
</head>
<body>
<main class="app-shell" data-proof-scenario="${input.scenarioName}" style="${inlineStyle(PALETTE_CSS_VARIABLES)}">
  <section class="court-console" aria-label="영주 명령대">
    <div class="court-recess map-recess"><button class="map-overview" type="button" aria-label="영지 지형 지도 이동"></button></div>
    <div class="court-recess seal-recess">${buildMenuMarkup}</div>
    <div class="court-recess ledger-recess"></div>
  </section>
</main>
</body>
</html>`;
}

function inlineStyle(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([name, value]) => `${name}: ${value}`)
    .join("; ");
}

export function htmlDataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
