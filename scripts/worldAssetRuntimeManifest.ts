import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { WorldAssetManifest } from "./worldAssetContracts";

export class WorldAssetRuntimeManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorldAssetRuntimeManifestError";
  }
}

export const runtimeManifestProjection = (manifest: WorldAssetManifest): {
  readonly assets: readonly {
    readonly key: string;
    readonly category: "building" | "foliage" | "terrain";
    readonly path: string;
    readonly width: number;
    readonly height: number;
    readonly renderScale: number;
    readonly anchor: { readonly x: number; readonly y: number };
    readonly footprint: { readonly width: number; readonly height: number };
  }[];
} => ({
  assets: manifest.assets.map((asset) => ({
    key: asset.key,
    category: asset.category,
    path: asset.path,
    width: asset.width,
    height: asset.height,
    renderScale: asset.renderScale,
    anchor: asset.anchor,
    footprint: asset.footprint,
  })),
});

export const runtimeManifestSource = (manifest: WorldAssetManifest): string =>
  `export const runtimeWorldAssetManifest = ${JSON.stringify(runtimeManifestProjection(manifest), null, 2)} as const;\n`;

export const runtimeManifestPath = (repoRoot: string): string =>
  path.join(repoRoot, "src", "render", "worldAssetManifest.generated.ts");

export const writeRuntimeWorldAssetManifest = (repoRoot: string, manifest: WorldAssetManifest): void => {
  const filePath = runtimeManifestPath(repoRoot);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, runtimeManifestSource(manifest));
};

export const assertRuntimeWorldAssetManifest = (repoRoot: string, manifest: WorldAssetManifest): void => {
  const filePath = runtimeManifestPath(repoRoot);
  const actual = readFileSync(filePath, "utf8");
  const expected = runtimeManifestSource(manifest);
  if (actual !== expected) {
    throw new WorldAssetRuntimeManifestError("runtime manifest does not match public world asset manifest");
  }
};
