import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildKeyartDerivative, KEYART_DERIVATIVE_BY_URL, sha256, WAVE33_DERIVATIVES } from "../scripts/keyartDerivatives";
import { LEGACY_INTERLUDE_IDS } from "../src/content/legacyConfig";
import { WAVE33_IMAGES } from "../src/ui/wave33ArtManifest.generated";

// UI-10: Wave 33 interlude illustrations (scripts/installWave33.py): chapter 5's five 1384–1400 interlude events,
// one per LegacyInterludeId, as build-time JPEG derivatives of the received PNGs (the PNGs stay in assets-inbox).

const inbox = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8");
const ledger = readFileSync("docs/provenance/assets.csv", "utf8");
const jpegSize = (bytes: Buffer) => { const sof = bytes.indexOf(Buffer.from([0xff, 0xc0])); return [bytes.readUInt16BE(sof + 7), bytes.readUInt16BE(sof + 5)]; };

test("Wave 33: one illustration per engine interlude id (interlude_<LegacyInterludeId>)", () => {
  assert.deepEqual(Object.keys(WAVE33_IMAGES).sort(), LEGACY_INTERLUDE_IDS.map(id => `interlude_${id}`).sort());
});

test("Wave 33: confirmed received PNGs in the inbox ledger, with provenance rows, shipped as web derivatives", () => {
  assert.equal(WAVE33_DERIVATIVES.length, 5);
  for (const item of WAVE33_DERIVATIVES) {
    assert.ok(inbox.includes(sha256(readFileSync(item.source))), `${item.id}: sha256 matches INBOX_LEDGER`);
    assert.ok(ledger.includes(item.source), `${item.id}: provenance row in assets.csv`);
    assert.equal(KEYART_DERIVATIVE_BY_URL.get(item.url), item, `${item.id}: in WEB_ART_DERIVATIVES`);
  }
});

test("Wave 33: JPEG derivatives are 960×540, urls under assets/wave33/interlude/, years 1391–1399", () => {
  for (const item of WAVE33_DERIVATIVES) assert.deepEqual(jpegSize(buildKeyartDerivative(item)), [960, 540], item.id);
  for (const [id, image] of Object.entries(WAVE33_IMAGES)) {
    assert.ok(image.url.startsWith("assets/wave33/interlude/") && image.url.endsWith(".jpg"), id);
    assert.ok(image.source.startsWith("assets-inbox/wave33/"), id);
    assert.ok(image.year >= 1391 && image.year <= 1399, id);
  }
});
