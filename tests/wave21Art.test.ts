import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildKeyartDerivative, sha256, WAVE21_DERIVATIVES } from "../scripts/keyartDerivatives";
import { WAVE21_IMAGES } from "../src/ui/wave21ArtManifest.generated";

// UI-8: Wave 21 chapter 3 illustrations (scripts/installWave21.py): decision cards, event illustrations,
// chronicle scenes and the chapter-3 end page as build-time JPEG derivatives of the received PNGs.
// Judgement 2026-09-29: PNGs stay in assets-inbox.

const inbox = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8");
const ledger = readFileSync("docs/provenance/assets.csv", "utf8");
const jpegSize = (bytes: Buffer) => { const sof = bytes.indexOf(Buffer.from([0xff, 0xc0])); return [bytes.readUInt16BE(sof + 7), bytes.readUInt16BE(sof + 5)]; };

test("Wave 21: 19 chapter-3 illustrations as confirmed received PNGs in the inbox ledger", () => {
  assert.equal(WAVE21_DERIVATIVES.length, 19);
  assert.equal(Object.keys(WAVE21_IMAGES).length, 19);
  for (const item of WAVE21_DERIVATIVES) {
    assert.ok(inbox.includes(sha256(readFileSync(item.source))), `${item.id}: sha256 matches INBOX_LEDGER`);
    assert.ok(ledger.includes(item.source), `${item.id}: provenance row in assets.csv`);
  }
});

test("Wave 21: JPEG derivatives match declared dimensions (decision 640×480, event 960×540, chronicle 384×384, chapter-3 end 1920×1080)", () => {
  const expected = (id: string): [number, number] =>
    id.startsWith("ch3_decision_") ? [640, 480]
    : id.startsWith("ch3_event_") ? [960, 540]
    : id === "ch3_ending" ? [1920, 1080]
    : [384, 384]; // ch3_chronicle_*
  for (const item of WAVE21_DERIVATIVES) {
    assert.deepEqual(jpegSize(buildKeyartDerivative(item)), expected(item.id), item.id);
  }
});

test("Wave 21: every manifest id resolves to a declared url under assets/wave21/", () => {
  for (const [id, image] of Object.entries(WAVE21_IMAGES)) {
    assert.ok(image.url.startsWith("assets/wave21/"), `${id}: url is under assets/wave21/`);
    assert.ok(image.url.endsWith(".jpg"), `${id}: url ends with .jpg`);
    assert.ok(image.source.startsWith("assets-inbox/wave21/"), `${id}: source is under assets-inbox/wave21/`);
  }
});
