import { useEffect, useState } from "react";
import { assetUrlForBase } from "../../render/worldAssets";
import { drawCroppedWorldSprite } from "../../render/worldSprite";
import { WAVE14_IMAGES } from "../wave14ArtManifest.generated";
import { armsKey, INK, merchantKey, OUTLINE, TINCTURES, type ArmsRecipe, type MerchantRecipe } from "./heraldry";

// UI-5: composes arms and merchant marks from the Wave 14 masks in the browser, by the batch's contract
// (records/HERALDRY_COMPOSITION.md): the shield PNG's alpha is the silhouette, alpha × luminance the fill and the rest the
// outline; a partition's alpha `m` paints its second tincture (the first keeps `1 − m`); an ordinary and a charge are
// painted by their alpha, tinted before compositing; the surface textures multiply (0.80) then screen (0.48) the fill,
// mapped to each row of the fill (the rework's "normalized fill row UV"); a merchant's mark is the greatest coverage of
// its frame, staff and branch, times the ink-stamp retention map, in ink.
// Caches (measured in the DGX's headless Chrome, docs/verification/ui5/captures/captures.json `compose`):
//  - composites — key: the recipe (`armsKey` / `merchantKey`); reason: a person card asks for the same household's
//    emblem each time it opens; arms take 2.0–2.7 ms (median 2.2) and a mark 0.3–0.5 ms once the masks are decoded, a
//    cached one 0 ms;
//  - masks — key: file, size and the charge's box; reason: every composite reads four to six masks and most are shared
//    (the textures always); the first arms of a page, masks fetched and decoded, took 26 ms and the first mark 20 ms.
const SIZE = 256;
const MARK = 128;
type Picture = Readonly<{ url: string; digest: string }>;
const composed = new Map<string, Promise<Picture>>();
const masks = new Map<string, Promise<Uint8ClampedArray>>();

const url = (id: keyof typeof WAVE14_IMAGES) => assetUrlForBase(WAVE14_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");
/** A palette hex colour's three channels (0–255). */
const channelsOf = (hex: string): readonly [number, number, number] => [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];

/** A mask's RGBA at `size`² (drawn at `box` inside it when given: the charge's place on the shield). */
function mask(id: keyof typeof WAVE14_IMAGES, size: number, box?: Readonly<{ x: number; y: number; width: number; height: number }>): Promise<Uint8ClampedArray> {
  const key = `${id}@${size}@${box === undefined ? "" : [box.x, box.y, box.width, box.height].join(",")}`;
  let pending = masks.get(key);
  if (pending === undefined) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url(id); })
      .then(image => {
        const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        // Smoothed, unsnapped: the mask scaled to its place (the whole square, or the charge's box on the shield).
        drawCroppedWorldSprite(context, image, { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight },
          box ?? { x: 0, y: 0, width: size, height: size }, false, true);
        return context.getImageData(0, 0, size, size).data;
      });
    masks.set(key, pending);
  }
  return pending;
}

/** FNV-1a over the pixels: the composite's fingerprint (gate: the same seed gives the same arms, pixel for pixel). */
function digestOf(data: Uint8ClampedArray): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < data.length; index += 1) hash = Math.imul(hash ^ data[index]!, 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, "0");
}

function toPicture(data: Uint8ClampedArray<ArrayBuffer>, size: number): Picture {
  const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
  canvas.getContext("2d")!.putImageData(new ImageData(data, size, size), 0, 0);
  return { url: canvas.toDataURL("image/png"), digest: digestOf(data) };
}

async function composeArms(recipe: ArmsRecipe): Promise<Picture> {
  const [shield, partition, ordinary, charge, multiply, screen] = await Promise.all([
    mask(`shield_${recipe.shield}`, SIZE),
    recipe.partition === null ? null : mask(`partition_${recipe.partition.id}`, SIZE),
    recipe.ordinary === null ? null : mask(`ordinary_${recipe.ordinary.id}`, SIZE),
    recipe.charge === null ? null : mask(`charge_${recipe.charge.id}`, SIZE, { x: 70, y: recipe.ordinary?.id === "chief" ? 82 : 64, width: 116, height: 116 }),
    mask("shield_surface_texture_multiply", SIZE), mask("shield_surface_texture_screen", SIZE),
  ]);
  const field = channelsOf(TINCTURES[recipe.field]); const outline = channelsOf(OUTLINE);
  const second = recipe.partition === null ? field : channelsOf(TINCTURES[recipe.partition.tincture]);
  const onIt = recipe.ordinary === null ? field : channelsOf(TINCTURES[recipe.ordinary.tincture]);
  const chargeColour = recipe.charge === null ? field : channelsOf(TINCTURES[recipe.charge.tincture]);
  const out = new Uint8ClampedArray(new ArrayBuffer(SIZE * SIZE * 4));
  for (let y = 0; y < SIZE; y += 1) {
    // The fill's span on this row: the textures' row UV.
    let first = -1; let last = -1;
    for (let x = 0; x < SIZE; x += 1) { const at = (y * SIZE + x) * 4; if (shield[at + 3]! > 8 && shield[at]! > 128) { if (first < 0) first = x; last = x; } }
    for (let x = 0; x < SIZE; x += 1) {
      const at = (y * SIZE + x) * 4;
      const alpha = shield[at + 3]! / 255;
      if (alpha === 0) continue;
      const fill = alpha * ((shield[at]! + shield[at + 1]! + shield[at + 2]!) / 765);
      // The layers' weights at this pixel (a partition's, an ordinary's or chief's, a charge's coverage).
      const m = partition === null ? 0 : partition[at + 3]! / 255;
      const o = ordinary === null ? 0 : ordinary[at + 3]! / 255;
      const c = charge === null ? 0 : charge[at + 3]! / 255;
      const u = first < 0 || last <= first ? 0 : Math.min(SIZE - 1, Math.max(0, Math.round((x - first) / (last - first) * (SIZE - 1))));
      const sample = (y * SIZE + u) * 4;
      const darken = multiply[sample]! / 255; const lighten = screen[sample]! / 255;
      for (let channel = 0; channel < 3; channel += 1) {
        let value = field[channel]!;
        value = value * (1 - m) + second[channel]! * m;
        value = value * (1 - o) + onIt[channel]! * o;
        value = (value * (1 - c) + chargeColour[channel]! * c) / 255;
        value = value * (1 - 0.8) + value * darken * 0.8;
        value = value * (1 - 0.48) + (1 - (1 - value) * (1 - lighten)) * 0.48;
        out[at + channel] = Math.round(((value * 255) * fill + outline[channel]! * (alpha - fill)) / alpha);
      }
      out[at + 3] = Math.round(alpha * 255);
    }
  }
  return toPicture(out, SIZE);
}

async function composeMark(recipe: MerchantRecipe): Promise<Picture> {
  const [frame, staff, branch, ink] = await Promise.all([
    mask(`merchant_frame_${recipe.frame}`, MARK), mask(`merchant_staff_${recipe.staff}`, MARK), mask(`merchant_branch_${recipe.branch}`, MARK),
    mask("merchant_ink_stamp_texture", MARK),
  ]);
  const colour = channelsOf(INK);
  const out = new Uint8ClampedArray(new ArrayBuffer(MARK * MARK * 4));
  for (let index = 0; index < MARK * MARK; index += 1) {
    const at = index * 4;
    const cover = Math.max(frame[at + 3]!, staff[at + 3]!, branch[at + 3]!) / 255;
    const retained = (ink[at]! + ink[at + 1]! + ink[at + 2]!) / 765;
    out[at] = colour[0]; out[at + 1] = colour[1]; out[at + 2] = colour[2]; out[at + 3] = Math.round(cover * retained * 255);
  }
  return toPicture(out, MARK);
}

export function composedEmblem(emblem: EmblemSpec): Promise<Picture> {
  const key = emblem.kind === "arms" ? `arms:${armsKey(emblem.recipe)}` : `mark:${merchantKey(emblem.recipe)}`;
  let pending = composed.get(key);
  if (pending === undefined) { pending = emblem.kind === "arms" ? composeArms(emblem.recipe) : composeMark(emblem.recipe); composed.set(key, pending); }
  return pending;
}

export type EmblemSpec = Readonly<{ kind: "arms"; recipe: ArmsRecipe }> | Readonly<{ kind: "merchant"; recipe: MerchantRecipe }>;

/** The arms or the mark as an image `size` px wide (nothing until composed; the digest is on the element). */
export function EmblemImage({ emblem, size, label }: { readonly emblem: EmblemSpec; readonly size: number; readonly label: string }) {
  const [picture, setPicture] = useState<Picture | null>(null);
  const key = emblem.kind === "arms" ? armsKey(emblem.recipe) : merchantKey(emblem.recipe);
  useEffect(() => {
    let live = true;
    setPicture(null);
    void composedEmblem(emblem).then(result => { if (live) setPicture(result); }).catch(() => undefined);
    return () => { live = false; };
  }, [emblem.kind, key]); // eslint-disable-line react-hooks/exhaustive-deps -- keyed by the recipe's content (a new recipe object each render composes the same picture)
  return picture === null ? <span className="emblem-image emblem-image--pending" style={{ width: size, height: size }} aria-hidden="true" />
    : <img className="emblem-image" src={picture.url} width={size} height={size} alt={label} data-emblem={key} data-digest={picture.digest} />;
}
