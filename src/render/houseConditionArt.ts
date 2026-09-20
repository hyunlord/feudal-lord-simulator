import type { HouseCondition } from "../population/houseCondition";
import { assetUrlForBase } from "./worldAssets";

export type HouseConditionArtMeta = Readonly<{
  assetId: string;
  level: number;
  lot: "single" | "horizontal" | "vertical";
  condition: Exclude<HouseCondition, "maintained">;
  url: string;
  width: number;
  height: number;
}>;
type Entry = { readonly meta: HouseConditionArtMeta; image: HTMLImageElement | null };
const entries = new Map<string, Entry>();
const key = (level: number, lot: HouseConditionArtMeta["lot"], condition: HouseCondition) => `${level}:${lot}:${condition}`;

/** Missing optional artwork retains the existing registered wear marks. */
export async function registerHouseConditionArt(manifest: readonly HouseConditionArtMeta[], base = import.meta.env?.BASE_URL ?? "/"): Promise<void> {
  if (typeof Image !== "function") return;
  await Promise.all(manifest.map(meta => new Promise<void>(resolve => {
    const id = key(meta.level, meta.lot, meta.condition);
    if (entries.has(id)) { resolve(); return; }
    const entry: Entry = { meta, image: null };
    entries.set(id, entry);
    try {
      const image = new Image();
      image.onload = () => {
        if (image.naturalWidth === meta.width && image.naturalHeight === meta.height) entry.image = image;
        resolve();
      };
      image.onerror = () => resolve();
      image.src = assetUrlForBase(meta.url.replace(/^\/+/, ""), base);
    } catch (error) {
      if (!(error instanceof Error)) console.warn("Condition artwork initialization failed", error);
      resolve();
    }
  })));
}

export function houseConditionArt(level: number, lot: HouseConditionArtMeta["lot"], condition: HouseCondition): Entry | null {
  const entry = entries.get(key(level, lot, condition));
  return entry?.image === null || entry === undefined ? null : entry;
}
