import { useEffect, useMemo, useRef } from "react";
import { PALETTE, RAMPS, type PaletteColor } from "../../content/palette";
import type { GameState } from "../../engine/engine.types";
import { history } from "../../engine/history";
import { decodeSnapshot, rasterizeSnapshot, SNAPSHOT_PALETTE, type SnapshotCell } from "../../engine/historySnapshot";
import { frameBoxStyle, frameContentStyle, frameToken } from "../frameBox";
import { WAVE19_FRAME_KIND, wave19FrameLayerStyle } from "../wave19Art";
import { chronicleDate, type SnapshotRef } from "./chronicleScreenModel";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";

// CHRON-1 "그때 지도" (CHRONICLE_DESIGN 2.1, HL-5): a ledger thumbnail (128² every season, 256² at an era or a chapter's
// end; one palette index per pixel, tile rows as the map overview draws them) painted with the game's palette inside
// the Wave 19 map frame, cropped to the square around what the town has built; [지금과 나란히] puts today's map,
// rasterized the same way at the same size and cropped to the same square, beside it.

/** HL-5 classes → the game's palette (src/content/palette.ts). */
export const SNAPSHOT_COLOURS: Readonly<Record<SnapshotCell, PaletteColor>> = {
  grass: RAMPS.foliage[4], forest: RAMPS.foliage[2], water: RAMPS.water[3], rock: RAMPS.stone[3], road: RAMPS.earth[4],
  house: RAMPS.thatch[2], building: RAMPS.timber[2], construction: RAMPS.plaster[2], zone_burgage: RAMPS.plaster[4],
  zone_arable: RAMPS.thatch[5], burnt: PALETTE.vermilion, wall: RAMPS.timber[0], abandoned: RAMPS.slate[3],
};
const BYTES: readonly (readonly [number, number, number])[] = SNAPSHOT_PALETTE.map(cell => {
  const hex = SNAPSHOT_COLOURS[cell];
  return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)] as const;
});

/** The two map frames (UI-AUDIT-1: their window is the frame tokens' safe inset — the 320 frame 45–50 px, the 160 frame
 * 23–25 px — the map in the content box inside it). */
const FRAME = { large: { id: "frame_snapshot_map_320" }, small: { id: "frame_snapshot_map_160" } } as const;

/** The classes a settlement puts on the land (roads, houses, buildings, sites, zones, burnt and empty houses, walls). */
const SETTLED = new Set(["road", "house", "building", "construction", "zone_burgage", "zone_arable", "burnt", "wall", "abandoned"].map(cell => SNAPSHOT_PALETTE.indexOf(cell as SnapshotCell)));
export type MapCrop = Readonly<{ x: number; y: number; side: number }>;

/** The square around what the town has built (in each picture shown), a quarter of its side around it; the whole map if nothing is. */
export function settlementCrop(size: number, ...pictures: readonly Uint8Array[]): MapCrop {
  let minX = size; let minY = size; let maxX = -1; let maxY = -1;
  for (const pixels of pictures) for (let index = 0; index < pixels.length; index += 1) {
    if (!SETTLED.has(pixels[index]!)) continue;
    const x = index % size; const y = Math.floor(index / size);
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (maxX < 0) return { x: 0, y: 0, side: size };
  const side = Math.min(size, Math.max(size / 4, Math.ceil(Math.max(maxX - minX + 1, maxY - minY + 1) * 1.5)));
  const clamp = (centre: number) => Math.min(size - side, Math.max(0, Math.round(centre - side / 2)));
  return { x: clamp((minX + maxX + 1) / 2), y: clamp((minY + maxY + 1) / 2), side };
}

function SnapshotCanvas({ pixels, size, crop, label }: { readonly pixels: Uint8Array; readonly size: number; readonly crop: MapCrop; readonly label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (context === null || context === undefined) return;
    const image = context.createImageData(crop.side, crop.side);
    for (let y = 0; y < crop.side; y += 1) for (let x = 0; x < crop.side; x += 1) {
      const rgb = BYTES[pixels[(crop.y + y) * size + crop.x + x]!] ?? BYTES[0]!; const at = (y * crop.side + x) * 4;
      image.data[at] = rgb[0]; image.data[at + 1] = rgb[1]; image.data[at + 2] = rgb[2]; image.data[at + 3] = 255;
    }
    context.putImageData(image, 0, 0);
  }, [pixels, size, crop.x, crop.y, crop.side]);
  return <canvas ref={canvas} className="chronicle-map-canvas" width={crop.side} height={crop.side} role="img" aria-label={label} />;
}

function FramedMap({ pixels, size, crop, frame, scale, label, caption, testId }: {
  readonly pixels: Uint8Array; readonly size: number; readonly crop: MapCrop; readonly frame: "large" | "small"; readonly scale: number;
  readonly label: string; readonly caption: string; readonly testId: string;
}) {
  const art = FRAME[frame]; const kind = WAVE19_FRAME_KIND[art.id];
  const box = frameToken(kind).size.width * scale;
  return (
    <figure className="chronicle-map" data-map={testId} style={{ width: box }}>
      <div className="chronicle-map-box" data-frame={kind} style={{ width: box, height: box, ...frameBoxStyle(kind, scale) }}>
        <div className="chronicle-map-inner" style={frameContentStyle()}>
          <SnapshotCanvas pixels={pixels} size={size} crop={crop} label={label} />
        </div>
        <span className="chronicle-map-frame" aria-hidden="true" style={wave19FrameLayerStyle(art.id, scale)} />
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function SnapshotMapView({ state, snapshot, compare, compact }: {
  readonly state: GameState; readonly snapshot: SnapshotRef | null; readonly compare: boolean; readonly compact: boolean;
}) {
  // why: a snapshot decodes from the ledger by its id; no other part of the state changes it
  const then = useMemo(() => snapshot === null ? null : history.snapshot(state, snapshot.id), [state.history, snapshot?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Today's map at the thumbnail's size, only while it is shown (a 256² raster of the whole map: a few ms).
  const now = useMemo(() => !compare || then === null ? null : decodeSnapshot(rasterizeSnapshot(state, "now", then.size === 256 ? 256 : 128)),
    // why: today's raster, redrawn when the tick moves (time stands still while the chronicle is open: once per opening)
    [compare, then, state.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const present = useMemo(() => {
    if (then === null) return [];
    const seen = new Set<number>(); for (const value of then.pixels) seen.add(value);
    return SNAPSHOT_PALETTE.map((cell, index) => ({ cell, index })).filter(entry => seen.has(entry.index));
  }, [then]);
  const crop = useMemo(() => then === null ? null : now === null ? settlementCrop(then.size, then.pixels) : settlementCrop(then.size, then.pixels, now), [then, now]);
  if (snapshot === null || then === null || crop === null) return <p className="chronicle-map-none">{COPY.mapNone}</p>;
  const date = chronicleDate(state, then.tick);
  return (
    <div className="chronicle-maps" data-compare={compare ? "true" : undefined} data-snapshot={snapshot.id} data-snapshot-size={then.size}>
      <div className="chronicle-map-pair">
        <FramedMap pixels={then.pixels} size={then.size} crop={crop} frame={compare || compact ? "small" : "large"} scale={compare ? 1.5 : 1} testId="then"
          label={COPY.mapHeading(date)} caption={COPY.mapHeading(date)} />
        {now === null ? null : <FramedMap pixels={now} size={then.size} crop={crop} frame="small" scale={1.5} testId="now"
          label={COPY.mapNowHeading(chronicleDate(state, state.tick))} caption={COPY.mapNowHeading(chronicleDate(state, state.tick))} />}
      </div>
      <ul className="chronicle-map-legend">
        {present.map(entry => <li key={entry.cell}><span aria-hidden="true" style={{ backgroundColor: SNAPSHOT_COLOURS[entry.cell] }} />{COPY.mapLegendItems[entry.index]}</li>)}
      </ul>
    </div>
  );
}
