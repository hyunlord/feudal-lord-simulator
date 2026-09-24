import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../geometry/tileGeometry";
import { boundaryHash, boundsOf, hashNumbers, type BoundaryBounds, type BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { zoneBoundaryLayout, type ZoneBoundaryLayout } from "../world/boundary/zoneBoundaries";
import type { Tile } from "../world/world.types";
import { zonesOf } from "../zones/zoneEdits";
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

export type ZoneLayerZone = { readonly id: string; readonly kind: ZoneKind; readonly bounds: BoundaryBounds };
export type ParcelEdge = { readonly a: BoundaryPoint; readonly b: BoundaryPoint; readonly built: boolean };
export type FrontageMark = { readonly cell: TileCoordinate; readonly toward: BoundaryPoint; readonly built: boolean };
export type ZoneProp = {
  readonly kind: "orchard_tree" | "orchard_apple_c" | "haycock_a" | "haycock_b";
  /** Ground anchor in tile-centre coordinates. */
  readonly x: number; readonly y: number;
  readonly flip: boolean; readonly scale: number; readonly id: string;
};

export type ZoneLayer = {
  readonly zones: readonly ZoneLayerZone[];
  readonly outlines: ZoneBoundaryLayout;
  readonly parcelEdges: readonly ParcelEdge[];
  readonly frontage: readonly FrontageMark[];
  readonly props: readonly ZoneProp[];
  /** Changes whenever anything above changes (chunk content keys). */
  readonly signature: number;
};

export const EMPTY_ZONE_LAYER: ZoneLayer = { zones: [], outlines: { chains: [], rings: [] }, parcelEdges: [], frontage: [], props: [], signature: 0 };

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
  const layerZones = zones.map((zone, index) => ({ id: zone.id, kind: zone.kind,
    bounds: boundsOf((outlines.rings[index] ?? []).flat(), 0) }));

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
  zones.forEach((zone, label) => {
    if (zone.kind === "orchard") {
      for (const index of zone.membership) {
        if (!free(index)) continue;
        const tx = index % width; const ty = Math.floor(index / width);
        const hash = boundaryHash(index, state.seed, 41);
        // Quincunx rows: every row, trees half a tile apart from the row above; edge cells keep 45%, inner 90%.
        const keep = (hash % 1000) / 1000;
        if (keep >= (edgeCell(index, label) ? 0.45 : 0.9)) continue;
        const jitter = (salt: number): number => ((boundaryHash(index, state.seed, salt) % 1000) / 1000 - 0.5) * 0.24;
        const x = tx + (ty % 2 === 0 ? -0.2 : 0.2) + jitter(43); const y = ty + jitter(47);
        const variant = boundaryHash(index, state.seed, 53) % 5;
        props.push({ kind: variant < 2 ? "orchard_apple_c" : "orchard_tree", x, y, flip: variant === 3, scale: 0.92 + ((hash >>> 10) % 16) / 100, id: `zone-prop:${zone.id}:${index}` });
      }
    } else if (zone.kind === "pasture") {
      const inner = zone.membership.filter(index => free(index) && !edgeCell(index, label));
      const pool = inner.length > 0 ? inner : zone.membership.filter(free);
      const count = Math.min(pool.length, 1 + boundaryHash(zone.createdOrdinal, state.seed, 59) % 3, Math.ceil(zone.membership.length / 6));
      const chosen = [...pool].sort((a, b) => boundaryHash(a, state.seed, 61) - boundaryHash(b, state.seed, 61) || a - b).slice(0, count);
      for (const index of chosen) {
        const tx = index % width; const ty = Math.floor(index / width);
        props.push({ kind: boundaryHash(index, state.seed, 67) % 2 === 0 ? "haycock_a" : "haycock_b", x: tx, y: ty + 0.1, flip: false, scale: 1, id: `zone-prop:${zone.id}:${index}` });
      }
    }
  });
  const signature = hashNumbers([
    ...zones.flatMap((zone, index) => [index, zone.kind.length, zone.membership.length, hashNumbers(zone.membership)]),
    ...outlines.chains.map(chain => chain.hash),
    ...parcelEdges.flatMap(edge => [edge.a.x, edge.a.y, edge.b.x, edge.b.y, edge.built ? 1 : 0]),
    ...frontage.flatMap(mark => [mark.cell.tx, mark.cell.ty, mark.toward.x, mark.toward.y, mark.built ? 1 : 0]),
  ]);
  return { zones: layerZones, outlines, parcelEdges, frontage, props, signature };
}
