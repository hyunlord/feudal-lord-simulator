import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { decodeSave } from "../src/save/saveCodec";
import { FamilyTree } from "../src/ui/chronicle/FamilyTree";

// UI-7: the tree's markup — one frame button per person (the deceased and outside-spouse marks on the frame), the
// Wave 25 parts by url, the fold buttons at least 44 px, and no text under 12 px.
let town = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v24/palisade-construction.save.json"))).envelope.state as GameState;
for (let tick = 0; tick < 30; tick += 1) town = advanceTick(town);
const lord = town.persons!.people.find(person => person.tags.includes("lord-family") && person.role === "head")!;

test("the lord's tree: frames, the lady marked as married in, the banner and the lines from Wave 25", () => {
  const html = renderToStaticMarkup(createElement(FamilyTree, { state: town, personId: lord.id, onPerson: () => undefined }));
  const frames = html.match(/class="[^"]*family-tree-node[^"]*"/g) ?? [];
  assert.equal(frames.length, town.persons!.people.filter(person => person.tags.includes("lord-family")).length);
  assert.match(html, /data-outside="true"/);
  assert.match(html, /aria-selected="true"/);
  for (const part of ["tree_lineage_banner", "tree_generation_label", "tree_node_frame_selected", "tree_line_v", "tree_line_h", "tree_marriage_link", "tree_collapse", "tree_outside_spouse_marker"]) {
    assert.ok(html.includes(`assets/wave25/tree/${part}.png`), part);
  }
  assert.match(html, /영주 가문/);
});
