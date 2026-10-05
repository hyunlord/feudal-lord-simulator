/**
 * EVENT-ART (user decision 2026-10-05): a JPEG decoder for the build-time re-encode of received JPEGs
 * (scripts/keyartDerivatives.ts, format `jpeg-reencoded`). Dependency-free like the encoders there: baseline and
 * progressive (ITU T.81 annex G: spectral selection, successive approximation), 8-bit, one or three components, any
 * sampling factors, restart intervals. The YCbCr → RGB step is JFIF's; chroma is replicated (no smoothing), so a 4:2:0
 * source encoded again at 4:2:0 averages back the chroma it had. Output is deterministic: the same bytes give the same
 * pixels (a float IDCT on a fixed table, rounded and clamped; no platform library).
 */
import type { Rgba } from "./keyartDerivatives";

/** Part of the derivative cache's key (scripts/keyartDerivatives.ts): bump it when the decoded pixels change. */
export const JPEG_DECODER_VERSION = 1;

/** The natural (row-major) index of each zigzag position. */
const NATURAL = [0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63];

const COS = (() => {
  const table = new Float64Array(64);
  for (let u = 0; u < 8; u += 1) for (let x = 0; x < 8; x += 1) table[u * 8 + x] = (u === 0 ? Math.SQRT1_2 : 1) / 2 * Math.cos((2 * x + 1) * u * Math.PI / 16);
  return table;
})();

type Huffman = { readonly maxcode: Int32Array; readonly valptr: Int32Array; readonly mincode: Int32Array; readonly values: Uint8Array };
type Component = {
  readonly id: number; readonly h: number; readonly v: number; readonly tq: number;
  blocksPerLine: number; blocksPerColumn: number; stride: number; rows: number; coefficients: Int32Array; pred: number;
};

/** F.2.2.3's tables from a DHT's 16 counts and its values. */
function huffman(counts: Uint8Array, values: Uint8Array): Huffman {
  const maxcode = new Int32Array(18).fill(-1); const valptr = new Int32Array(17); const mincode = new Int32Array(17);
  let code = 0; let index = 0;
  for (let length = 1; length <= 16; length += 1) {
    const count = counts[length - 1]!;
    if (count > 0) { valptr[length] = index; mincode[length] = code; code += count; index += count; maxcode[length] = code - 1; }
    code <<= 1;
  }
  return { maxcode, valptr, mincode, values };
}

export function decodeJpeg(bytes: Uint8Array): Rgba {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("not a JPEG");
  const quant: Int32Array[] = []; const dcTables: Huffman[] = []; const acTables: Huffman[] = [];
  let components: Component[] = []; let width = 0; let height = 0; let progressive = false; let restartInterval = 0;
  let hmax = 1; let vmax = 1; let mcusPerLine = 0; let mcusPerColumn = 0;
  let at = 2;
  const u16 = (offset: number) => (bytes[offset]! << 8) | bytes[offset + 1]!;

  // --- The entropy-coded segment's bit reader (0xFF00 is a stuffed 0xFF; a marker ends the bits: zeros after it).
  let pos = 0; let bitBuffer = 0; let bitCount = 0;
  const bit = (): number => {
    if (bitCount === 0) {
      let next = 0;
      if (pos < bytes.length) {
        next = bytes[pos]!;
        if (next === 0xff) {
          const after = bytes[pos + 1];
          if (after === 0x00) pos += 2; else next = 0;
        } else pos += 1;
      }
      bitBuffer = next; bitCount = 8;
    }
    bitCount -= 1;
    return (bitBuffer >> bitCount) & 1;
  };
  const receive = (length: number): number => { let value = 0; for (let i = 0; i < length; i += 1) value = (value << 1) | bit(); return value; };
  const extend = (value: number, length: number): number => value < 1 << (length - 1) ? value - (1 << length) + 1 : value;
  const decode = (table: Huffman): number => {
    let code = bit(); let length = 1;
    while (length <= 16 && code > table.maxcode[length]!) { code = (code << 1) | bit(); length += 1; }
    if (length > 16) throw new Error("bad Huffman code");
    return table.values[table.valptr[length]! + code - table.mincode[length]!]!;
  };

  function decodeScan(scan: readonly { component: Component; dc: number; ac: number }[], ss: number, se: number, ah: number, al: number): void {
    let eobrun = 0;
    const p1 = 1 << al; const m1 = -1 << al;
    const block = (component: Component, dc: Huffman | undefined, ac: Huffman | undefined, offset: number) => {
      const c = component.coefficients;
      if (!progressive) {
        const t = decode(dc!); const diff = t === 0 ? 0 : extend(receive(t), t);
        component.pred += diff; c[offset] = component.pred;
        for (let k = 1; k < 64;) {
          const rs = decode(ac!); const s = rs & 15; const r = rs >> 4;
          if (s === 0) { if (r !== 15) break; k += 16; continue; }
          k += r; c[offset + NATURAL[k]!] = extend(receive(s), s); k += 1;
        }
        return;
      }
      if (ss === 0) {
        if (ah === 0) { const t = decode(dc!); const diff = t === 0 ? 0 : extend(receive(t), t); component.pred += diff; c[offset] = component.pred * p1; }
        else if (bit() === 1) c[offset] = c[offset]! | p1;
        return;
      }
      if (ah === 0) {
        if (eobrun > 0) { eobrun -= 1; return; }
        for (let k = ss; k <= se; k += 1) {
          const rs = decode(ac!); const s = rs & 15; const r = rs >> 4;
          if (s !== 0) { k += r; c[offset + NATURAL[k]!] = extend(receive(s), s) * p1; continue; }
          if (r === 15) { k += 15; continue; }
          eobrun = (1 << r) - 1 + (r > 0 ? receive(r) : 0);
          break;
        }
        return;
      }
      // AC refinement (G.1.2.3; libjpeg's decode_mcu_AC_refine).
      const refine = (index: number) => { if (bit() === 1 && (c[index]! & p1) === 0) c[index] = c[index]! + (c[index]! >= 0 ? p1 : m1); };
      let k = ss;
      if (eobrun === 0) {
        for (; k <= se; k += 1) {
          const rs = decode(ac!); let s = rs & 15; let r = rs >> 4;
          if (s !== 0) s = bit() === 1 ? p1 : m1;
          else if (r !== 15) { eobrun = (1 << r) + (r > 0 ? receive(r) : 0); break; }
          while (k <= se) {
            const index = offset + NATURAL[k]!;
            if (c[index] !== 0) refine(index);
            else { if (r === 0) break; r -= 1; }
            k += 1;
          }
          if (s !== 0 && k <= se) c[offset + NATURAL[k]!] = s;
        }
      }
      if (eobrun > 0) {
        for (; k <= se; k += 1) { const index = offset + NATURAL[k]!; if (c[index] !== 0) refine(index); }
        eobrun -= 1;
      }
    };
    const tables = scan.map(entry => ({ component: entry.component, dc: dcTables[entry.dc], ac: acTables[entry.ac] }));
    const restart = () => {
      bitCount = 0;
      while (pos + 1 < bytes.length && !(bytes[pos] === 0xff && bytes[pos + 1]! >= 0xd0 && bytes[pos + 1]! <= 0xd7)) pos += 1;
      pos += 2; eobrun = 0;
      for (const component of components) component.pred = 0;
    };
    if (tables.length === 1) {
      // A non-interleaved scan: the component's own blocks, one per MCU.
      const { component, dc, ac } = tables[0]!;
      let count = 0;
      for (let row = 0; row < component.blocksPerColumn; row += 1) for (let col = 0; col < component.blocksPerLine; col += 1) {
        if (restartInterval > 0 && count > 0 && count % restartInterval === 0) restart();
        block(component, dc, ac, (row * component.stride + col) * 64); count += 1;
      }
      return;
    }
    let count = 0;
    for (let mcuRow = 0; mcuRow < mcusPerColumn; mcuRow += 1) for (let mcuCol = 0; mcuCol < mcusPerLine; mcuCol += 1) {
      if (restartInterval > 0 && count > 0 && count % restartInterval === 0) restart();
      for (const { component, dc, ac } of tables) {
        for (let y = 0; y < component.v; y += 1) for (let x = 0; x < component.h; x += 1) {
          block(component, dc, ac, ((mcuRow * component.v + y) * component.stride + mcuCol * component.h + x) * 64);
        }
      }
      count += 1;
    }
  }

  for (;;) {
    while (at < bytes.length && bytes[at] === 0xff && bytes[at + 1] === 0xff) at += 1;
    if (at + 1 >= bytes.length || bytes[at] !== 0xff) throw new Error(`no marker at ${at}`);
    const marker = bytes[at + 1]!;
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
    const length = u16(at + 2); const body = at + 4; const end = at + 2 + length;
    if (marker === 0xdb) {
      for (let p = body; p < end;) {
        const precision = bytes[p]! >> 4; const id = bytes[p]! & 15; p += 1;
        const table = new Int32Array(64);
        for (let k = 0; k < 64; k += 1) { table[NATURAL[k]!] = precision === 0 ? bytes[p]! : u16(p); p += precision === 0 ? 1 : 2; }
        quant[id] = table;
      }
    } else if (marker === 0xc4) {
      for (let p = body; p < end;) {
        const kind = bytes[p]! >> 4; const id = bytes[p]! & 15;
        const counts = bytes.subarray(p + 1, p + 17); const total = counts.reduce((sum, count) => sum + count, 0);
        const table = huffman(counts, bytes.subarray(p + 17, p + 17 + total));
        if (kind === 0) dcTables[id] = table; else acTables[id] = table;
        p += 17 + total;
      }
    } else if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      progressive = marker === 0xc2;
      if (bytes[body] !== 8) throw new Error("only 8-bit JPEGs");
      height = u16(body + 1); width = u16(body + 3);
      const count = bytes[body + 5]!;
      components = [];
      for (let i = 0; i < count; i += 1) {
        const p = body + 6 + i * 3;
        components.push({ id: bytes[p]!, h: bytes[p + 1]! >> 4, v: bytes[p + 1]! & 15, tq: bytes[p + 2]!, blocksPerLine: 0, blocksPerColumn: 0, stride: 0, rows: 0,
          coefficients: new Int32Array(0), pred: 0 });
      }
      hmax = Math.max(...components.map(component => component.h)); vmax = Math.max(...components.map(component => component.v));
      mcusPerLine = Math.ceil(width / (8 * hmax)); mcusPerColumn = Math.ceil(height / (8 * vmax));
      for (const component of components) {
        component.blocksPerLine = Math.ceil(Math.ceil(width * component.h / hmax) / 8);
        component.blocksPerColumn = Math.ceil(Math.ceil(height * component.v / vmax) / 8);
        component.stride = mcusPerLine * component.h; component.rows = mcusPerColumn * component.v;
        component.coefficients = new Int32Array(component.stride * component.rows * 64);
      }
    } else if (marker >= 0xc3 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      throw new Error(`unsupported JPEG process (SOF ${marker.toString(16)})`);
    } else if (marker === 0xdd) {
      restartInterval = u16(body);
    } else if (marker === 0xda) {
      const count = bytes[body]!;
      const scan = Array.from({ length: count }, (_, i) => {
        const id = bytes[body + 1 + i * 2]!; const tables = bytes[body + 2 + i * 2]!;
        const component = components.find(candidate => candidate.id === id);
        if (component === undefined) throw new Error(`scan names component ${id}`);
        return { component, dc: tables >> 4, ac: tables & 15 };
      });
      const p = body + 1 + count * 2;
      for (const component of components) component.pred = 0;
      pos = end; bitCount = 0;
      decodeScan(scan, bytes[p]!, bytes[p + 1]!, bytes[p + 2]! >> 4, bytes[p + 2]! & 15);
      // The next marker after the entropy-coded data (0xFF00 is data, RSTn inside the scan were read by it).
      at = pos;
      while (at + 1 < bytes.length && !(bytes[at] === 0xff && bytes[at + 1] !== 0x00 && !(bytes[at + 1]! >= 0xd0 && bytes[at + 1]! <= 0xd7))) at += 1;
      continue;
    }
    at = end;
  }
  if (components.length !== 1 && components.length !== 3) throw new Error(`${components.length} components`);

  // Dequantize and inverse-DCT each block into its component's plane.
  const planes = components.map(component => {
    const planeWidth = component.stride * 8; const plane = new Uint8ClampedArray(planeWidth * component.rows * 8);
    const q = quant[component.tq]!; const rows = new Float64Array(64);
    for (let row = 0; row < component.rows; row += 1) for (let col = 0; col < component.stride; col += 1) {
      const offset = (row * component.stride + col) * 64; const c = component.coefficients;
      for (let v = 0; v < 8; v += 1) for (let x = 0; x < 8; x += 1) {
        let sum = 0; for (let u = 0; u < 8; u += 1) sum += COS[u * 8 + x]! * c[offset + v * 8 + u]! * q[v * 8 + u]!; rows[v * 8 + x] = sum;
      }
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) {
        let sum = 0; for (let v = 0; v < 8; v += 1) sum += COS[v * 8 + y]! * rows[v * 8 + x]!;
        plane[(row * 8 + y) * planeWidth + col * 8 + x] = Math.round(sum + 128);
      }
    }
    return { plane, planeWidth, h: component.h, v: component.v };
  });
  const data = new Uint8Array(width * height * 4);
  const sample = (index: number, x: number, y: number) => {
    const { plane, planeWidth, h, v } = planes[index]!;
    return plane[Math.floor(y * v / vmax) * planeWidth + Math.floor(x * h / hmax)]!;
  };
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const at4 = (y * width + x) * 4; const luma = sample(0, x, y);
    if (planes.length === 1) { data[at4] = luma; data[at4 + 1] = luma; data[at4 + 2] = luma; }
    else {
      const cb = sample(1, x, y) - 128; const cr = sample(2, x, y) - 128;
      data[at4] = clamp(luma + 1.402 * cr); data[at4 + 1] = clamp(luma - 0.344136 * cb - 0.714136 * cr); data[at4 + 2] = clamp(luma + 1.772 * cb);
    }
    data[at4 + 3] = 255;
  }
  return { width, height, data };
}
