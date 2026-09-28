import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { GameState } from "../src/engine/engine.types";
import type { Person } from "../src/engine/persons.types";
import { decodeSave } from "../src/save/saveCodec";
import { advanceTick } from "../src/engine/tick";
import { familyTreeView, TREE, type FamilyTreeView } from "../src/ui/chronicle/familyTreeModel";

// UI-7 the family tree's layout: outside spouses beside their member by the marriage link only (never on the parents'
// branch line), drops to members, folding by choice and to fit, the tree an outside spouse opens.
const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v24/palisade-construction.save.json"))).envelope.state as GameState;
const base = saved.persons!.people[0]!;
const L = "lin:test";
const person = (id: string, over: Partial<Person>): Person => ({ ...base, id, givenName: id, surname: "Test", alive: true, lineageId: L, role: "kin",
  householdId: `h-${id}`, birthYear: 1300, tags: [], motherId: undefined, fatherId: undefined, deathYear: undefined, ...over } as Person);
// Generation 0: the founder (dead) and his wife from outside. Generation 1: four children; the eldest son and the second
// daughter married (their spouses from outside, of their own lineages). Generation 2: two grandchildren for each.
const people: Person[] = [
  person("f", { sex: "male", birthYear: 1270, role: "head", householdId: "h-f", alive: false, deathYear: 1320 }),
  person("w", { sex: "female", birthYear: 1272, role: "spouse", householdId: "h-f", lineageId: "lin:w" }),
  person("a", { sex: "male", birthYear: 1295, fatherId: "f", motherId: "w", role: "head", householdId: "h-a" }),
  person("as", { sex: "female", birthYear: 1297, role: "spouse", householdId: "h-a", lineageId: "lin:as" }),
  person("b", { sex: "male", birthYear: 1297, fatherId: "f", motherId: "w" }),
  person("c", { sex: "female", birthYear: 1299, fatherId: "f", motherId: "w" }),
  person("d", { sex: "female", birthYear: 1301, fatherId: "f", motherId: "w", lineageId: L }),
  person("ds", { sex: "male", birthYear: 1300, lineageId: "lin:ds" }),
  person("a1", { sex: "male", birthYear: 1320, fatherId: "a", motherId: "as" }),
  person("a2", { sex: "female", birthYear: 1322, fatherId: "a", motherId: "as" }),
  // d's children carry their father's lineage in the engine; here the father is outside and the tree follows d.
  person("d1", { sex: "male", birthYear: 1325, fatherId: "ds", motherId: "d" }),
  person("d2", { sex: "female", birthYear: 1327, fatherId: "ds", motherId: "d" }),
];
const state = { ...saved, persons: { ...saved.persons!, people, past: [], lineages: [] }, factions: undefined } as unknown as GameState;
const nodeOf = (view: FamilyTreeView, id: string) => view.nodes.find(node => node.personId === id);

test("outside spouses stand beside their member, joined by the marriage link, and hang from no branch line", () => {
  const view = familyTreeView(state, "a2")!;
  for (const [member, spouse] of [["f", "w"], ["a", "as"], ["d", "ds"]] as const) {
    const m = nodeOf(view, member)!, s = nodeOf(view, spouse)!;
    assert.equal(s.outside, true, spouse);
    assert.equal(m.outside, false, member);
    assert.equal(s.y, m.y);
    assert.equal(s.x, m.x + TREE.nodeWidth + TREE.spouseGap, `${spouse} right of ${member}`);
    assert.ok(view.marriages.some(link => link.x === m.x + TREE.nodeWidth + TREE.spouseGap / 2 && link.y === m.y + TREE.nodeHeight / 2), `${member}–${spouse} link`);
    // No vertical line reaches the spouse's top (no drop from the parents' bar to them).
    const centre = s.x + TREE.nodeWidth / 2;
    assert.equal(view.lines.some(line => line.axis === "v" && Math.abs(line.x - centre) < 1 && Math.abs(line.y + line.length - s.y) < 1), false, `${spouse} drop`);
  }
  // Every member but the founder has a drop onto its top centre.
  for (const id of ["a", "b", "c", "d", "a1", "a2", "d1", "d2"]) {
    const n = nodeOf(view, id)!;
    assert.ok(view.lines.some(line => line.axis === "v" && Math.abs(line.x - (n.x + TREE.nodeWidth / 2)) < 1 && Math.abs(line.y + line.length - n.y) < 1), `${id} drop`);
  }
  // The children's stem comes down from the marriage link.
  const founder = nodeOf(view, "f")!;
  assert.ok(view.lines.some(line => line.axis === "v" && line.x === founder.x + TREE.nodeWidth + TREE.spouseGap / 2 && line.y === founder.y + TREE.nodeHeight / 2));
  assert.equal(nodeOf(view, "a2")!.selected, true);
  assert.equal(nodeOf(view, "f")!.dead, true);
  assert.deepEqual(view.generations.map(row => row.label), ["1대", "2대", "3대"]);
});

test("an outside spouse's tree is the one they married into", () => {
  const view = familyTreeView(state, "as")!;
  assert.equal(view.lineageId, L);
  assert.equal(nodeOf(view, "as")!.selected, true);
  assert.equal(nodeOf(view, "as")!.outside, true);
});

test("a folded unit hides its descendants and says how many; the player's choice holds over fitting", () => {
  const view = familyTreeView(state, "b", new Map([["a", false]]))!;
  assert.equal(nodeOf(view, "a1"), undefined);
  assert.equal(nodeOf(view, "a2"), undefined);
  const toggle = view.toggles.find(entry => entry.unitId === "a")!;
  assert.equal(toggle.open, false);
  assert.equal(toggle.hidden, 2);
  // Too narrow for everything: units off the selected person's line fold (deepest, widest first); a2's line stays open.
  const full = familyTreeView(state, "a2")!;
  const narrow = familyTreeView(state, "a2", new Map(), full.width - 100)!;
  assert.deepEqual(narrow.autoFolded, ["d"]);
  assert.ok(nodeOf(narrow, "a2") !== undefined && nodeOf(narrow, "d1") === undefined);
  // The player's unfold is kept even when it does not fit.
  const kept = familyTreeView(state, "a2", new Map([["d", true]]), full.width - 100)!;
  assert.deepEqual(kept.autoFolded, []);
  assert.ok(nodeOf(kept, "d1") !== undefined);
});

test("the lord's family in a v24 save: the lady is an outside spouse beside the lord, the children below", () => {
  // The ruling house's family forms in the manor within the first ticks after a load (LN-9).
  let town = saved;
  for (let tick = 0; tick < 30; tick += 1) town = advanceTick(town);
  const lordFamily = [...(town.persons?.people ?? []), ...(town.persons?.past ?? [])].filter(entry => entry.tags.includes("lord-family"));
  const lord = lordFamily.find(entry => entry.role === "head")!;
  const view = familyTreeView(town, lord.id)!;
  const lady = lordFamily.find(entry => entry.role === "spouse")!;
  assert.equal(nodeOf(view, lady.id)!.outside, true);
  assert.equal(nodeOf(view, lady.id)!.y, nodeOf(view, lord.id)!.y);
  const children = lordFamily.filter(entry => entry.fatherId === lord.id);
  assert.ok(children.length >= 2);
  for (const child of children) assert.ok(nodeOf(view, child.id)!.y > nodeOf(view, lord.id)!.y);
  assert.match(view.banner, /영주 가문/);
});

test("a child the save recorded without parents hangs under its household's head, not beside the founders", () => {
  const orphan = person("o", { sex: "female", birthYear: 1305, role: "child", householdId: "h-f" });
  const view = familyTreeView({ ...state, persons: { ...state.persons!, people: [...people, orphan] } } as GameState, "o")!;
  assert.equal(nodeOf(view, "o")!.generation, 1);
  assert.equal(view.generations.length, 3);
});
