import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../geometry/tileGeometry";
import { boundaryHash, boundsOf, hashNumbers, type BoundaryBounds, type BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { zoneBoundaryLayout, type ZoneBoundaryLayout } from "../world/boundary/zoneBoundaries";
import type { Tile } from "../world/world.types";
import { zonesOf } from "../zones/zoneEdits";
import { arableStripStates } from "../zones/arableStrips";
import { arableField, type ArableField, type FurrowStamp } from "../world/boundary/arableFields";
import { ZONE_VARIANTS, type ZoneAssetKey, type ZonePropKind } from "./zoneAssetManifest";
import { burgageParcels } from "../zones/zoneFillAgent";
import type { Zone, ZoneKind } from "../zones/zone.types";

// Everything the zone layer draws (C1b), derived from the saved zones and the ground (nothing here is saved or read by
// rules). Built once per ground scene (groundBoundaryScene key: tiles identity, palisade, seed, farms, and the zone
// signature below), and pure, so the same state always gives the same outlines, plot lines and props.
//  - Outlines: zoneBoundaries (shared edges; two zones never draw a double line).
//  - Plots: burgageParcels (the engine's derivation) -> the tile edges between two plots, and one mark on every
//    frontage cell's road side. Plots with a house draw their lines lighter.
//  - Props: orchard trees on a quincunx planting grid with limited jitter, thinned on the zone edge; 1-3 haycocks per
//    pasture zone on interior cells. Only on grass cells with no road or building.
//  - Variants (C1e, spec 6: position hash + deterministic near rejection): a zone's floor (pasture 3, orchard 2, arable
//    soil 2) differs from every same-family zone within VARIANT_REPEAT_RADIUS when one is free, and starts at its own
//    offset; haycocks (6) never repeat within that radius (a haycock with no free variant is dropped); orchard trees
//    (5, planted one per cell) never repeat among their planting neighbours (1.5 tiles). Trees are real variants and
//    are no longer mirrored (spec 5).
//  - Arable fields (C1e): ridge strips along the engine's strip read model, see world/boundary/arableFields.

/** `hash` covers the kind, the floor, every ring point and the arable layout: a zone's fill is one path, so any change to it re-rasters its chunks. */
export type ZoneLayerZone = { readonly id: string; readonly kind: ZoneKind; readonly bounds: BoundaryBounds;
  /** Floor texture variant (null: the kind's flat tone) and its offset in tiles. */
  readonly floor: ZoneAssetKey | null; readonly floorOffset: BoundaryPoint; readonly hash: number };
export type ParcelEdge = { readonly a: BoundaryPoint; readonly b: BoundaryPoint; readonly built: boolean };
export type FrontageMark = { readonly cell: TileCoordinate; readonly toward: BoundaryPoint; readonly built: boolean };
export type ZoneProp = {
  readonly kind: ZonePropKind | "hurdle_straight" | "hurdle_end_corner";
  /** Ground anchor in tile-centre coordinates. */
  readonly x: number; readonly y: number;
  readonly flip: boolean; readonly scale: number; readonly id: string;
  /** Draw order key when the anchor is not the prop's depth (fence panels: their middle). */
  readonly depth?: number;
};

/** One arable strip run in a zone (for chunk keys: its crop state is read every frame, not stored here). */
export type ZoneArableBand = { readonly zoneIndex: number; readonly stripId: string; readonly bounds: BoundaryBounds };

export const VARIANT_REPEAT_RADIUS = 4;
const TREE_NEIGHBOUR_RADIUS = 1.5;

export type ZoneLayer = {
  readonly zones: readonly ZoneLayerZone[];
  readonly outlines: ZoneBoundaryLayout;
  readonly parcelEdges: readonly ParcelEdge[];
  readonly frontage: readonly FrontageMark[];
  readonly props: readonly ZoneProp[];
  /** Arable layout per zone (null for other kinds), and every drawn strip run. */
  readonly fields: readonly (ArableField | null)[];
  readonly arableBands: readonly ZoneArableBand[];
  /** Changes whenever anything above changes (chunk content keys). */
  readonly signature: number;
};

export const EMPTY_ZONE_LAYER: ZoneLayer = { zones: [], outlines: { chains: [], rings: [] }, parcelEdges: [], frontage: [], props: [], fields: [], arableBands: [], signature: 0 };

const FLOOR_FAMILY: Partial<Record<ZoneKind, readonly ZoneAssetKey[]>> = {
  pasture: ZONE_VARIANTS.pastureFloor, orchard: ZONE_VARIANTS.orchardFloor, arable: ZONE_VARIANTS.soil,
};

function boundsGap(a: BoundaryBounds, b: BoundaryBounds): number {
  return Math.hypot(Math.max(0, a.left - b.right, b.left - a.right), Math.max(0, a.top - b.bottom, b.top - a.bottom));
}

/** Part of the ground scene key: kinds, ordinals and membership of every zone. */
export function zoneSignature(zones: readonly Zone[]): string {
  return zones.map(zone => `${zone.id}:${zone.kind}:${zone.membership.length}:${hashNumbers(zone.membership)}`).join("|");
}

export function buildZoneLayer(state: GameState, cells: readonly (Tile | undefined)[]): ZoneLayer {
  const zones = [...zonesOf(state)].sort((a, b) => a.createdOrdinal - b.createdOrdinal);
  if (zones.length === 0) return EMPTY_ZONE_LAYER;
  const { width, height } = state;
  const labels = new Int32Array(width * height).fill(-1);
  zones.forEach((zone, index) => { for (const cell of zone.membership) if (cell >= 0 && cell < labels.length) labels[cell] = index; });
  const outlines = zoneBoundaryLayout({ width, height, labels, zoneCount: zones.length });
  const placedStamps: FurrowStamp[] = [];
  const fields = zones.map(zone => zone.kind !== "arable" ? null : arableField({ zoneId: zone.id, zoneOrdinal: zone.createdOrdinal,
    layout: arableStripStates(zone, state), mapWidth: width, mapHeight: height, cells, seed: state.seed, placedStamps }));
  const floors: { readonly key: ZoneAssetKey | null; readonly bounds: BoundaryBounds }[] = [];
  const layerZones = zones.map((zone, index) => {
    const bounds = boundsOf((outlines.rings[index] ?? []).flat(), 0);
    const family = FLOOR_FAMILY[zone.kind];
    const hash = boundaryHash(zone.createdOrdinal, state.seed, 79);
    let floor: ZoneAssetKey | null = null;
    if (family !== undefined) {
      const near = new Set(floors.filter(other => other.key !== null && family.includes(other.key) && boundsGap(other.bounds, bounds) < VARIANT_REPEAT_RADIUS).map(other => other.key));
      const first = hash % family.length;
      floor = family[first] as ZoneAssetKey;
      for (let tried = 0; tried < family.length; tried += 1) {
        const option = family[(first + tried) % family.length] as ZoneAssetKey;
        if (!near.has(option)) { floor = option; break; }
      }
    }
    floors.push({ key: floor, bounds });
    const floorOffset = { x: ((hash >>> 8) % 8) * 0.25, y: ((hash >>> 11) % 8) * 0.25 };
    return { id: zone.id, kind: zone.kind, bounds, floor, floorOffset,
      hash: hashNumbers([zone.kind.length * 31 + zone.kind.charCodeAt(0), floor === null ? -1 : floor.length * 31 + floor.charCodeAt(floor.length - 1),
        floorOffset.x, floorOffset.y, fields[index]?.hash ?? 0,
        ...(outlines.rings[index] ?? []).flatMap(ring => [ring.length, ...ring.flatMap(point => [point.x, point.y])])]) };
  });
  const arableBands: ZoneArableBand[] = fields.flatMap((field, zoneIndex) => field === null ? [] : field.bands.map(band => ({ zoneIndex, stripId: band.stripId, bounds: band.bounds })));

  const parcels = burgageParcels(state);
  const plotOf = new Int32Array(width * height).fill(-1);
  parcels.forEach((parcel, index) => { for (const cell of parcel.cells) plotOf[cell.ty * width + cell.tx] = index; });
  const built = parcels.map(parcel => parcel.buildingIds.length > 0);
  const parcelEdges: ParcelEdge[] = [];
  for (let ty = 0; ty < height; ty += 1) for (let tx = 0; tx < width; tx += 1) {
    const plot = plotOf[ty * width + tx] as number;
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      const nx = tx + dx; const ny = ty + dy;
      if (nx >= width || ny >= height) continue;
      const other = plotOf[ny * width + nx] as number;
      // Only lines between two plots, or between a plot and plot-less ground of the same zone (the zone outline
      // already draws every zone boundary).
      if (plot === other || (plot < 0 && other < 0)) continue;
      if (labels[ty * width + tx] !== labels[ny * width + nx]) continue;
      const a = dx === 1 ? { x: tx + 0.5, y: ty - 0.5 } : { x: tx - 0.5, y: ty + 0.5 };
      const b = dx === 1 ? { x: tx + 0.5, y: ty + 0.5 } : { x: tx + 0.5, y: ty + 0.5 };
      parcelEdges.push({ a, b, built: (plot >= 0 && built[plot] === true) && (other < 0 || built[other] === true) });
    }
  }
  const frontage: FrontageMark[] = [];
  parcels.forEach((parcel, index) => {
    for (const cell of parcel.frontageCells) {
      const road = [[0, -1], [1, 0], [0, 1], [-1, 0]].find(([dx, dy]) => {
        const tile = cells[(cell.ty + (dy as number)) * width + cell.tx + (dx as number)];
        return cell.tx + (dx as number) >= 0 && cell.tx + (dx as number) < width && tile?.hasRoad === true;
      });
      if (road !== undefined) frontage.push({ cell, toward: { x: road[0] as number, y: road[1] as number }, built: built[index] === true });
    }
  });

  const free = (index: number): boolean => {
    const tile = cells[index];
    return tile !== undefined && tile.terrain === "grass" && !tile.hasRoad && tile.buildingId === null;
  };
  const edgeCell = (index: number, label: number): boolean => {
    const tx = index % width; const ty = Math.floor(index / width);
    return [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => {
      const nx = tx + (dx as number); const ny = ty + (dy as number);
      return nx < 0 || ny < 0 || nx >= width || ny >= height || labels[ny * width + nx] !== label;
    });
  };
  const props: ZoneProp[] = [];
  const haycocks: ZoneProp[] = [];
  const treeVariants = new Map<string, number>();
  zones.forEach((zone, label) => {
    if (zone.kind === "orchard") {
      const family = ZONE_VARIANTS.orchardTree;
      for (const index of zone.membership) {
        if (!free(index)) continue;
        const tx = index % width; const ty = Math.floor(index / width);
        const hash = boundaryHash(index, state.seed, 41);
        // Quincunx rows: every row, trees half a tile apart from the row above; edge cells keep 45%, inner 90%.
        const keep = (hash % 1000) / 1000;
        if (keep >= (edgeCell(index, label) ? 0.45 : 0.9)) continue;
        const jitter = (salt: number): number => ((boundaryHash(index, state.seed, salt) % 1000) / 1000 - 0.5) * 0.24;
        const x = tx + (ty % 2 === 0 ? -0.2 : 0.2) + jitter(43); const y = ty + jitter(47);
        // Planting neighbours (membership is row-major, so the ones already placed are west and north).
        const near = new Set<number>();
        for (let dy = -2; dy <= 0; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
          const other = treeVariants.get(`${tx + dx},${ty + dy}`);
          const otherProp = other === undefined ? undefined : props[other >> 3];
          if (other !== undefined && otherProp !== undefined && Math.hypot(otherProp.x - x, otherProp.y - y) < TREE_NEIGHBOUR_RADIUS) near.add(other & 7);
        }
        const first = boundaryHash(index, state.seed, 53) % family.length;
        let variant = first;
        for (let tried = 0; tried < family.length; tried += 1) {
          const option = (first + tried) % family.length;
          if (!near.has(option)) { variant = option; break; }
        }
        treeVariants.set(`${tx},${ty}`, (props.length << 3) | variant);
        props.push({ kind: family[variant] as ZonePropKind, x, y, flip: false, scale: 0.92 + ((hash >>> 10) % 16) / 100, id: `zone-prop:${zone.id}:${index}` });
      }
    } else if (zone.kind === "pasture") {
      const family = ZONE_VARIANTS.haycock;
      const inner = zone.membership.filter(index => free(index) && !edgeCell(index, label));
      const pool = inner.length > 0 ? inner : zone.membership.filter(free);
      const count = Math.min(pool.length, 1 + boundaryHash(zone.createdOrdinal, state.seed, 59) % 3, Math.ceil(zone.membership.length / 6));
      const chosen = [...pool].sort((a, b) => boundaryHash(a, state.seed, 61) - boundaryHash(b, state.seed, 61) || a - b).slice(0, count);
      for (const index of chosen) {
        const tx = index % width; const ty = Math.floor(index / width);
        const at = { x: tx, y: ty + 0.1 };
        const near = new Set(haycocks.filter(other => Math.hypot(other.x - at.x, other.y - at.y) < VARIANT_REPEAT_RADIUS).map(other => other.kind));
        const first = boundaryHash(index, state.seed, 67) % family.length;
        let kind: ZonePropKind | null = null;
        for (let tried = 0; tried < family.length; tried += 1) {
          const option = family[(first + tried) % family.length] as ZonePropKind;
          if (!near.has(option)) { kind = option; break; }
        }
        if (kind === null) continue;
        const prop: ZoneProp = { kind, x: at.x, y: at.y, flip: false, scale: 1, id: `zone-prop:${zone.id}:${index}` };
        haycocks.push(prop);
        props.push(prop);
      }
    }
  });
  const signature = hashNumbers([
    ...zones.flatMap((zone, index) => [index, zone.kind.length, zone.membership.length, hashNumbers(zone.membership), layerZones[index]?.hash ?? 0]),
    ...outlines.chains.map(chain => chain.hash),
    ...parcelEdges.flatMap(edge => [edge.a.x, edge.a.y, edge.b.x, edge.b.y, edge.built ? 1 : 0]),
    ...frontage.flatMap(mark => [mark.cell.tx, mark.cell.ty, mark.toward.x, mark.toward.y, mark.built ? 1 : 0]),
  ]);
  return { zones: layerZones, outlines, parcelEdges, frontage, props, fields, arableBands, signature };
}
