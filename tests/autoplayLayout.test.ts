import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GameProvider } from "../src/state/gameStore";
import { SpeedSeals } from "../src/ui/SpeedControls";

const STYLESHEET = new URL("../src/styles/global.css", import.meta.url);

test("Given desktop speed controls When rendered in the ledger grid Then speed and autoplay share one grid item", () => {
  // Given / When
  const markup = renderToStaticMarkup(
    createElement(
      GameProvider,
      null,
      createElement(SpeedSeals, { speed: 0, onChange: () => undefined }),
    ),
  );

  // Then
  assert.match(markup, /^<div class="speed-control-stack">/);
  assert.match(
    markup,
    /^<div class="speed-control-stack"><div class="speed-seals"[\s\S]*<div class="autoplay-control"/,
  );
});

test("Given the shared speed control grid item When desktop and compact CSS apply Then it stays bounded and stretches only in compact layouts", async () => {
  // Given / When
  const css = await readFile(STYLESHEET, "utf8");
  const desktopRule = css.match(/\.speed-control-stack\s*\{([^}]*)\}/)?.[1] ?? "";
  const compactRule = css.match(
    /@media \(max-width: 900px\) \{[\s\S]*?\.speed-control-stack\s*\{([^}]*)\}/,
  )?.[1] ?? "";

  // Then
  assert.match(desktopRule, /display:\s*grid;/);
  assert.match(desktopRule, /align-self:\s*start;/);
  assert.match(desktopRule, /min-width:\s*0;/);
  assert.match(compactRule, /align-self:\s*stretch;/);
  assert.match(compactRule, /width:\s*100%;/);
});
