import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { PALETTE } from "../src/content/palette";

export type Rgb = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

export type Lab = {
  readonly l: number;
  readonly a: number;
  readonly b: number;
};

export type PaletteMatch = {
  readonly name: string;
  readonly hex: string;
  readonly rgb: Rgb;
};

export type PaletteProfile = "canonical" | "wood-console";

type PngDimensions = {
  readonly width: number;
  readonly height: number;
};

class QuantiseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuantiseError";
  }
}

const FFMPEG_PATH = "/usr/bin/ffmpeg";
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const REFERENCE_WHITE = { x: 95.047, y: 100, z: 108.883 } as const;

const hexToRgb = (hex: string): Rgb => {
  const parsed = Number.parseInt(hex.slice(1), 16);
  return {
    r: (parsed >> 16) & 0xff,
    g: (parsed >> 8) & 0xff,
    b: parsed & 0xff,
  };
};

const srgbToLinear = (value: number): number => {
  const normalised = value / 255;
  return normalised <= 0.04045
    ? normalised / 12.92
    : ((normalised + 0.055) / 1.055) ** 2.4;
};

const labPivot = (value: number): number =>
  value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;

export const rgbToLab = (rgb: Rgb): Lab => {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;
  const fx = labPivot(x / REFERENCE_WHITE.x);
  const fy = labPivot(y / REFERENCE_WHITE.y);
  const fz = labPivot(z / REFERENCE_WHITE.z);
  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
};

const deltaE76 = (left: Lab, right: Lab): number =>
  Math.hypot(left.l - right.l, left.a - right.a, left.b - right.b);

type PaletteName = keyof typeof PALETTE;

const PROFILE_PALETTES: Record<PaletteProfile, readonly PaletteName[]> = {
  canonical: Object.keys(PALETTE) as PaletteName[],
  "wood-console": ["ink", "inkLight", "earth", "earthDark"],
};

const paletteEntries = Object.entries(PALETTE).map(([name, hex]) => {
  const rgb = hexToRgb(hex);
  return { name, hex, rgb, lab: rgbToLab(rgb) };
});

const isPaletteProfile = (value: string): value is PaletteProfile => value in PROFILE_PALETTES;

export const nearestPalette = (lab: Lab, profile: PaletteProfile = "canonical"): PaletteMatch => {
  const allowedNames = new Set<string>(PROFILE_PALETTES[profile]);
  const candidates = paletteEntries.filter((entry) => allowedNames.has(entry.name));
  let best = candidates[0];
  if (best === undefined) {
    throw new QuantiseError(`Palette profile ${profile} is empty`);
  }

  for (const entry of candidates.slice(1)) {
    if (deltaE76(lab, entry.lab) < deltaE76(lab, best.lab)) {
      best = entry;
    }
  }

  return { name: best.name, hex: best.hex, rgb: best.rgb };
};

export const quantiseRgba = (
  rgba: Uint8Array,
  profile: PaletteProfile = "canonical",
): Uint8Array => {
  if (rgba.length % 4 !== 0) {
    throw new QuantiseError(`RGBA buffer length must be divisible by 4, got ${rgba.length}`);
  }

  const output = new Uint8Array(rgba.length);
  for (let index = 0; index < rgba.length; index += 4) {
    const r = rgba[index];
    const g = rgba[index + 1];
    const b = rgba[index + 2];
    const a = rgba[index + 3];
    if (r === undefined || g === undefined || b === undefined || a === undefined) {
      throw new QuantiseError(`Incomplete RGBA pixel at byte ${index}`);
    }
    const nearest = nearestPalette(rgbToLab({ r, g, b }), profile);
    output[index] = nearest.rgb.r;
    output[index + 1] = nearest.rgb.g;
    output[index + 2] = nearest.rgb.b;
    output[index + 3] = a;
  }
  return output;
};

export const readPngDimensions = (path: string): PngDimensions => {
  const header = readFileSync(path).subarray(0, 24);
  if (header.length < 24) {
    throw new QuantiseError(`${path} is too small to be a PNG`);
  }
  for (const [index, expected] of PNG_SIGNATURE.entries()) {
    if (header[index] !== expected) {
      throw new QuantiseError(`${path} is not a PNG file`);
    }
  }
  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);
  if (width === 0 || height === 0) {
    throw new QuantiseError(`${path} has invalid PNG dimensions ${width}x${height}`);
  }
  return { width, height };
};

const runFfmpeg = (args: readonly string[], input?: Uint8Array): Buffer => {
  const result = spawnSync(FFMPEG_PATH, args, {
    input,
    maxBuffer: 1024 * 1024 * 512,
  });
  if (result.error !== undefined) {
    throw new QuantiseError(`ffmpeg failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new QuantiseError(`ffmpeg exited ${result.status}: ${result.stderr.toString("utf8").trim()}`);
  }
  return result.stdout;
};

export const decodePngToRgba = (path: string): { readonly dimensions: PngDimensions; readonly rgba: Uint8Array } => {
  const dimensions = readPngDimensions(path);
  const raw = runFfmpeg(["-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"]);
  const expectedLength = dimensions.width * dimensions.height * 4;
  if (raw.length !== expectedLength) {
    throw new QuantiseError(`Decoded RGBA length ${raw.length} did not match ${expectedLength}`);
  }
  return { dimensions, rgba: new Uint8Array(raw) };
};

const encodeRgbaToPng = (path: string, dimensions: PngDimensions, rgba: Uint8Array): void => {
  const encoded = runFfmpeg(
    [
      "-v",
      "error",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${dimensions.width}x${dimensions.height}`,
      "-i",
      "pipe:0",
      "-frames:v",
      "1",
      "-y",
      path,
    ],
    rgba,
  );
  if (encoded.length !== 0) {
    writeFileSync(1, encoded);
  }
};

export const quantisePngFile = (
  inputPath: string,
  outputPath: string,
  profile: PaletteProfile = "canonical",
): void => {
  const decoded = decodePngToRgba(inputPath);
  encodeRgbaToPng(outputPath, decoded.dimensions, quantiseRgba(decoded.rgba, profile));
};

const main = (): number => {
  const [, , inputPath, outputPath, requestedProfile = "canonical"] = process.argv;
  if (
    inputPath === undefined
    || outputPath === undefined
    || process.argv.length < 4
    || process.argv.length > 5
  ) {
    writeFileSync(2, "Usage: tsx scripts/quantisePalette.ts <input.png> <output.png> [canonical|wood-console]\n");
    return 2;
  }

  try {
    if (!isPaletteProfile(requestedProfile)) {
      throw new QuantiseError(`Unknown palette profile: ${requestedProfile}`);
    }
    quantisePngFile(inputPath, outputPath, requestedProfile);
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
