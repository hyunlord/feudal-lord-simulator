import { runtimeWorldAssetManifest } from "./worldAssetManifest.generated";

export type LoadStatus = "idle" | "loading" | "ready" | "missing";

type AssetCategory = "building" | "foliage" | "terrain";

export type AssetMeta = {
  readonly key: string;
  readonly category: AssetCategory;
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly anchor: { readonly x: number; readonly y: number };
  readonly footprint: { readonly width: number; readonly height: number };
  readonly status: LoadStatus;
};

export type AssetStatus = Pick<AssetMeta, "key" | "category" | "url" | "status">;

type AssetRecord = {
  readonly meta: Omit<AssetMeta, "status">;
  status: LoadStatus;
  image: HTMLImageElement | null;
};

type JsonRecord = Readonly<Record<string, unknown>>;

export class WorldAssetManifestError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`Invalid world asset manifest ${field}: ${message}`);
    this.name = "WorldAssetManifestError";
    this.field = field;
  }
}

const records = new Map<string, AssetRecord>(
  parseWorldAssetManifest(runtimeWorldAssetManifest).map((meta) => [meta.key, { meta, status: "idle", image: null }]),
);

let preloadPromise: Promise<void> | null = null;

export function preloadWorldAssets(): Promise<void> {
  preloadPromise ??= Promise.all([...records.values()].map(loadRecord)).then(() => undefined);
  return preloadPromise;
}

export function getSprite(key: string): HTMLImageElement | null {
  const record = records.get(key);
  return record?.status === "ready" ? record.image : null;
}

export function spriteMeta(key: string): AssetMeta | null {
  const record = records.get(key);
  return record === undefined ? null : { ...record.meta, status: record.status };
}

export function worldAssetStatuses(): readonly AssetStatus[] {
  return [...records.values()].map(({ meta, status }) => ({
    key: meta.key,
    category: meta.category,
    url: meta.url,
    status,
  }));
}

export function maxSpriteAnchorY(): number {
  let maxAnchorY = 0;
  for (const record of records.values()) {
    maxAnchorY = Math.max(maxAnchorY, record.meta.anchor.y);
  }
  return maxAnchorY;
}

function loadRecord(record: AssetRecord): Promise<void> {
  if (record.status !== "idle") return Promise.resolve();
  if (typeof globalThis.Image !== "function") {
    markMissing(record);
    return Promise.resolve();
  }
  record.status = "loading";
  const image = createImage();
  if (image === null) {
    markMissing(record);
    return Promise.resolve();
  }
  record.image = image;
  return new Promise((resolve) => {
    image.onload = () => {
      record.status = "ready";
      resolve();
    };
    image.onerror = () => {
      markMissing(record);
      resolve();
    };
    if (!setImageSource(image, record.meta.url)) {
      markMissing(record);
      resolve();
    }
  });
}

function createImage(): HTMLImageElement | null {
  try {
    return new Image();
  } catch (error) {
    if (error instanceof Error) return null;
    return null;
  }
}

function setImageSource(image: HTMLImageElement, url: string): boolean {
  try {
    image.src = url;
    return true;
  } catch (error) {
    if (error instanceof Error) return false;
    return false;
  }
}

function markMissing(record: AssetRecord): void {
  record.status = "missing";
  record.image = null;
}

export function parseWorldAssetManifest(value: unknown): readonly Omit<AssetMeta, "status">[] {
  const manifest = requireRecord(value, "root");
  const assets = manifest["assets"];
  if (!Array.isArray(assets)) throw new WorldAssetManifestError("assets", "expected an array");
  return assets.map((asset, index) => parseAsset(asset, `assets[${index}]`));
}

function parseAsset(value: unknown, field: string): Omit<AssetMeta, "status"> {
  const asset = requireRecord(value, field);
  const key = requireString(asset["key"], `${field}.key`);
  return {
    key,
    category: parseCategory(asset["category"], `${field}.category`),
    url: assetUrlForBase(requireAssetPath(asset["path"], `${field}.path`), deploymentBaseUrl()),
    width: requirePositiveInteger(asset["width"], `${field}.width`),
    height: requirePositiveInteger(asset["height"], `${field}.height`),
    anchor: parseAnchor(asset["anchor"], `${field}.anchor`),
    footprint: parseFootprint(asset["footprint"], `${field}.footprint`),
  };
}

function parseAnchor(value: unknown, field: string): { readonly x: number; readonly y: number } {
  const anchor = requireRecord(value, field);
  return {
    x: requireNonNegativeNumber(anchor["x"], `${field}.x`),
    y: requireNonNegativeNumber(anchor["y"], `${field}.y`),
  };
}

function parseFootprint(value: unknown, field: string): { readonly width: number; readonly height: number } {
  const footprint = requireRecord(value, field);
  return {
    width: requirePositiveInteger(footprint["width"], `${field}.width`),
    height: requirePositiveInteger(footprint["height"], `${field}.height`),
  };
}

function parseCategory(value: unknown, field: string): AssetCategory {
  switch (value) {
    case "building":
    case "foliage":
    case "terrain":
      return value;
    default:
      throw new WorldAssetManifestError(field, "expected building, foliage, or terrain");
  }
}

export function assetUrlForBase(path: string, baseUrl: string): string {
  const relativePath = path.startsWith("public/") ? path.slice("public/".length) : path;
  const leadingBase = baseUrl.startsWith("/") ? baseUrl : `/${baseUrl}`;
  const normalizedBase = leadingBase.endsWith("/") ? leadingBase : `${leadingBase}/`;
  return `${normalizedBase}${relativePath}`;
}

function deploymentBaseUrl(): string {
  return import.meta.env?.BASE_URL ?? "/";
}

function requireRecord(value: unknown, field: string): JsonRecord {
  if (!isRecord(value)) throw new WorldAssetManifestError(field, "expected an object");
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new WorldAssetManifestError(field, "expected a non-empty string");
  }
  return value;
}

function requireAssetPath(value: unknown, field: string): string {
  const path = requireString(value, field);
  if (!path.startsWith("public/assets/") || path.includes("..") || path.includes("\\")) {
    throw new WorldAssetManifestError(field, "expected a safe public/assets path");
  }
  return path;
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new WorldAssetManifestError(field, "expected a positive integer");
  }
  return value;
}

function requireNonNegativeNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new WorldAssetManifestError(field, "expected a non-negative finite number");
  }
  return value;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
