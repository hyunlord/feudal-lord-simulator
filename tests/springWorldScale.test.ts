import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { decodePng } from '../scripts/keyartDerivatives';
import { ART_REGISTRY } from '../src/render/art/wave42Registry';
import { isSpringWorldEntry } from '../src/render/art/springWorldValidation';
const adultHeight = 17.6; // docs/design/art-bible.md:29,33: sheep BACK 0.35–0.50H; adult canonical world height.
function alphaRows(id: string, column?: number): { readonly height: number; readonly scale: number } {
  const entry = ART_REGISTRY.entry(`wave43:${id}`); assert.ok(isSpringWorldEntry(entry));
  const png = decodePng(readFileSync(entry.provenance.inboxFile));
  let top = png.height, bottom = -1;
  for (let y = 0; y < png.height; y++) for (let x = column ?? 0; x < (column === undefined ? png.width : column + 1); x++) {
    if ((png.data[(y * png.width + x) * 4 + 3] ?? 0) < 32) continue;
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  assert.ok(bottom >= top); return { height: bottom - top + 1, scale: entry.geometry.scale };
}
test('Given laundry source pixels When uniformly displayed Then its entire alpha silhouette is no taller than an adult', () => {
  const measured = alphaRows('laundry_yard_spring'); assert.equal(measured.height, 163);
  assert.ok(measured.height * measured.scale <= adultHeight, `laundry silhouette ${measured.height * measured.scale}`);
});
test('Given the two source ewe poses When measuring back-to-hoof columns Then both use one scale within the Bible back-height band', () => {
  // Manual source inspection: A x66 intersects back y26 and hoof/ground y66; B x65 intersects back y30
  // and hoof/ground y77. Inclusive alpha spans conservatively include ground/shadow. B's raised neck/head
  // starts farther right (x68+); its whole silhouette is intentionally NOT used as the back-height metric.
  const a = alphaRows('ewe_lamb_a_spring', 66), b = alphaRows('ewe_lamb_b_spring', 65);
  assert.equal(a.height, 41); assert.equal(b.height, 48); assert.equal(a.scale, b.scale);
  for (const measured of [a, b]) assert.ok(measured.height * measured.scale >= 0.35 * adultHeight && measured.height * measured.scale <= 0.50 * adultHeight, `back column ${measured.height * measured.scale}`);
});
