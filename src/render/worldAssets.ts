import manifestData from "../../public/assets/world_asset_manifest.json";

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

type AssetRecord = {
  readonly meta: Omit<AssetMeta, "status">;
  status: LoadStatus;
  image: HTMLImageElement | null;
};

type JsonRecord = Readonly<Record<string, unknown>>;

const EMPTY_RECORD: JsonRecord = {};

const records = new Map<string, AssetRecord>(
  parseManifest(manifestData).map((meta) => [meta.key, { meta, status: "idle", image: null }]),
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

function parseManifest(value: unknown): readonly Omit<AssetMeta, "status">[] {
  const manifest = requireRecord(value);
  const assets = manifest["assets"];
  if (!Array.isArray(assets)) return [];
  return assets.map(parseAsset);
}

function parseAsset(value: unknown): Omit<AssetMeta, "status"> {
  const asset = requireRecord(value);
  const key = requireString(asset["key"]);
  return {
    key,
    category: parseCategory(asset["category"]),
    url: servedUrl(requireString(asset["path"])),
    width: requireNumber(asset["width"]),
    height: requireNumber(asset["height"]),
    anchor: parseAnchor(asset["anchor"]),
    footprint: parseFootprint(asset["footprint"]),
  };
}

function parseAnchor(value: unknown): { readonly x: number; readonly y: number } {
  const anchor = requireRecord(value);
  return { x: requireNumber(anchor["x"]), y: requireNumber(anchor["y"]) };
}

function parseFootprint(value: unknown): { readonly width: number; readonly height: number } {
  const footprint = requireRecord(value);
  return {
    width: requireNumber(footprint["width"]),
    height: requireNumber(footprint["height"]),
  };
}

function parseCategory(value: unknown): AssetCategory {
  switch (value) {
    case "building":
    case "foliage":
    case "terrain":
      return value;
    default:
      return "terrain";
  }
}

function servedUrl(path: string): string {
  return path.startsWith("public/") ? `/${path.slice("public/".length)}` : `/${path}`;
}

function requireRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : EMPTY_RECORD;
}

function requireString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function requireNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
