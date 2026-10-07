/**
 * LM-E9b (spec docs/design/registry.md ER-13, the user's instruction 2026-10-05): the content canon is v4 with v4.1
 * merged by id — 011 replaced, 201–215 added, 215 in all; the events and the registry together; 011 once, the v4.1 one.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { mergeCanon, readCanon } from "../scripts/registryCanon";
import { holdCost, registryV4Support, v4Entry } from "../src/engine/registryV4";
import { V4_COPY } from "../src/content/registry/v4Copy.generated";
import { V4_BLOCKED_ENTRIES, V4_LIVE_ENTRIES } from "../src/content/registry/v4Entries.generated";

type Item = { readonly id: string };
const read = (path: string) => JSON.parse(readFileSync(`docs/design/content-drafts-20261002/${path}`, "utf8"));

// DEC-TRACE: v4.2 (the audit) revised 30 events after v4.1, 011 among them; the latest release of an id is the canon's.
const v42Events = () => read("v4.2/events-v4.2.json") as Item[];
const v42Entries = () => read("v4.2/registry-v4.2.json").entries as Item[];

test("ER-13 the canon v4 + v4.1 + v4.2: 215 events and 215 registry entries, the same ids, 011 once and its latest", () => {
  const canon = readCanon<Item & { readonly title?: string }, Item>();
  assert.equal(canon.events.length, 215);
  assert.equal(canon.registry.entries.length, 215);
  assert.deepEqual(canon.events.map(event => event.id).sort(), canon.registry.entries.map(entry => entry.id).sort());
  assert.equal(new Set(canon.events.map(event => event.id)).size, 215, "no id twice");
  const latestEvent = v42Events().find(event => event.id === "ck_evt_011") ?? (read("v4.1/events-v4.1.json") as Item[]).find(event => event.id === "ck_evt_011");
  const latestEntry = v42Entries().find(entry => entry.id === "ck_evt_011") ?? (read("v4.1/registry-v4.1.json").entries as Item[]).find(entry => entry.id === "ck_evt_011");
  assert.deepEqual(canon.events.filter(event => event.id === "ck_evt_011"), [latestEvent], "011 once, its latest event");
  assert.deepEqual(canon.registry.entries.filter(entry => entry.id === "ck_evt_011"), [latestEntry], "011 once, its latest entry");
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

test("ER-13, ER-19 v4.1-senders: 008 → the church, 024·035 → the town community — merged by id (still 215), and their holds now cost a relation", () => {
  const canon = readCanon<Item & { readonly sender?: { readonly faction?: string } }, Item>();
  assert.equal(canon.events.length, 215);
  const senders = read("v4.1-senders/events-v4.1.json") as (Item & { readonly sender: { readonly faction: string } })[];
  // DEC-TRACE: the senders' release is applied last and to the sender alone — v4.2's words stay (024 and 035 are v4.2's).
  for (const event of senders) {
    const words = v42Events().find(entry => entry.id === event.id) ?? event;
    assert.deepEqual(canon.events.filter(entry => entry.id === event.id), [{ ...words, sender: event.sender }], `${event.id} once, its latest words with the senders' sender`);
  }
  assert.deepEqual(Object.fromEntries(["ck_evt_008", "ck_evt_024", "ck_evt_035"].map(id => [id, holdCost(v4Entry(id)!)])),
    { ck_evt_008: { kind: "relation", faction: "bishop" }, ck_evt_024: { kind: "relation", faction: "town" }, ck_evt_035: { kind: "relation", faction: "town" } });
  const support = registryV4Support();
  const hidden = support.flatMap(row => row.choices.filter(choice => choice.reason === "hold without a time cost (R3)").map(() => row.id));
  assert.deepEqual(hidden.sort(), ["ck_evt_003", "ck_evt_046"], "only 003 (a variant) and 046 (the lord's own house) still hide a hold");
  // DEC-TRACE: 008 is held whole by the v4.2 audit, 024's subsidy choice by the user's decision; the rest stay on.
  assert.match(support.find(row => row.id === "ck_evt_008")!.reason ?? "", /^held \(v4\.2 audit/);
  assert.deepEqual(support.find(row => row.id === "ck_evt_024")!.choices.filter(choice => !choice.supported).map(choice => choice.id), ["market_promise"]);
  assert.ok(support.find(row => row.id === "ck_evt_035")!.choices.every(choice => choice.supported), "035: every choice on");
});

test("ER-13 an events-only delta (a sender fix) may only replace events the canon has", () => {
  const base = { events: [{ id: "a" }], registry: { policy: {}, entries: [{ id: "a" }] } };
  // DEC-TRACE: a delta that names its fields rewrites only those.
  assert.deepEqual(mergeCanon({ ...base, events: [{ id: "a", body: "new", sender: "two" } as Item] }, [{ events: [{ id: "a", body: "old", sender: "one" } as Item], fields: ["sender"] }]).events,
    [{ id: "a", body: "new", sender: "one" }]);
  assert.deepEqual(mergeCanon(base, [{ events: [{ id: "a", fixed: true } as Item] }]).events, [{ id: "a", fixed: true }]);
  assert.throws(() => mergeCanon(base, [{ events: [{ id: "b" }] }]), /may only replace events/);
});
