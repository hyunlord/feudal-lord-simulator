import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { gunzipSync } from "node:zlib";

import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { LedgerDrawer } from "../src/ui/hud/HudShell";
import { ledgerMatrix } from "../src/ui/hud/statusPillModel";

// NAT-2 (QA-006): the ledger drawer on Astra's 1380 town (fixture ch4-1380, 49 stores; 57 once it runs a little): five columns whatever the
// stores (no column per store behind a horizontal scroll), a lit row lists its stores (each opens its card), and the
// drawer wears the kit's skin — the chronicle's ledger-card frame, the width token, rows that are not default buttons.
const town = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/perf-gate/ch4-1380.save.json.gz")))).envelope.state as GameState;
const drawer = (highlighted: readonly string[] = []) => renderToStaticMarkup(createElement(LedgerDrawer, { state: town, onInspect: () => undefined, onClose: () => undefined,
  viewTab: null, mapTab: null, highlighted, onHighlight: () => undefined }));

test("NAT-2 QA-006: the stock table has five columns for a town of 49 stores", () => {
  // Given
  const matrix = ledgerMatrix(town);
  assert.ok(matrix.stores.length > 40, `${matrix.stores.length} stores`);

  // When
  const markup = drawer();

  // Then
  const head = markup.slice(markup.indexOf("<thead>"), markup.indexOf("</thead>"));
  assert.equal((head.match(/<th /g) ?? []).length, 5);
  assert.match(head, /합계<\/th><th scope="col">이번 주<\/th><th scope="col">버팀<\/th><th scope="col">보관<\/th>/);
  assert.doesNotMatch(markup, /ledger-store/, "no store buttons until a row is lit");
  const wheat = matrix.rows.find(row => row.resource === "wheat")!;
  const held = wheat.byStore.filter(amount => amount > 0).length;
  // UI-10: the count is the button that unfolds the row.
  assert.match(markup, new RegExp(`data-resource="wheat"[\\s\\S]*?<td class="ledger-held"><button type="button" class="ledger-held-toggle ui-btn ui-btn--surface" aria-expanded="false"[^>]*>${held}곳</button></td>`));
});

test("NAT-2 QA-006: a lit row lists the stores that hold it with their amounts, the others stay folded", () => {
  // Given: the wheat row lit (its stores highlighted on the map)
  const matrix = ledgerMatrix(town);
  const wheat = matrix.rows.find(row => row.resource === "wheat")!;
  const holders = matrix.stores.filter((_store, index) => (wheat.byStore[index] ?? 0) > 0);

  // When
  const markup = drawer(holders.map(store => store.id));

  // Then
  assert.match(markup, /<tr data-resource="wheat" data-lit="true">/);
  const list = markup.slice(markup.indexOf('data-resource-stores="wheat"'), markup.indexOf("</ul>", markup.indexOf('data-resource-stores="wheat"')));
  assert.equal((list.match(/class="ledger-store ui-btn/g) ?? []).length, holders.length);
  const first = holders[0]!; const amount = wheat.byStore[matrix.stores.indexOf(first)]!;
  assert.match(list, new RegExp(`${first.index} · ${amount}</button>`));
  assert.equal((markup.match(/data-resource-stores=/g) ?? []).length, 1);
});

test("NAT-2 QA-006: the drawer's skin — the Wave 19 ledger-card frame, the wide width token, surfaces without the browser's button paint", () => {
  const kit = readFileSync("src/styles/uiKit.css", "utf8");
  const hud = readFileSync("src/styles/hudShell.css", "utf8");
  assert.match(kit, /:root \.app-shell \.slot-panel\.ledger-drawer \{[^}]*border-image: url\("\/assets\/wave19\/cards\/frame_record_ledger\.png"\)/);
  assert.match(hud, /\.app-shell \.ledger-drawer \{[^}]*width: min\(var\(--box-w-wide\)/);
  assert.match(kit, /:where\(\.ui-btn--surface\) \{ background-color: transparent; border: 0 solid transparent; \}/);
});
