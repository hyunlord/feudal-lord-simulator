/**
 * EVENT-ART: the in-house JPEG decoder (scripts/jpegDecode.ts) behind the build-time re-encode of received JPEGs — a
 * baseline and a progressive received picture against libjpeg's own decode (each 4 × 4 region's mean colour, measured
 * with Pillow 12.2 on 2026-10-05), the repo's encoder round-tripped at odd sizes, and the same pixels on every run.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { decodeJpeg } from "../scripts/jpegDecode";
import { encodeJpeg, sha256 } from "../scripts/keyartDerivatives";

/** libjpeg's (Pillow's) decode: each region's mean R, G, B over a 4 × 4 grid. */
const LIBJPEG: Readonly<Record<string, readonly (readonly number[])[]>> = {
  // Progressive, 4:2:0 (candidates-20261003).
  "assets-inbox/event-art/candidates-20261003/assets/ck_evt_005.jpg": [[149.73, 127.9, 107.28], [155.14, 135.98, 120.76], [164.01, 150.98, 140.34], [138.47, 122.23, 113.15],
    [131.32, 102.97, 76.96], [114.09, 88.54, 66.29], [156.42, 129.62, 104.46], [90.66, 66.0, 47.94], [116.18, 84.04, 59.91], [116.29, 84.57, 61.84], [144.61, 117.15, 95.06],
    [71.13, 48.22, 34.33], [116.4, 84.67, 61.43], [143.11, 107.31, 82.17], [158.05, 122.65, 97.47], [136.51, 102.25, 77.1]],
  // Baseline, 4:2:0 (final200).
  "assets-inbox/event-art/final200-20261004/assets/ck_evt_013.jpg": [[167.6, 137.7, 106.49], [147.52, 110.44, 79.16], [119.39, 81.78, 59.19], [89.88, 56.39, 34.56],
    [129.96, 92.78, 64.29], [100.61, 67.23, 42.52], [87.3, 55.58, 38.15], [89.84, 53.74, 34.19], [138.26, 99.92, 69.53], [109.23, 72.48, 43.85], [142.86, 96.84, 59.46],
    [107.36, 66.88, 37.76], [120.68, 81.54, 51.62], [131.88, 85.4, 49.8], [150.11, 100.62, 60.16], [77.17, 46.75, 25.82]],
};

function regionMeans(image: ReturnType<typeof decodeJpeg>): number[][] {
  const out: number[][] = [];
  for (let gy = 0; gy < 4; gy += 1) for (let gx = 0; gx < 4; gx += 1) {
    const sum: [number, number, number] = [0, 0, 0]; let count = 0;
    for (let y = Math.floor(gy * image.height / 4); y < Math.floor((gy + 1) * image.height / 4); y += 1) {
      for (let x = Math.floor(gx * image.width / 4); x < Math.floor((gx + 1) * image.width / 4); x += 1) {
        const at = (y * image.width + x) * 4; sum[0] += image.data[at]!; sum[1] += image.data[at + 1]!; sum[2] += image.data[at + 2]!; count += 1;
      }
    }
    out.push(sum.map(value => value / count));
  }
  return out;
}

test("a baseline and a progressive received picture decode as libjpeg decodes them (region means within 0.6)", () => {
  for (const [path, expected] of Object.entries(LIBJPEG)) {
    const image = decodeJpeg(readFileSync(path));
    assert.deepEqual([image.width, image.height], [960, 540], path);
    const means = regionMeans(image);
    for (const [index, region] of expected.entries()) {
      for (const channel of [0, 1, 2]) assert.ok(Math.abs(means[index]![channel]! - region[channel]!) < 0.6, `${path} region ${index} channel ${channel}: ${means[index]![channel]} vs ${region[channel]}`);
    }
  }
});

test("the repo's encoder round-trips through the decoder at odd sizes; the same bytes give the same pixels", () => {
  const width = 37; const height = 23;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const at = (y * width + x) * 4; data[at] = x * 6; data[at + 1] = y * 10; data[at + 2] = 100 + x * 2 + y * 3; data[at + 3] = 255;
  }
  const encoded = encodeJpeg({ width, height, data }, 95);
  const decoded = decodeJpeg(encoded);
  assert.deepEqual([decoded.width, decoded.height], [width, height]);
  let error = 0;
  for (let at = 0; at < data.length; at += 4) for (const channel of [0, 1, 2]) error += Math.abs(decoded.data[at + channel]! - data[at + channel]!);
  // Under 3 levels: the chroma is replicated, not interpolated (libjpeg's smoother upsampling gives 0.9 here; the luma of
  // the two decodes differs by at most 1).
  assert.ok(error / (width * height * 3) < 3, `mean error ${error / (width * height * 3)}`);
  const source = readFileSync("assets-inbox/event-art/candidates-20261003/assets/ck_evt_005.jpg");
  assert.equal(sha256(decodeJpeg(source).data), sha256(decodeJpeg(source).data));
  assert.throws(() => decodeJpeg(new Uint8Array([0x89, 0x50])), /not a JPEG/);
});
