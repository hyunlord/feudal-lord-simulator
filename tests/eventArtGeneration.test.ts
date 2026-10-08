import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { generation } from "../scripts/eventArtIntake";
import { parseCsv } from "../scripts/provenanceLedgerCsv";
import { eventCardEntryIds, shippedEventArtIds } from "../src/ui/eventArtSelection";

const pack = "assets-inbox/event-art/final200-20261004";
const [header, ...rows] = parseCsv(readFileSync(`${pack}/records/ASSETS.csv`, "utf8"));
assert.ok(header);
const assets = rows.map(row => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])));
const reused = new Map([...readFileSync(`${pack}/records/README.md`, "utf8").matchAll(/(ck_evt_\d{3})\(`([^`]+)`\)/g)]
  .map(match => [match[1], `assets-inbox/${match[2]}`]));
function picture(id: string) {
  const row = assets.find(asset => asset.event_id === id);
  assert.ok(row?.file && row.sha256);
  const file = reused.get(id) ?? `${pack}/${row.file}`;
  return { id, title: row.title ?? "", file, sha256: row.sha256, bytes: 0 };
}

test("r01 nested lowercase assets table selects exact received bytes and preserves recorded prompt", () => {
  const asset = picture("ck_evt_062");
  assert.equal(createHash("sha256").update(readFileSync(asset.file)).digest("hex"), asset.sha256);
  const selected = generation(asset);
  assert.equal(selected.version, "r01");
  assert.ok(selected.prompt.startsWith(readFileSync(`${pack}/records/r01/prompts/ck_evt_062.txt`, "utf8")));
  assert.match(selected.tool, /image_gen/);
  assert.match(selected.edits, /records\/assets.csv/);
  assert.throws(() => generation({ ...asset, sha256: "invalid-sha" }), /no round record selects/);
});

test("r02 correction prompts remain verbatim and are not misrepresented as proven selected lineage", () => {
  const selected = generation(picture("ck_evt_083"));
  const prompts: Record<string, string> = JSON.parse(readFileSync(`${pack}/records/r02/records/micro-v4-prompts.json`, "utf8"));
  assert.ok(prompts["083"]);
  assert.ok(selected.prompt.includes(prompts["083"]));
  assert.match(selected.prompt, /recomposition-v3-prompts.json/);
  assert.match(selected.edits, /not asserted to be an exact selected edit chain/);
});

test("every currently shipped event has a readable exact-SHA source generation record", () => {
  const known = Object.fromEntries(assets.map(asset => [asset.event_id, true]));
  const ids = shippedEventArtIds(known);
  assert.ok(ids.length > 0, "exercise the current shipped set");
  assert.deepEqual([...ids].sort(), eventCardEntryIds().filter(id => Object.hasOwn(known, id)).sort());
  for (const id of ids) {
    const asset = picture(id);
    assert.equal(createHash("sha256").update(readFileSync(asset.file)).digest("hex"), asset.sha256, id);
    const record = generation(asset);
    assert.ok(record.prompt.length > 30, id);
    assert.ok(record.edits.length > 0, id);
  }
});
