/**
 * LM-E9b (spec docs/design/registry.md ER-13, the user's instruction 2026-10-05): the content canon is v4 with v4.1
 * merged by id — 011 replaced, 201–215 added, 215 in all; the events and the registry together; 011 once, the v4.1 one.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { mergeCanon, readCanon } from "../scripts/registryCanon";
import { V4_COPY } from "../src/content/registry/v4Copy.generated";
import { V4_BLOCKED_ENTRIES, V4_LIVE_ENTRIES } from "../src/content/registry/v4Entries.generated";

type Item = { readonly id: string };
const read = (path: string) => JSON.parse(readFileSync(`docs/design/content-drafts-20261002/${path}`, "utf8"));

test("ER-13 the canon v4 + v4.1: 215 events and 215 registry entries, the same ids, 011 once and the v4.1 one", () => {
  const canon = readCanon<Item & { readonly title?: string }, Item>();
  assert.equal(canon.events.length, 215);
  assert.equal(canon.registry.entries.length, 215);
  assert.deepEqual(canon.events.map(event => event.id).sort(), canon.registry.entries.map(entry => entry.id).sort());
  assert.equal(new Set(canon.events.map(event => event.id)).size, 215, "no id twice");
  const v41Event = (read("v4.1/events-v4.1.json") as Item[]).find(event => event.id === "ck_evt_011");
  const v41Entry = (read("v4.1/registry-v4.1.json").entries as Item[]).find(entry => entry.id === "ck_evt_011");
  assert.deepEqual(canon.events.filter(event => event.id === "ck_evt_011"), [v41Event], "011 once, the v4.1 event");
  assert.deepEqual(canon.registry.entries.filter(entry => entry.id === "ck_evt_011"), [v41Entry], "011 once, the v4.1 entry");
  for (let number = 201; number <= 215; number += 1) assert.ok(canon.events.some(event => event.id === `ck_evt_${number}`), `ck_evt_${number} added`);
  // The generated registry data and words carry the same 215.
  const generated = [...(V4_LIVE_ENTRIES as readonly Item[]).map(entry => entry.id), ...V4_BLOCKED_ENTRIES.map(entry => entry.id)];
  assert.equal(generated.length, 215);
  assert.equal(generated.filter(id => id === "ck_evt_011").length, 1);
  assert.equal(Object.keys(V4_COPY).length, 215);
  assert.ok(!JSON.stringify(V4_LIVE_ENTRIES).includes("COUNTER_MATERIAL_BURDEN_INCREASE_V1"), "011's wrong derived name is gone");
});

test("ER-13 a delta whose events and registry name different ids is refused", () => {
  const base = { events: [{ id: "a" }], registry: { policy: {}, entries: [{ id: "a" }] } };
  assert.throws(() => mergeCanon(base, [{ events: [{ id: "a" }, { id: "b" }], registry: { policy: {}, entries: [{ id: "a" }] } }]), /different ids/);
  const merged = mergeCanon(base, [{ events: [{ id: "a" }, { id: "b" }], registry: { policy: {}, entries: [{ id: "b" }, { id: "a" }] } }]);
  assert.deepEqual(merged.events.map(event => event.id), ["a", "b"]);
});
