import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { decodePng, encodeJpeg, encodePng, halfSize, KEYART_DERIVATIVES, buildKeyartDerivative, sha256 } from "../scripts/keyartDerivatives";
import { WAVE8_IMAGES } from "../src/ui/wave8ArtManifest.generated";

// Judgement 2026-09-26: the keyart PNGs stay in assets-inbox; the game loads web derivatives made at build time.

test("every keyart derivative comes from a received inbox PNG and is the manifest's url", () => {
  const inbox = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8");
  for (const item of KEYART_DERIVATIVES) {
    assert.ok(item.source.startsWith("assets-inbox/wave8/"), item.id);
    assert.ok(inbox.includes(sha256(readFileSync(item.source))), `${item.id}: the source is the confirmed received file`);
    assert.equal(WAVE8_IMAGES[item.id as keyof typeof WAVE8_IMAGES].url, item.url);
  }
});

test("the screens become baseline JPEGs of about 300 KB at the source size; the emblem a half-size PNG with its alpha", () => {
  for (const item of KEYART_DERIVATIVES) {
    const out = buildKeyartDerivative(item);
    const source = decodePng(readFileSync(item.source));
    if (item.format === "jpeg") {
      assert.deepEqual([out[0], out[1], out[out.length - 2], out[out.length - 1]], [0xff, 0xd8, 0xff, 0xd9], item.id);
      const sof = out.indexOf(Buffer.from([0xff, 0xc0]));
      assert.deepEqual([out.readUInt16BE(sof + 7), out.readUInt16BE(sof + 5)], [source.width, source.height], `${item.id} size`);
      assert.ok(out.length >= 120_000 && out.length <= 450_000, `${item.id}: ${out.length} bytes`);
    } else {
      const image = decodePng(out);
      assert.deepEqual([image.width, image.height], [source.width / 2, source.height / 2]);
      assert.ok(image.data[3] === 0 && out.length < 150_000, "transparent corner, small file");
    }
  }
});

test("the encoders round-trip: a flat colour survives the PNG path exactly and a JPEG is deterministic", () => {
  const flat = { width: 4, height: 4, data: new Uint8Array(64).map((_, index) => [200, 120, 40, 255][index % 4]!) };
  assert.deepEqual(decodePng(encodePng(flat)).data, flat.data);
  assert.deepEqual(halfSize(flat).data, new Uint8Array([200, 120, 40, 255, 200, 120, 40, 255, 200, 120, 40, 255, 200, 120, 40, 255]));
  assert.deepEqual(encodeJpeg(flat, 70), encodeJpeg(flat, 70));
});
