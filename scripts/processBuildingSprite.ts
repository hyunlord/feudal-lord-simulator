import { spawnSync } from "node:child_process";
import { deflateSync, inflateSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import * as paletteModule from "../src/content/palette";
import { rgbToLab, type Lab, type Rgb } from "./quantisePalette";

export type Dimensions = {
  readonly width: number;
  readonly height: number;
};

export type Bounds = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

export type RgbaImage = {
  readonly dimensions: Dimensions;
  readonly rgba: Uint8Array;
};

export type ChromaOptions = {
  readonly key: Rgb;
  readonly threshold: number;
  readonly softEdge: number;
  readonly despillStrength: number;
};

export type ProcessOptions = {
  readonly target: Dimensions;
  readonly baselineY: number;
  readonly chromaKey: Rgb;
  readonly threshold: number;
  readonly softEdge: number;
  readonly outline: boolean;
  readonly contentWidth?: number;
  readonly contentHeight?: number;
};

type Placement = Dimensions & {
  readonly left: number;
  readonly top: number;
};

type PaletteSource = {
  readonly PALETTE: Readonly<Record<string, string>>;
  readonly RAMPS?: Readonly<Record<string, readonly string[]>>;
};

type CanonicalColor = Rgb & {
  readonly lab: Lab;
  readonly key: string;
};

// allow: SIZE_OK - offline sprite pipeline keeps PNG, RGBA, ffmpeg, and CLI contracts together.
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? "ffmpeg";
const DEFAULT_DESPILL_STRENGTH = 0.75;
export const DEFAULT_CHROMA_KEY = { r: 0, g: 255, b: 255 } as const satisfies Rgb;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_COLOUR_TYPE_RGB = 2;
const PNG_COLOUR_TYPE_RGBA = 6;
const PNG_BIT_DEPTH_8 = 8;
const EXPECTED_SPRITES = {
  house: { width: 96, height: 112, baselineY: 96 },
  mill: { width: 96, height: 160, baselineY: 144 },
  granary: { width: 160, height: 144, baselineY: 128 },
} as const;
export type BuildingSubject = keyof typeof EXPECTED_SPRITES;
const VISIBLE_WIDTH_BANDS: Readonly<Record<BuildingSubject, readonly [number, number]>> = {
  house: [64, 90],
  mill: [64, 90],
  granary: [115, 141],
};
export const OUTLINE_ALPHA = 179;

const paletteSource: PaletteSource = paletteModule;

const crcTable = (): readonly number[] => {
  const table: number[] = [];
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table.push(value >>> 0);
  }
  return table;
};

const CRC_TABLE = crcTable();

const crc32 = (bytes: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    const tableIndex = (crc ^ byte) & 0xff;
    const tableValue = CRC_TABLE[tableIndex];
    if (tableValue === undefined) {
      throw new Error(`CRC table missing index ${tableIndex}`);
    }
    crc = tableValue ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type: string, data = Buffer.alloc(0)): Buffer => {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
};

export const hexToRgb = (hex: string): Rgb => {
  const parsed = Number.parseInt(hex.slice(1), 16);
  return { r: (parsed >> 16) & 255, g: (parsed >> 8) & 255, b: parsed & 255 };
};

export const rgbKey = (rgb: Rgb): string => `${rgb.r},${rgb.g},${rgb.b}`;

export const canonicalColors = (): readonly CanonicalColor[] => {
  const rampColours = Object.values(paletteSource.RAMPS ?? {}).flat();
  const paletteColours = Object.values(paletteSource.PALETTE);
  const unique = new Map<string, CanonicalColor>();
  for (const hex of [...rampColours, ...paletteColours]) {
    const rgb = hexToRgb(hex);
    unique.set(rgbKey(rgb), { ...rgb, lab: rgbToLab(rgb), key: rgbKey(rgb) });
  }
  return [...unique.values()];
};

const assertWholeImage = (image: RgbaImage): void => {
  const expected = image.dimensions.width * image.dimensions.height * 4;
  if (image.rgba.length !== expected) {
    throw new Error(`RGBA length ${image.rgba.length} did not match ${expected}`);
  }
};

export const byteIndex = (dimensions: Dimensions, x: number, y: number): number =>
  (y * dimensions.width + x) * 4;

const colourDistance = (left: Rgb, right: Rgb): number =>
  Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const despillChannel = (
  channel: number,
  keyChannel: number,
  neutralReference: number,
  strength: number,
): number => {
  if (keyChannel < 200 || channel <= neutralReference) {
    return channel;
  }
  return clampByte(channel - (channel - neutralReference) * strength);
};

const despillReference = (rgb: Rgb, key: Rgb, channel: keyof Rgb): number => {
  const entries = [
    { name: "r", value: rgb.r, keyValue: key.r },
    { name: "g", value: rgb.g, keyValue: key.g },
    { name: "b", value: rgb.b, keyValue: key.b },
  ] as const;
  const neutral = entries.filter((entry) => entry.name !== channel && entry.keyValue < 200);
  const values = neutral.length > 0
    ? neutral.map((entry) => entry.value)
    : entries.filter((entry) => entry.name !== channel).map((entry) => entry.value);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const removeChromaKey = (image: RgbaImage, options: ChromaOptions): RgbaImage => {
  assertWholeImage(image);
  const output = new Uint8Array(image.rgba);
  const fadeRange = Math.max(1, options.softEdge - options.threshold);
  for (let index = 0; index < output.length; index += 4) {
    const r = output[index];
    const g = output[index + 1];
    const b = output[index + 2];
    const a = output[index + 3];
    if (r === undefined || g === undefined || b === undefined || a === undefined) {
      throw new Error(`Incomplete RGBA pixel at byte ${index}`);
    }
    const distance = colourDistance({ r, g, b }, options.key);
    if (distance <= options.threshold) {
      output[index] = 0;
      output[index + 1] = 0;
      output[index + 2] = 0;
      output[index + 3] = 0;
      continue;
    }
    if (distance < options.softEdge) {
      output[index + 3] = clampByte(a * ((distance - options.threshold) / fadeRange));
    }
    const rgb = { r, g, b };
    const redReference = despillReference(rgb, options.key, "r");
    const greenReference = despillReference(rgb, options.key, "g");
    const blueReference = despillReference(rgb, options.key, "b");
    output[index] = despillChannel(r, options.key.r, redReference, options.despillStrength);
    output[index + 1] = despillChannel(g, options.key.g, greenReference, options.despillStrength);
    output[index + 2] = despillChannel(b, options.key.b, blueReference, options.despillStrength);
  }
  return { dimensions: image.dimensions, rgba: output };
};

export const findOpaqueBounds = (image: RgbaImage): Bounds | null => {
  assertWholeImage(image);
  let left = image.dimensions.width;
  let top = image.dimensions.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < image.dimensions.height; y += 1) {
    for (let x = 0; x < image.dimensions.width; x += 1) {
      const alpha = image.rgba[byteIndex(image.dimensions, x, y) + 3];
      if (alpha !== undefined && alpha > 0) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = Math.max(bottom, y + 1);
      }
    }
  }
  return right < left || bottom < top ? null : { left, top, right, bottom };
};

export const fitOpaqueBounds = (bounds: Bounds | null, target: Dimensions, baselineY: number): Placement => {
  if (bounds === null) {
    return { width: 0, height: 0, left: Math.floor(target.width / 2), top: baselineY };
  }
  const sourceWidth = bounds.right - bounds.left;
  const sourceHeight = bounds.bottom - bounds.top;
  const maxHeight = Math.max(1, baselineY);
  const scale = Math.min(target.width / sourceWidth, maxHeight / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  return {
    width,
    height,
    left: Math.floor((target.width - width) / 2),
    top: baselineY - height,
  };
};

const fitOpaqueBoundsToWidth = (
  bounds: Bounds,
  target: Dimensions,
  baselineY: number,
  contentWidth: number | undefined,
  contentHeight: number | undefined,
): Placement => {
  if (contentWidth === undefined) return fitOpaqueBounds(bounds, target, baselineY);
  const sourceWidth = bounds.right - bounds.left;
  const sourceHeight = bounds.bottom - bounds.top;
  const scale = Math.min(contentWidth / sourceWidth, (contentHeight ?? baselineY) / sourceHeight, baselineY / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  return { width, height, left: Math.floor((target.width - width) / 2), top: baselineY - height };
};

const crop = (image: RgbaImage, bounds: Bounds): RgbaImage => {
  const dimensions = { width: bounds.right - bounds.left, height: bounds.bottom - bounds.top };
  const rgba = new Uint8Array(dimensions.width * dimensions.height * 4);
  for (let y = 0; y < dimensions.height; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      const from = byteIndex(image.dimensions, bounds.left + x, bounds.top + y);
      rgba.set(image.rgba.subarray(from, from + 4), byteIndex(dimensions, x, y));
    }
  }
  return { dimensions, rgba };
};

const resizeNearest = (image: RgbaImage, target: Dimensions): RgbaImage => {
  const rgba = new Uint8Array(target.width * target.height * 4);
  for (let y = 0; y < target.height; y += 1) {
    for (let x = 0; x < target.width; x += 1) {
      const sourceX = Math.min(image.dimensions.width - 1, Math.floor((x * image.dimensions.width) / target.width));
      const sourceY = Math.min(image.dimensions.height - 1, Math.floor((y * image.dimensions.height) / target.height));
      rgba.set(image.rgba.subarray(byteIndex(image.dimensions, sourceX, sourceY), byteIndex(image.dimensions, sourceX, sourceY) + 4), byteIndex(target, x, y));
    }
  }
  return { dimensions: target, rgba };
};

const paste = (source: RgbaImage, target: RgbaImage, placement: Placement): void => {
  for (let y = 0; y < source.dimensions.height; y += 1) {
    for (let x = 0; x < source.dimensions.width; x += 1) {
      const toX = placement.left + x;
      const toY = placement.top + y;
      if (toX >= 0 && toX < target.dimensions.width && toY >= 0 && toY < target.dimensions.height) {
        target.rgba.set(source.rgba.subarray(byteIndex(source.dimensions, x, y), byteIndex(source.dimensions, x, y) + 4), byteIndex(target.dimensions, toX, toY));
      }
    }
  }
};

const nearestCanonical = (rgb: Rgb, colours = canonicalColors()): Rgb => {
  let best = colours[0];
  if (best === undefined) {
    throw new Error("canonical palette is empty");
  }
  const lab = rgbToLab(rgb);
  for (const colour of colours.slice(1)) {
    const bestDistance = Math.hypot(lab.l - best.lab.l, lab.a - best.lab.a, lab.b - best.lab.b);
    const candidateDistance = Math.hypot(lab.l - colour.lab.l, lab.a - colour.lab.a, lab.b - colour.lab.b);
    if (candidateDistance < bestDistance) {
      best = colour;
    }
  }
  return best;
};

export const quantiseVisiblePixels = (image: RgbaImage): RgbaImage => {
  const output = new Uint8Array(image.rgba);
  const colours = canonicalColors();
  for (let index = 0; index < output.length; index += 4) {
    const alpha = output[index + 3];
    if (alpha !== undefined && alpha > 0) {
      if (alpha < 128) {
        output[index] = 0;
        output[index + 1] = 0;
        output[index + 2] = 0;
        output[index + 3] = 0;
        continue;
      }
      const r = output[index];
      const g = output[index + 1];
      const b = output[index + 2];
      if (r === undefined || g === undefined || b === undefined) {
        throw new Error(`Incomplete RGB pixel at byte ${index}`);
      }
      const nearest = nearestCanonical({ r, g, b }, colours);
      output[index] = nearest.r;
      output[index + 1] = nearest.g;
      output[index + 2] = nearest.b;
      output[index + 3] = 255;
    }
  }
  return { dimensions: image.dimensions, rgba: output };
};

export const addSilhouetteOutline = (image: RgbaImage): RgbaImage => {
  const output = new Uint8Array(image.rgba);
  const ink = hexToRgb(paletteSource.PALETTE.ink ?? "#3A2E1F");
  const bounds = findOpaqueBounds(image);
  if (bounds === null) return { dimensions: image.dimensions, rgba: output };
  const lowerThird = bounds.top + Math.floor((bounds.bottom - bounds.top) * 2 / 3);
  const exterior = new Uint8Array(image.dimensions.width * image.dimensions.height);
  const queue: Array<readonly [number, number]> = [];
  const enqueue = (x: number, y: number): void => {
    const pixelIndex = y * image.dimensions.width + x;
    if (exterior[pixelIndex] === 1 || image.rgba[byteIndex(image.dimensions, x, y) + 3] !== 0) return;
    exterior[pixelIndex] = 1;
    queue.push([x, y]);
  };
  for (let x = 0; x < image.dimensions.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, image.dimensions.height - 1);
  }
  for (let y = 0; y < image.dimensions.height; y += 1) {
    enqueue(0, y);
    enqueue(image.dimensions.width - 1, y);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    if (point === undefined) continue;
    const [x, y] = point;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < image.dimensions.width && ny >= 0 && ny < image.dimensions.height) enqueue(nx, ny);
    }
  }
  for (let y = 0; y < image.dimensions.height; y += 1) {
    for (let x = 0; x < image.dimensions.width; x += 1) {
      const index = byteIndex(image.dimensions, x, y);
      if (image.rgba[index + 3] !== 0 || y >= lowerThird || exterior[y * image.dimensions.width + x] !== 1) {
        continue;
      }
      const neighbours = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;
      if (neighbours.some(([dx, dy]) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && nx < image.dimensions.width && ny >= 0 && ny < image.dimensions.height
          && image.rgba[byteIndex(image.dimensions, nx, ny) + 3] !== 0;
      })) {
        output[index] = ink.r;
        output[index + 1] = ink.g;
        output[index + 2] = ink.b;
        output[index + 3] = OUTLINE_ALPHA;
      }
    }
  }
  return { dimensions: image.dimensions, rgba: output };
};

export type RampProfile = Readonly<Record<string, { readonly count: number; readonly proportion: number }>>;

export const rampProfile = (image: RgbaImage): RampProfile => {
  const rampByColour = new Map<string, string>();
  for (const [ramp, colours] of Object.entries(paletteSource.RAMPS ?? {})) {
    for (const hex of colours) rampByColour.set(rgbKey(hexToRgb(hex)), ramp);
  }
  const counts = new Map<string, number>();
  let visible = 0;
  for (let index = 0; index < image.rgba.length; index += 4) {
    const alpha = image.rgba[index + 3];
    if (alpha === undefined || alpha === 0) continue;
    visible += 1;
    const key = `${image.rgba[index]},${image.rgba[index + 1]},${image.rgba[index + 2]}`;
    const ramp = rampByColour.get(key);
    if (ramp !== undefined) counts.set(ramp, (counts.get(ramp) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].map(([ramp, count]) => [ramp, { count, proportion: count / visible }]));
};

export const enforceFamilyMaterials = (image: RgbaImage, _subject: BuildingSubject): RgbaImage => {
  const bounds = findOpaqueBounds(image);
  if (bounds === null || paletteSource.RAMPS === undefined) return image;
  const output = new Uint8Array(image.rgba);
  const sourceLookup = new Map<string, { ramp: string; index: number }>();
  for (const [ramp, colours] of Object.entries(paletteSource.RAMPS)) {
    colours.forEach((hex, index) => sourceLookup.set(rgbKey(hexToRgb(hex)), { ramp, index }));
  }
  const roofCutoff = bounds.top + Math.floor((bounds.bottom - bounds.top) * 0.55);
  const footingStart = bounds.top + Math.floor((bounds.bottom - bounds.top) * 0.88);
  const quietTimber = hexToRgb(paletteSource.RAMPS.timber?.[2] ?? "#765638");
  const accentKeys = new Set([paletteSource.PALETTE.vermilion, paletteSource.PALETTE.ultramarine]
    .filter((hex): hex is string => hex !== undefined)
    .map((hex) => rgbKey(hexToRgb(hex))));
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const index = byteIndex(image.dimensions, x, y);
      if (output[index + 3] !== 255) continue;
      const colourKey = `${output[index]},${output[index + 1]},${output[index + 2]}`;
      if (accentKeys.has(colourKey)) {
        output[index] = quietTimber.r;
        output[index + 1] = quietTimber.g;
        output[index + 2] = quietTimber.b;
        continue;
      }
      const source = sourceLookup.get(colourKey);
      if (source === undefined || (source.ramp !== "stone" && source.ramp !== "slate")) continue;
      const targetName = y <= roofCutoff ? "thatch" : y < footingStart ? "plaster" : undefined;
      if (targetName === undefined) continue;
      const targetHex = paletteSource.RAMPS[targetName]?.[source.index];
      if (targetHex === undefined) continue;
      const target = hexToRgb(targetHex);
      output[index] = target.r;
      output[index + 1] = target.g;
      output[index + 2] = target.b;
    }
  }
  return { dimensions: image.dimensions, rgba: output };
};

export const assertVisibleWidthBand = (image: RgbaImage, subject: BuildingSubject): number => {
  const bounds = findOpaqueBounds(image);
  if (bounds === null) throw new Error(`${subject} has no visible mass`);
  const width = bounds.right - bounds.left;
  const [minimum, maximum] = VISIBLE_WIDTH_BANDS[subject];
  if (width < minimum || width > maximum) {
    throw new Error(`${subject} visible width ${width}px is outside scale band ${minimum}..${maximum}px`);
  }
  return width;
};

export const assertMillHeight = (image: RgbaImage): number => {
  const bounds = findOpaqueBounds(image);
  if (bounds === null) throw new Error("mill has no visible mass");
  const height = bounds.bottom - bounds.top;
  if (height > 71) throw new Error(`mill visible height ${height}px exceeds 2.2-tile cap 71px`);
  return height;
};

export const clearRowsBelowBaseline = (image: RgbaImage, baselineY: number): void => {
  for (let y = baselineY + 1; y < image.dimensions.height; y += 1) {
    for (let x = 0; x < image.dimensions.width; x += 1) {
      image.rgba[byteIndex(image.dimensions, x, y) + 3] = 0;
    }
  }
};

export const processSpriteRgba = (source: RgbaImage, options: ProcessOptions): RgbaImage => {
  const cleaned = removeChromaKey(source, {
    key: options.chromaKey,
    threshold: options.threshold,
    softEdge: options.softEdge,
    despillStrength: DEFAULT_DESPILL_STRENGTH,
  });
  const bounds = findOpaqueBounds(cleaned);
  const canvas: RgbaImage = { dimensions: options.target, rgba: new Uint8Array(options.target.width * options.target.height * 4) };
  if (bounds !== null) {
    const placement = fitOpaqueBoundsToWidth(bounds, options.target, options.baselineY, options.contentWidth, options.contentHeight);
    paste(resizeNearest(crop(cleaned, bounds), placement), canvas, placement);
  }
  clearRowsBelowBaseline(canvas, options.baselineY);
  const quantised = quantiseVisiblePixels(canvas);
  const outlined = options.outline ? addSilhouetteOutline(quantised) : quantised;
  clearRowsBelowBaseline(outlined, options.baselineY);
  return outlined;
};

export const processSpriteImage = (
  source: RgbaImage,
  options: ProcessOptions,
  resize: (image: RgbaImage, target: Dimensions) => RgbaImage = resizeRgbaLanczos,
): RgbaImage => {
  const cleaned = removeChromaKey(source, {
    key: options.chromaKey,
    threshold: options.threshold,
    softEdge: options.softEdge,
    despillStrength: DEFAULT_DESPILL_STRENGTH,
  });
  const bounds = findOpaqueBounds(cleaned);
  const canvas: RgbaImage = { dimensions: options.target, rgba: new Uint8Array(options.target.width * options.target.height * 4) };
  if (bounds !== null) {
    const placement = fitOpaqueBoundsToWidth(bounds, options.target, options.baselineY, options.contentWidth, options.contentHeight);
    paste(resize(crop(cleaned, bounds), placement), canvas, placement);
  }
  clearRowsBelowBaseline(canvas, options.baselineY);
  const quantised = quantiseVisiblePixels(canvas);
  const outlined = options.outline ? addSilhouetteOutline(quantised) : quantised;
  clearRowsBelowBaseline(outlined, options.baselineY);
  return outlined;
};

const runFfmpeg = (args: readonly string[], input?: Uint8Array): Buffer => {
  const result = spawnSync(FFMPEG_PATH, args, { input, maxBuffer: 1024 * 1024 * 512 });
  if (result.error !== undefined) {
    throw new Error(`ffmpeg failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`ffmpeg exited ${result.status}: ${result.stderr.toString("utf8").trim()}`);
  }
  return result.stdout;
};

export const resizeRgbaLanczos = (image: RgbaImage, target: Dimensions): RgbaImage => {
  const raw = runFfmpeg([
    "-v", "error",
    "-f", "rawvideo",
    "-pix_fmt", "rgba",
    "-s", `${image.dimensions.width}x${image.dimensions.height}`,
    "-i", "pipe:0",
    "-vf", `scale=${target.width}:${target.height}:flags=lanczos`,
    "-f", "rawvideo",
    "-pix_fmt", "rgba",
    "pipe:1",
  ], image.rgba);
  const expected = target.width * target.height * 4;
  if (raw.length !== expected) {
    throw new Error(`Lanczos resize returned ${raw.length} bytes, expected ${expected}`);
  }
  return { dimensions: target, rgba: new Uint8Array(raw) };
};

const paeth = (left: number, above: number, upperLeft: number): number => {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
};

const unfilterScanlines = (raw: Buffer, dimensions: Dimensions, channels: 3 | 4): Uint8Array => {
  const rowBytes = dimensions.width * channels;
  const output = new Uint8Array(rowBytes * dimensions.height);
  let sourceOffset = 0;
  for (let y = 0; y < dimensions.height; y += 1) {
    const filter = raw[sourceOffset];
    sourceOffset += 1;
    if (filter === undefined || filter > 4) {
      throw new Error(`Unsupported PNG filter ${String(filter)} on row ${y}`);
    }
    for (let x = 0; x < rowBytes; x += 1) {
      const rawByte = raw[sourceOffset + x];
      if (rawByte === undefined) {
        throw new Error(`PNG row ${y} ended early`);
      }
      const outputIndex = y * rowBytes + x;
      const left = x >= channels ? output[outputIndex - channels] : 0;
      const above = y > 0 ? output[outputIndex - rowBytes] : 0;
      const upperLeft = x >= channels && y > 0 ? output[outputIndex - rowBytes - channels] : 0;
      if (left === undefined || above === undefined || upperLeft === undefined) {
        throw new Error(`PNG filter context missing at ${x},${y}`);
      }
      switch (filter) {
        case 0:
          output[outputIndex] = rawByte;
          break;
        case 1:
          output[outputIndex] = (rawByte + left) & 0xff;
          break;
        case 2:
          output[outputIndex] = (rawByte + above) & 0xff;
          break;
        case 3:
          output[outputIndex] = (rawByte + Math.floor((left + above) / 2)) & 0xff;
          break;
        case 4:
          output[outputIndex] = (rawByte + paeth(left, above, upperLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter ${filter}`);
      }
    }
    sourceOffset += rowBytes;
  }
  return output;
};

export const expandRgbToRgba = (rgb: Uint8Array, dimensions: Dimensions): Uint8Array => {
  const expected = dimensions.width * dimensions.height * 3;
  if (rgb.length !== expected) {
    throw new Error(`RGB length ${rgb.length} did not match ${expected}`);
  }
  const rgba = new Uint8Array(dimensions.width * dimensions.height * 4);
  for (let source = 0, target = 0; source < rgb.length; source += 3, target += 4) {
    rgba[target] = rgb[source] ?? 0;
    rgba[target + 1] = rgb[source + 1] ?? 0;
    rgba[target + 2] = rgb[source + 2] ?? 0;
    rgba[target + 3] = 255;
  }
  return rgba;
};

export const readPng = (inputPath: string): RgbaImage => {
  const bytes = readFileSync(inputPath);
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${inputPath} is not a PNG file`);
  }
  let offset = PNG_SIGNATURE.length;
  let dimensions: Dimensions | null = null;
  let colourType: 2 | 6 | null = null;
  const idatChunks: Buffer[] = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      const bitDepth = data[8];
      const parsedColourType = data[9];
      const interlace = data[12];
      if (
        bitDepth !== PNG_BIT_DEPTH_8
        || (parsedColourType !== PNG_COLOUR_TYPE_RGB && parsedColourType !== PNG_COLOUR_TYPE_RGBA)
        || interlace !== 0
      ) {
        throw new Error(`${inputPath} must be a non-interlaced 8-bit RGB or RGBA PNG`);
      }
      colourType = parsedColourType;
      dimensions = { width: data.readUInt32BE(0), height: data.readUInt32BE(4) };
    }
    if (type === "IDAT") {
      idatChunks.push(data);
    }
    if (type === "IEND") {
      break;
    }
  }
  if (dimensions === null || colourType === null) {
    throw new Error(`${inputPath} is missing IHDR`);
  }
  const channels = colourType === PNG_COLOUR_TYPE_RGB ? 3 : 4;
  const decoded = unfilterScanlines(inflateSync(Buffer.concat(idatChunks)), dimensions, channels);
  return {
    dimensions,
    rgba: colourType === PNG_COLOUR_TYPE_RGB ? expandRgbToRgba(decoded, dimensions) : decoded,
  };
};

export const writePng = (outputPath: string, image: RgbaImage): void => {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.dimensions.width, 0);
  ihdr.writeUInt32BE(image.dimensions.height, 4);
  ihdr[8] = PNG_BIT_DEPTH_8;
  ihdr[9] = PNG_COLOUR_TYPE_RGBA;
  const rowBytes = image.dimensions.width * 4;
  const scanlines = Buffer.alloc((rowBytes + 1) * image.dimensions.height);
  for (let y = 0; y < image.dimensions.height; y += 1) {
    const scanlineOffset = y * (rowBytes + 1);
    scanlines[scanlineOffset] = 0;
    Buffer.from(image.rgba.subarray(y * rowBytes, (y + 1) * rowBytes)).copy(scanlines, scanlineOffset + 1);
  }
  writeFileSync(outputPath, Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND"),
  ]));
};

export const processSpriteFile = (inputPath: string, outputPath: string, options: ProcessOptions): void => {
  const decoded = readPng(inputPath);
  writePng(outputPath, processSpriteImage(decoded, options));
};

const expectedFileNames = (): readonly string[] =>
  Object.keys(EXPECTED_SPRITES).flatMap((subject) =>
    Array.from({ length: 8 }, (_, index) => `${subject}_${String(index + 1).padStart(2, "0")}.png`),
  );

export const assertBuildingSpriteSet = (root: string): void => {
  const expected = expectedFileNames();
  const sortedExpected = [...expected].sort();
  const actual = readdirSync(root).filter((fileName) => fileName.endsWith(".png")).sort();
  if (actual.length !== expected.length || actual.some((fileName, index) => fileName !== sortedExpected[index])) {
    throw new Error(`Building sprite set must contain exactly ${expected.length} expected PNG files`);
  }
  const allowed = new Set(canonicalColors().map((colour) => colour.key));
  for (const fileName of expected) {
    const filePath = path.join(root, fileName);
    if (!existsSync(filePath)) {
      throw new Error(`Missing expected building sprite ${fileName}`);
    }
    const [subject] = fileName.split("_");
    const contract = subject === undefined ? undefined : EXPECTED_SPRITES[subject as keyof typeof EXPECTED_SPRITES];
    if (contract === undefined) {
      throw new Error(`Unknown building sprite subject in ${fileName}`);
    }
    const image = readPng(filePath);
    if (image.dimensions.width !== contract.width || image.dimensions.height !== contract.height) {
      throw new Error(`${fileName} dimensions were ${image.dimensions.width}x${image.dimensions.height}, expected ${contract.width}x${contract.height}`);
    }
    assertVisibleWidthBand(image, subject as BuildingSubject);
    if (subject === "mill") assertMillHeight(image);
    let visiblePixels = 0;
    for (let y = 0; y < image.dimensions.height; y += 1) {
      for (let x = 0; x < image.dimensions.width; x += 1) {
        const index = byteIndex(image.dimensions, x, y);
        const alpha = image.rgba[index + 3];
        if (alpha !== undefined && alpha > 0) {
          if (y > contract.baselineY) {
            throw new Error(`${fileName} has opaque pixel below baseline ${contract.baselineY} at ${x},${y}`);
          }
          const r = image.rgba[index];
          const g = image.rgba[index + 1];
          const b = image.rgba[index + 2];
          if (r === undefined || g === undefined || b === undefined) {
            throw new Error(`${fileName} ended with incomplete RGB at byte ${index}`);
          }
          const key = `${r},${g},${b}`;
          if (!allowed.has(key)) {
            throw new Error(`${fileName} has non-canonical RGB ${key} at ${x},${y}`);
          }
          if (alpha !== 255 && alpha !== OUTLINE_ALPHA) {
            throw new Error(`${fileName} has unsupported alpha ${alpha} at ${x},${y}`);
          }
          if (alpha === OUTLINE_ALPHA && key !== rgbKey(hexToRgb(paletteSource.PALETTE.ink ?? "#3A2E1F"))) {
            throw new Error(`${fileName} has non-ink outline RGB ${key} at ${x},${y}`);
          }
          visiblePixels += 1;
        }
      }
    }
    const coverage = visiblePixels / (image.dimensions.width * image.dimensions.height);
    if (coverage < 0.002 || coverage > 0.85) {
      throw new Error(`${fileName} alpha coverage ${coverage.toFixed(4)} is outside 0.002..0.85`);
    }
  }
};

const parsePositiveInt = (label: string, value: string | undefined): number => {
  const parsed = value === undefined ? Number.NaN : Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
};

const main = (): number => {
  const [, , inputPath, outputPath, widthText, heightText, baselineText] = process.argv;
  try {
    if (inputPath === undefined || outputPath === undefined) {
      throw new Error("Usage: tsx scripts/processBuildingSprite.ts <input.png> <output.png> <width> <height> <baselineY>");
    }
    processSpriteFile(inputPath, outputPath, {
      target: { width: parsePositiveInt("width", widthText), height: parsePositiveInt("height", heightText) },
      baselineY: parsePositiveInt("baselineY", baselineText),
      chromaKey: DEFAULT_CHROMA_KEY,
      threshold: 24,
      softEdge: 96,
      outline: true,
    });
    return 0;
  } catch (caught) {
    if (caught instanceof Error) {
      writeFileSync(2, `${caught.name}: ${caught.message}\n`);
      return 1;
    }
    throw caught;
  }
};

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = main();
}
