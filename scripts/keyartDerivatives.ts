/**
 * Keyart web derivatives (judgement 2026-09-26): the Wave 8 keyart PNGs (1920 × 1080, 3–4.7 MB each) stay in
 * assets-inbox only; the game loads web derivatives made at build time — the opaque screens as baseline JPEG
 * (about 300 KB), the emblem (the one with transparency) as a half-size PNG. The Vite plugin below serves them in
 * `vite` dev and emits them into the build; nothing generated is committed.
 * Dependency-free on purpose: PNG decoding is node:zlib, the JPEG and PNG encoders are here (no native package for
 * a clean clone to build). Output is deterministic (same source bytes → same derivative bytes).
 * Cache (AGENTS rule 10, node_modules/.cache/keyart-derivatives): key = source SHA-256 + encoder version + settings;
 * reason: `vite` would decode and encode the six images again on every start; measured locally 0.11–0.25 s each
 * (1.1 s for the set), a cache hit is a file read. Sizes at quality 70: 167–361 KB (the PNGs 2.3–4.8 MB).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync, inflateSync } from "node:zlib";
import { WAVE16_IMAGES } from "../src/ui/wave16ArtManifest.generated";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const ENCODER_VERSION = 1;
const CANDIDATES = "assets-inbox/wave8/candidates-20260925/assets/keyart";
const PLAGUE = "assets-inbox/wave8/plague-fix-20260926/assets";

export type KeyartDerivative = Readonly<{
  id: string;
  /** The received PNG, repository-relative (Git LFS). */
  source: string;
  /** Where the game loads it (relative to the site base), and how it is made. */
  url: string;
  format: "jpeg" | "png-half";
}>;

export const JPEG_QUALITY = 70;

export const KEYART_DERIVATIVES: readonly KeyartDerivative[] = [
  { id: "keyart_title_bg", source: `${CANDIDATES}/keyart_title_bg.png`, url: "assets/wave8/keyart/keyart_title_bg.jpg", format: "jpeg" },
  { id: "keyart_mode_select", source: `${CANDIDATES}/keyart_mode_select.png`, url: "assets/wave8/keyart/keyart_mode_select.jpg", format: "jpeg" },
  { id: "keyart_title_emblem", source: `${CANDIDATES}/keyart_title_emblem.png`, url: "assets/wave8/keyart/keyart_title_emblem.png", format: "png-half" },
  { id: "loading_1315_famine", source: `${CANDIDATES}/loading_1315_famine.png`, url: "assets/wave8/keyart/loading_1315_famine.jpg", format: "jpeg" },
  { id: "loading_1337_war", source: `${CANDIDATES}/loading_1337_war.png`, url: "assets/wave8/keyart/loading_1337_war.jpg", format: "jpeg" },
  { id: "loading_1348_plague", source: `${PLAGUE}/loading_1348_plague.png`, url: "assets/wave8/keyart/loading_1348_plague.jpg", format: "jpeg" },
];

/** UI-4: the Wave 16 illustrations (event cards, famine decision, chronicle, chapter screens) — all opaque, as JPEG. */
export const WAVE16_DERIVATIVES: readonly KeyartDerivative[] = Object.entries(WAVE16_IMAGES)
  .map(([id, image]) => ({ id, source: image.source, url: image.url, format: "jpeg" as const }));

/** Every build-time web derivative (Wave 8 keyart and Wave 16 illustrations). */
export const WEB_ART_DERIVATIVES: readonly KeyartDerivative[] = [...KEYART_DERIVATIVES, ...WAVE16_DERIVATIVES];

export const KEYART_DERIVATIVE_BY_URL: ReadonlyMap<string, KeyartDerivative> = new Map(WEB_ART_DERIVATIVES.map(item => [item.url, item]));

// ---------------------------------------------------------------------------------------------------------------
// PNG decoding (8-bit RGB / RGBA, non-interlaced — what the Astra batches deliver).

export type Rgba = Readonly<{ width: number; height: number; data: Uint8Array }>;

export function decodePng(bytes: Uint8Array): Rgba {
  const view = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG (a Git LFS pointer? run git lfs pull)");
  let offset = 8; let width = 0; let height = 0; let colorType = 0; const idat: Buffer[] = [];
  while (offset < view.length) {
    const length = view.readUInt32BE(offset); const type = view.toString("latin1", offset + 4, offset + 8);
    const body = view.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4); colorType = body[9]!;
      if (body[8] !== 8 || (colorType !== 2 && colorType !== 6) || body[12] !== 0) throw new Error("unsupported PNG (8-bit RGB/RGBA, no interlace)");
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3; const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat)); const out = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride); const line = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!; const start = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[start + x]!; const left = x >= channels ? line[x - channels]! : 0; const up = previous[x]!;
      const upLeft = x >= channels ? previous[x - channels]! : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft; const pa = Math.abs(p - left); const pb = Math.abs(p - up); const pc = Math.abs(p - upLeft);
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      line[x] = (value + predicted) & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4; const from = x * channels;
      out[target] = line[from]!; out[target + 1] = line[from + 1]!; out[target + 2] = line[from + 2]!;
      out[target + 3] = channels === 4 ? line[from + 3]! : 255;
    }
    previous = Uint8Array.from(line);
  }
  return { width, height, data: out };
}

// ---------------------------------------------------------------------------------------------------------------
// PNG encoding (RGBA, filter None, deflate level 9) and the exact 2 × 2 downscale (premultiplied alpha).

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, body: Uint8Array): Buffer {
  const head = Buffer.alloc(8); head.writeUInt32BE(body.length, 0); head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

export function encodePng(image: Rgba): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0); header.writeUInt32BE(image.height, 4); header[8] = 8; header[9] = 6;
  const raw = Buffer.alloc((image.width * 4 + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) Buffer.from(image.data.buffer, image.data.byteOffset + y * image.width * 4, image.width * 4).copy(raw, y * (image.width * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })), pngChunk("IEND", new Uint8Array(0))]);
}

export function halfSize(image: Rgba): Rgba {
  const width = image.width >> 1; const height = image.height >> 1; const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    let r = 0; let g = 0; let b = 0; let a = 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const at = ((y * 2 + dy) * image.width + x * 2 + dx) * 4; const alpha = image.data[at + 3]!;
      r += image.data[at]! * alpha; g += image.data[at + 1]! * alpha; b += image.data[at + 2]! * alpha; a += alpha;
    }
    const target = (y * width + x) * 4;
    data[target] = a === 0 ? 0 : Math.round(r / a); data[target + 1] = a === 0 ? 0 : Math.round(g / a);
    data[target + 2] = a === 0 ? 0 : Math.round(b / a); data[target + 3] = Math.round(a / 4);
  }
  return { width, height, data };
}

// ---------------------------------------------------------------------------------------------------------------
// Baseline JPEG encoding (JFIF, YCbCr 4:2:0, the ITU T.81 Annex K tables scaled by quality as libjpeg does).

const ZIGZAG = [0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63];
const LUMA_BASE = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99];
const CHROMA_BASE = [17, 18, 24, 47, 99, 99, 99, 99, 18, 21, 26, 66, 99, 99, 99, 99, 24, 26, 56, 99, 99, 99, 99, 99, 47, 66, 99, 99, 99, 99, 99, 99,
  ...new Array<number>(32).fill(99)];
const DC_LUMA = { bits: [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0], values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
const DC_CHROMA = { bits: [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
const AC_LUMA = { bits: [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d], values: [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
  0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
  0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
  0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa] };
const AC_CHROMA = { bits: [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77], values: [
  0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91,
  0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0, 0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
  0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58,
  0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
  0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4,
  0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
  0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa] };

type HuffmanSpec = Readonly<{ bits: readonly number[]; values: readonly number[] }>;
type HuffmanCodes = Readonly<{ code: Uint16Array; length: Uint8Array }>;

function huffmanCodes(spec: HuffmanSpec): HuffmanCodes {
  const code = new Uint16Array(256); const length = new Uint8Array(256);
  let next = 0; let index = 0;
  for (let bits = 1; bits <= 16; bits += 1) {
    for (let n = 0; n < spec.bits[bits - 1]!; n += 1) { const value = spec.values[index++]!; code[value] = next; length[value] = bits; next += 1; }
    next <<= 1;
  }
  if (index !== spec.values.length) throw new Error("Huffman table: bits and values disagree");
  return { code, length };
}

function scaledTable(base: readonly number[], quality: number): number[] {
  const scale = quality < 50 ? Math.floor(5000 / quality) : 200 - quality * 2;
  return base.map(value => Math.min(255, Math.max(1, Math.floor((value * scale + 50) / 100))));
}

const COS = (() => {
  const table = new Float64Array(64);
  for (let u = 0; u < 8; u += 1) for (let x = 0; x < 8; x += 1) table[u * 8 + x] = (u === 0 ? Math.SQRT1_2 : 1) / 2 * Math.cos((2 * x + 1) * u * Math.PI / 16);
  return table;
})();

class BitWriter {
  private readonly bytes: number[] = [];
  private buffer = 0;
  private count = 0;
  write(value: number, length: number): void {
    for (let bit = length - 1; bit >= 0; bit -= 1) {
      this.buffer = (this.buffer << 1) | ((value >> bit) & 1); this.count += 1;
      if (this.count === 8) { this.bytes.push(this.buffer); if (this.buffer === 0xff) this.bytes.push(0); this.buffer = 0; this.count = 0; }
    }
  }
  finish(): number[] { if (this.count > 0) this.write((1 << (8 - this.count)) - 1, 8 - this.count); return this.bytes; }
}

function bitLength(value: number): number { let magnitude = Math.abs(value); let bits = 0; while (magnitude > 0) { bits += 1; magnitude >>= 1; } return bits; }

function encodeBlock(block: Float64Array, quant: readonly number[], previousDc: number, dc: HuffmanCodes, ac: HuffmanCodes, out: BitWriter): number {
  const rows = new Float64Array(64); const coefficients = new Int32Array(64);
  for (let y = 0; y < 8; y += 1) for (let u = 0; u < 8; u += 1) {
    let sum = 0; for (let x = 0; x < 8; x += 1) sum += COS[u * 8 + x]! * block[y * 8 + x]!; rows[y * 8 + u] = sum;
  }
  for (let v = 0; v < 8; v += 1) for (let u = 0; u < 8; u += 1) {
    let sum = 0; for (let y = 0; y < 8; y += 1) sum += COS[v * 8 + y]! * rows[y * 8 + u]!;
    coefficients[v * 8 + u] = Math.round(sum / quant[v * 8 + u]!);
  }
  const emit = (codes: HuffmanCodes, symbol: number) => out.write(codes.code[symbol]!, codes.length[symbol]!);
  const emitValue = (value: number, bits: number) => { if (bits > 0) out.write(value < 0 ? value + (1 << bits) - 1 : value, bits); };
  const dcValue = coefficients[0]!; const diff = dcValue - previousDc; const dcBits = bitLength(diff);
  emit(dc, dcBits); emitValue(diff, dcBits);
  let run = 0;
  for (let k = 1; k < 64; k += 1) {
    const value = coefficients[ZIGZAG[k]!]!;
    if (value === 0) { run += 1; continue; }
    while (run > 15) { emit(ac, 0xf0); run -= 16; }
    const bits = bitLength(value); emit(ac, (run << 4) | bits); emitValue(value, bits); run = 0;
  }
  if (run > 0) emit(ac, 0x00);
  return dcValue;
}

function segment(marker: number, body: readonly number[]): number[] {
  return [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
}

/** Opaque RGBA → baseline JPEG (alpha, if any, is composited over black). */
export function encodeJpeg(image: Rgba, quality: number): Buffer {
  const { width, height, data } = image;
  const lumaQuant = scaledTable(LUMA_BASE, quality); const chromaQuant = scaledTable(CHROMA_BASE, quality);
  const codes = { dcLuma: huffmanCodes(DC_LUMA), acLuma: huffmanCodes(AC_LUMA), dcChroma: huffmanCodes(DC_CHROMA), acChroma: huffmanCodes(AC_CHROMA) };
  const plane = (channel: 0 | 1 | 2) => {
    const out = new Float64Array(width * height);
    for (let at = 0; at < width * height; at += 1) {
      const alpha = data[at * 4 + 3]! / 255;
      const r = data[at * 4]! * alpha; const g = data[at * 4 + 1]! * alpha; const b = data[at * 4 + 2]! * alpha;
      out[at] = channel === 0 ? 0.299 * r + 0.587 * g + 0.114 * b - 128
        : channel === 1 ? -0.168736 * r - 0.331264 * g + 0.5 * b : 0.5 * r - 0.418688 * g - 0.081312 * b;
    }
    return out;
  };
  const luma = plane(0); const cb = plane(1); const cr = plane(2);
  const sample = (values: Float64Array, x: number, y: number) => values[Math.min(height - 1, y) * width + Math.min(width - 1, x)]!;
  const writer = new BitWriter(); const block = new Float64Array(64);
  let dcY = 0; let dcCb = 0; let dcCr = 0;
  for (let mcuY = 0; mcuY < height; mcuY += 16) for (let mcuX = 0; mcuX < width; mcuX += 16) {
    for (const [bx, by] of [[0, 0], [8, 0], [0, 8], [8, 8]] as const) {
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) block[y * 8 + x] = sample(luma, mcuX + bx + x, mcuY + by + y);
      dcY = encodeBlock(block, lumaQuant, dcY, codes.dcLuma, codes.acLuma, writer);
    }
    for (const [values, which] of [[cb, 0], [cr, 1]] as const) {
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
        const sx = mcuX + x * 2; const sy = mcuY + y * 2;
        block[y * 8 + x] = (sample(values, sx, sy) + sample(values, sx + 1, sy) + sample(values, sx, sy + 1) + sample(values, sx + 1, sy + 1)) / 4;
      }
      if (which === 0) dcCb = encodeBlock(block, chromaQuant, dcCb, codes.dcChroma, codes.acChroma, writer);
      else dcCr = encodeBlock(block, chromaQuant, dcCr, codes.dcChroma, codes.acChroma, writer);
    }
  }
  const huffman = (tableClass: number, spec: HuffmanSpec) => [tableClass, ...spec.bits, ...spec.values];
  const bytes = [0xff, 0xd8,
    ...segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...segment(0xdb, [0, ...ZIGZAG.map(index => lumaQuant[index]!), 1, ...ZIGZAG.map(index => chromaQuant[index]!)]),
    ...segment(0xc0, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]),
    ...segment(0xc4, [...huffman(0x00, DC_LUMA), ...huffman(0x10, AC_LUMA), ...huffman(0x01, DC_CHROMA), ...huffman(0x11, AC_CHROMA)]),
    ...segment(0xda, [3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0])];
  return Buffer.concat([Buffer.from(bytes), Buffer.from(writer.finish()), Buffer.from([0xff, 0xd9])]);
}

// ---------------------------------------------------------------------------------------------------------------
// Derivatives, cached; the Vite plugin.

export function sha256(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }

export function buildKeyartDerivative(item: KeyartDerivative, root = ROOT): Buffer {
  const source = readFileSync(path.join(root, item.source));
  const cacheDir = path.join(root, "node_modules/.cache/keyart-derivatives");
  const cached = path.join(cacheDir, `${sha256(source)}-v${ENCODER_VERSION}-${item.format}${item.format === "jpeg" ? `-q${JPEG_QUALITY}` : ""}`);
  if (existsSync(cached)) return readFileSync(cached);
  const image = decodePng(source);
  const out = item.format === "jpeg" ? encodeJpeg(image, JPEG_QUALITY) : encodePng(halfSize(image));
  try { mkdirSync(cacheDir, { recursive: true }); writeFileSync(cached, out); } catch { /* a read-only tree still builds */ }
  return out;
}

type MiddlewareNext = () => void;
type DevServer = { middlewares: { use: (handler: (request: { url?: string }, response: { setHeader: (name: string, value: string) => void; end: (body: Buffer) => void }, next: MiddlewareNext) => void) => void } };
type EmitContext = { emitFile: (file: { type: "asset"; fileName: string; source: Uint8Array }) => string };

/** Vite plugin: `vite` serves the derivatives from memory, `vite build` writes them into the output. */
export function keyartDerivativesPlugin() {
  return {
    name: "keyart-derivatives",
    configureServer(server: DevServer) {
      server.middlewares.use((request, response, next) => {
        const url = (request.url ?? "").split("?")[0] ?? "";
        const item = WEB_ART_DERIVATIVES.find(candidate => url.endsWith(`/${candidate.url}`));
        if (item === undefined) { next(); return; }
        response.setHeader("Content-Type", item.format === "jpeg" ? "image/jpeg" : "image/png");
        response.setHeader("Cache-Control", "no-cache");
        response.end(buildKeyartDerivative(item));
      });
    },
    generateBundle(this: EmitContext) {
      for (const item of WEB_ART_DERIVATIVES) this.emitFile({ type: "asset", fileName: item.url, source: buildKeyartDerivative(item) });
    },
  };
}
