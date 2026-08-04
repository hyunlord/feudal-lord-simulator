import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { PALETTE } from "../src/content/palette";
import { nearestPalette, quantiseRgba, readPngDimensions, rgbToLab } from "../scripts/quantisePalette";

describe("quantisePalette", () => {
  it("keeps exact palette RGB values unchanged", () => {
    // Given: one opaque pixel for every canonical palette colour.
    const pixels = new Uint8Array(
      Object.values(PALETTE).flatMap((hex) => {
        const parsed = Number.parseInt(hex.slice(1), 16);
        return [(parsed >> 16) & 0xff, (parsed >> 8) & 0xff, parsed & 0xff, 255];
      }),
    );

    // When: the RGBA buffer is quantised.
    const quantised = quantiseRgba(pixels);

    // Then: canonical colours pass through byte-for-byte.
    assert.deepEqual(quantised, pixels);
  });

  it("maps near colours to the perceptually closest canonical colour", () => {
    // Given: a colour just off the manuscript gold swatch.
    const nearGold = { r: 211, g: 173, b: 55 };

    // When: the nearest palette entry is requested.
    const nearest = nearestPalette(rgbToLab(nearGold));

    // Then: the gold palette colour wins.
    assert.equal(nearest.hex, PALETTE.gold);
  });

  it("preserves the original alpha byte exactly", () => {
    // Given: two non-opaque pixels with distinct alpha bytes.
    const pixels = new Uint8Array([211, 173, 55, 17, 62, 80, 47, 0]);

    // When: the RGBA buffer is quantised.
    const quantised = quantiseRgba(pixels);

    // Then: only RGB bytes change.
    assert.equal(quantised[3], 17);
    assert.equal(quantised[7], 0);
  });

  it("rejects buffers that are not whole RGBA pixels", () => {
    // Given: an input byte sequence with no complete RGBA shape.
    const pixels = new Uint8Array([1, 2, 3]);

    // When / Then: quantisation fails explicitly.
    assert.throws(() => quantiseRgba(pixels), /RGBA buffer length/);
  });

  it("reads PNG dimensions from the IHDR boundary", () => {
    // Given: a minimal PNG header with a 13x17 IHDR.
    const directory = mkdtempSync(path.join(tmpdir(), "quantise-palette-"));
    const pngPath = path.join(directory, "header.png");
    const header = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
    header.writeUInt32BE(13, 16);
    header.writeUInt32BE(17, 20);
    writeFileSync(pngPath, header);

    // When: the boundary parser reads the file.
    const dimensions = readPngDimensions(pngPath);

    // Then: the big-endian IHDR dimensions are returned exactly.
    assert.deepEqual(dimensions, { width: 13, height: 17 });
  });
});
