import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildKeyartDerivative, ENDING_DERIVATIVES, KEYART_DERIVATIVE_BY_URL, sha256 } from "../scripts/keyartDerivatives";
import { LEGACY_ENDING_IDS } from "../src/content/legacyConfig";
import { ENDING_IMAGES } from "../src/ui/endingArtManifest.generated";

// INSTALL-33: the campaign's six ending paintings (scripts/installEndings.py, INBOX-2s): one per LegacyEndingId, by the
// pack README's scene table, shipped as the received 1920 × 1080 JPEGs (keyartDerivatives format jpeg-received).

const inbox = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8").split(/\r?\n/);
const ledger = readFileSync("docs/provenance/assets.csv", "utf8");
const jpegSize = (bytes: Buffer) => { const sof = bytes.indexOf(Buffer.from([0xff, 0xc0])); return [bytes.readUInt16BE(sof + 7), bytes.readUInt16BE(sof + 5)]; };

test("INSTALL-33: one painting per engine ending, six distinct, by the pack's scene table", () => {
  assert.deepEqual(Object.keys(ENDING_IMAGES).sort(), [...LEGACY_ENDING_IDS].sort());
  assert.deepEqual(Object.fromEntries(Object.entries(ENDING_IMAGES).map(([id, image]) => [id, image.assetId])), {
    free_borough: "campaign_ending_self_governing_city-v1", house_remembered: "campaign_ending_remembered_lineage-v1",
    merchants_chantry: "campaign_ending_merchants_chantry-v1", house_seat: "campaign_ending_family_city-v1",
    lords_town: "campaign_ending_lords_city-v1", pilgrim_town: "campaign_ending_pilgrims_city-v1",
  });
  const images = Object.values(ENDING_IMAGES);
  for (const key of ["url", "source"] as const) assert.equal(new Set(images.map(image => image[key])).size, 6, key);
  assert.equal(new Set(images.map(image => sha256(readFileSync(image.source)))).size, 6, "six different pictures");
  assert.ok(!images.some(image => image.source.includes("/manors/")), "the empty manors are left out");
});

test("INSTALL-33: confirmed received JPEGs, installed by INSTALL-33, with provenance rows, shipped as they came (1920×1080)", () => {
  assert.equal(ENDING_DERIVATIVES.length, 6);
  for (const item of ENDING_DERIVATIVES) {
    const source = readFileSync(item.source);
    const row = inbox.find(line => line.includes(sha256(source)));
    assert.ok(row !== undefined && row.includes(",confirmed,") && row.endsWith(",INSTALL-33"), `${item.id}: confirmed, installed_by INSTALL-33 (${row})`);
    assert.ok(ledger.includes(`endings/${item.id},`) && ledger.includes(item.source), `${item.id}: provenance row`);
    assert.equal(KEYART_DERIVATIVE_BY_URL.get(item.url), item, `${item.id}: in WEB_ART_DERIVATIVES`);
    const shipped = buildKeyartDerivative(item);
    assert.ok(shipped.equals(source), `${item.id}: the received bytes, no second encode`);
    assert.deepEqual(jpegSize(shipped), [1920, 1080], item.id);
    assert.ok(item.url.startsWith("assets/endings/") && item.url.endsWith(".jpg"), item.url);
  }
});
