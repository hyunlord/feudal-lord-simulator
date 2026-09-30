import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { LedgerDrawer } from "../src/ui/hud/HudShell";
import { foldFollowsLight, ledgerRowOpen, toggledFold } from "../src/ui/hud/LedgerStockTable";
import { ledgerMatrix } from "../src/ui/hud/statusPillModel";

// UI-10: the ledger's "보관 N곳" (NAT2-D5's folded column) as the button that unfolds a row to each store's amount
// and folds it again (Astra's 1380 town, fixture ch4-1380, as nat2Ledger.test.ts).

const town = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/perf-gate/ch4-1380.save.json.gz")))).envelope.state as GameState;
const drawer = (highlighted: readonly string[] = []) => renderToStaticMarkup(createElement(LedgerDrawer, { state: town, onInspect: () => undefined, onClose: () => undefined,
  viewTab: null, mapTab: null, highlighted, onHighlight: () => undefined }));

test("UI-10 ledger: \"보관 N곳\" is a button (aria-expanded, its list's id when open) in each held row; an unheld row keeps the dash", () => {
  const folded = drawer();
  const toggles = folded.match(/<button type="button" class="ledger-held-toggle ui-btn ui-btn--surface" aria-expanded="false" aria-label="[^"]+ 보관 \d+곳 — 곳마다 양 펼치고 접기">\d+곳<\/button>/g) ?? [];
  assert.ok(toggles.length > 3, `${toggles.length} toggles`);
  assert.doesNotMatch(folded, /data-resource-stores=/);
  assert.doesNotMatch(folded, /<td class="ledger-held">(?!<button|—)/, "a held count is always the button");
  // A lit row opens with its light (NAT-2), and its button says so and names the list.
  const matrix = ledgerMatrix(town);
  const wheat = matrix.rows.find(row => row.resource === "wheat")!;
  const lit = drawer(matrix.stores.filter((_store, index) => (wheat.byStore[index] ?? 0) > 0).map(store => store.id));
  assert.match(lit, /<tr data-resource="wheat" data-lit="true">[\s\S]*?aria-expanded="true" aria-controls="ledger-stores-wheat"/);
  assert.match(lit, /<tr id="ledger-stores-wheat" class="ledger-stores-row" data-resource-stores="wheat">/);
  const css = readFileSync("src/styles/hudShell.css", "utf8");
  assert.match(css, /\.app-shell \.ledger-held-toggle \{[^}]*min-width: 44px; min-height: 44px;/);
  assert.match(css, /@media \(pointer: coarse\) \{ \.app-shell :is\(\.ledger-row, \.ledger-held-toggle, \.ledger-store\) \{ min-height: 48px; \} \}/);
});

test("UI-10 ledger: pressing \"보관 N곳\" unfolds a folded row and folds it again; a lit row folds too; a row's press hands the fold back to its light", () => {
  let folds = {};
  assert.equal(ledgerRowOpen(folds, "wheat", false), false);
  folds = toggledFold(folds, "wheat", ledgerRowOpen(folds, "wheat", false));
  assert.equal(ledgerRowOpen(folds, "wheat", false), true, "unfolded");
  assert.equal(ledgerRowOpen(folds, "bread", false), false, "the other rows stay folded");
  folds = toggledFold(folds, "wheat", ledgerRowOpen(folds, "wheat", false));
  assert.equal(ledgerRowOpen(folds, "wheat", false), false, "folded again");
  // Lit (its stores on the map): open by its light; the button folds it without unlighting the map.
  const litFolds = toggledFold({}, "wheat", ledgerRowOpen({}, "wheat", true));
  assert.equal(ledgerRowOpen(litFolds, "wheat", true), false);
  assert.equal(ledgerRowOpen(foldFollowsLight(litFolds, "wheat"), "wheat", true), true);
  assert.equal(ledgerRowOpen(foldFollowsLight(litFolds, "wheat"), "wheat", false), false, "unlit by its press: folded");
});
