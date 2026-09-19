import path from "node:path";
import { readPng, type RgbaImage } from "./processBuildingSprite";
import { assertTerrainSeams, buildTerrainTile2x2, measureTerrainSeams } from "./terrainTexturePipeline";
import type { WorldAsset, WorldAssetManifest } from "./worldAssetContracts";
import { WORLD_ASSET_KEYS } from "./worldAssetContracts";
import { assertSpriteContract } from "./worldSpritePipeline";

export class AcceptedArtVerificationError extends Error {
  constructor(message: string) { super(message); this.name = "AcceptedArtVerificationError"; }
}

export const parseArchivedAssetHashes = (value: unknown): ReadonlyMap<string, string> => {
  if (typeof value !== "object" || value === null || !("assets" in value) || !Array.isArray(value.assets)) {
    throw new AcceptedArtVerificationError("Archived manifest must contain assets");
  }
  const expected = new Set<string>(WORLD_ASSET_KEYS);
  const hashes = new Map<string, string>();
  for (const entry of value.assets) {
    if (typeof entry !== "object" || entry === null || !("key" in entry) || !("sha256" in entry)
      || typeof entry.key !== "string" || !expected.has(entry.key) || hashes.has(entry.key)
      || typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new AcceptedArtVerificationError("Invalid or duplicate archived asset fingerprint");
    }
    hashes.set(entry.key, entry.sha256);
  }
  if (hashes.size !== expected.size) throw new AcceptedArtVerificationError("Archived asset fingerprints are incomplete");
  return hashes;
};

export const assertNativeAlphaSprite = (image: RgbaImage, asset: WorldAsset): void => {
  const { width, height } = image.dimensions;
  let visible = 0;
  let solid = 0;
  let alphaCoverage = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = image.rgba[(y * width + x) * 4 + 3] ?? 0;
      if (alpha === 0) continue;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        throw new AcceptedArtVerificationError(`${asset.key} native alpha touches canvas boundary`);
      }
      if (y > asset.anchor.y) throw new AcceptedArtVerificationError(`${asset.key} native sprite extends below baseline`);
      visible += 1;
      alphaCoverage += alpha / 255;
      if (alpha >= 240) solid += 1;
    }
  }
  if (visible < 4 || solid < 1 || alphaCoverage / visible < 0.3) {
    throw new AcceptedArtVerificationError(`${asset.key} native sprite is empty or excessively translucent`);
  }
};

export const verifyAcceptedArtCategories = (repoRoot: string, manifest: WorldAssetManifest): void => {
  if (!manifest.assets.some(asset => asset.source.kind === "accepted-art")) {
    throw new AcceptedArtVerificationError("Accepted art mode requires at least one traceable accepted source");
  }
  for (const asset of manifest.assets) {
    const image = readPng(path.join(repoRoot, asset.path));
    if (asset.category === "terrain") {
      for (let i = 3; i < image.rgba.length; i += 4) {
        if (image.rgba[i] !== 255) throw new AcceptedArtVerificationError(`${asset.key} terrain must be opaque`);
      }
      const measurable = image.dimensions.width === 256 ? buildTerrainTile2x2(image) : image;
      assertTerrainSeams(measureTerrainSeams(measurable));
    } else if (asset.source.kind === "accepted-art") {
      assertNativeAlphaSprite(image, asset);
    } else if (asset.category === "foliage") {
      assertSpriteContract(image, asset.key);
    } else {
      switch (asset.key) {
        case "house_l0": case "mill": case "barn": break;
        default: assertSpriteContract(image, asset.key);
      }
    }
  }
};
