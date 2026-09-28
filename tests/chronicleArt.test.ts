import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PORTRAIT_POOL } from "../src/content/portraitPool";
import { buildKeyartDerivative, PORTRAIT_DERIVATIVES, resizeArea, sha256, WAVE17_DERIVATIVES } from "../scripts/keyartDerivatives";
import { PORTRAIT_IMAGES } from "../src/ui/portraitArtManifest.generated";
import { portraitStyle, portraitUrl } from "../src/ui/portraitArt";

// CHRON-1 art install (scripts/installChronicleArt.py): the portrait pool and two Wave 17 chronicle illustrations as
// build-time web derivatives of the received PNGs (judgement 2026-09-26: the PNGs stay in assets-inbox).

const inbox = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8");
const ledger = readFileSync("docs/provenance/assets.csv", "utf8");
const jpegSize = (bytes: Buffer) => { const sof = bytes.indexOf(Buffer.from([0xff, 0xc0])); return [bytes.readUInt16BE(sof + 7), bytes.readUInt16BE(sof + 5)]; };

test("every PERSON-0 pool picture is installed: a received PNG in the inbox ledger, a provenance row, a 256 and a 96 derivative", () => {
  assert.equal(PORTRAIT_POOL.length, 630); // FIX-6: pool 3 (I101–I124, the factions' leaders) joins the 232; PERSON-1a the 326 lineage pictures
  assert.deepEqual(Object.keys(PORTRAIT_IMAGES).sort(), PORTRAIT_POOL.map(entry => entry.id).sort());
  assert.equal(PORTRAIT_DERIVATIVES.length, 1260);
  for (const entry of PORTRAIT_POOL) {
    const image = PORTRAIT_IMAGES[entry.id as keyof typeof PORTRAIT_IMAGES];
    assert.ok(image.source.endsWith(entry.file), `${entry.id}: ${image.source} is the pool's ${entry.file}`);
    assert.ok(inbox.includes(sha256(readFileSync(image.source))), `${entry.id}: the received bytes`);
    assert.ok(ledger.includes(`portrait/${entry.id},v1,${image.source},`), `${entry.id}: provenance row`);
  }
});

test("a portrait ships as baseline JPEGs of 256 and 96 px (about 11 KB and 2.5 KB; the received eXIf chunk is not carried)", () => {
  for (const item of PORTRAIT_DERIVATIVES.filter((_, index) => index % 40 === 0 || index % 40 === 1)) {
    const out = buildKeyartDerivative(item);
    assert.deepEqual([out[0], out[1], out.at(-2), out.at(-1)], [0xff, 0xd8, 0xff, 0xd9], item.id);
    assert.deepEqual(jpegSize(out), item.format === "portrait" ? [256, 256] : [96, 96], item.id);
    assert.ok(out.length < (item.format === "portrait" ? 20_000 : 5_000), `${item.id}: ${out.length} bytes`);
    assert.equal(out.indexOf(Buffer.from("Exif")), -1, `${item.id}: no Exif`);
  }
});

test("the 96 px portrait is an exact area average (a flat picture stays flat; three pixels into two weigh the middle one by halves)", () => {
  const flat = { width: 6, height: 6, data: new Uint8Array(144).map((_, index) => [90, 60, 30, 255][index % 4]!) };
  assert.deepEqual([...resizeArea(flat, 4, 4).data.slice(0, 4)], [90, 60, 30, 255]);
  const split = { width: 3, height: 1, data: new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255, 255]) };
  assert.deepEqual([...resizeArea(split, 2, 1).data], [0, 0, 0, 255, 170, 170, 170, 255]);
});

test("the runtime asks for the 96 at 1x and the 256 at 2x in small slots, the 256 in large ones, and nothing outside the pool", () => {
  assert.equal(portraitUrl("P05", 96), "/assets/portraits/96/P05.jpg");
  assert.match(String(portraitStyle("I038_young", 44)?.backgroundImage), /image-set\(url\("\/assets\/portraits\/96\/I038_young\.jpg"\) 1x, url\("\/assets\/portraits\/256\/I038_young\.jpg"\) 2x\)/);
  assert.equal(portraitStyle("I038_young", 160)?.backgroundImage, 'url("/assets/portraits/256/I038_young.jpg")');
  assert.equal(portraitStyle("Z999", 44), null);
});

test("Wave 17: CHRON-1's stone town and UI-6's chapter 2 scenes, JPEG derivatives of their confirmed received PNGs", () => {
  // Decision cards 640 x 480, event cards 960 x 540, chronicle scenes 384 x 384, chapter 2's end page 1920 x 1080.
  const size = (id: string) => id.startsWith("decision_") ? [640, 480] : id.startsWith("event_") ? [960, 540] : id === "chapter2_end" ? [1920, 1080] : [384, 384];
  assert.equal(WAVE17_DERIVATIVES.length, 22);
  assert.deepEqual(WAVE17_DERIVATIVES.slice(0, 2).map(item => item.id), ["stonewall_start", "stonewall_complete"]);
  for (const item of WAVE17_DERIVATIVES) {
    assert.ok(inbox.includes(sha256(readFileSync(item.source))), item.id);
    assert.ok(ledger.includes(item.source), `${item.id}: provenance row`);
    assert.deepEqual(jpegSize(buildKeyartDerivative(item)), size(item.id), item.id);
  }
});
