import type { GameState } from '../engine/engine.types';
import { stateCalendar } from '../engine/scenarioState';
import { lordMode } from '../engine/townAgency';
import { tradesOf } from '../engine/trades';
import type { TileCoordinate } from '../geometry/tileGeometry';
import { canTraverseWallBoundary } from '../world/wallTraversal';
import { backyardLayout, backyardPlan, yardBackRow, yardBackSides, yardHash } from './backyardDecals';
import { doorSignFront, doorSignPlan } from './doorSigns';
import { villageLifeCells } from './villageLife';
import { yardDecalRect } from './drawBackyardDecals';
import { ART_REGISTRY } from './art/wave42Registry';
import { tradeWorldGroundEntries } from './tradeWorldArt';
import { tradeWatersideCells, tradeWaterCellBlocked } from './tradeWorldWaterAccess';
import { tradeGroundReservations, tradePropCells, tradePropBox, boxesOverlap, tradeSourceSpaceAllows } from './tradeWorldPlacement';

export type TradeWorldProp = {
  readonly id: string; readonly buildingId: string; readonly assetId: string;
  readonly consumer: 'front' | 'yard' | 'street'; readonly x: number; readonly y: number;
  readonly cell: TileCoordinate; readonly cells: readonly TileCoordinate[];
};
/** Source archetypes describe the drawing, not a replacement for the household's engine workshop. */
export function tradeWorldGroundProps(state: GameState): readonly TradeWorldProp[] {
  if (!lordMode(state)) return [];
  const season = stateCalendar(state).season === 3 ? 'winter' : 'summer';
  const trades = tradesOf(state);
  if (trades.households.length === 0) return [];
  const houses = new Map(state.houses.map(house => [house.buildingId, house]));
  const buildings = new Map(state.buildings.map(building => [building.id, building]));
  const yards = backyardLayout(state);
  const reserved = tradeGroundReservations(state, yards);
  const life = villageLifeCells(state);
  for (const at of life) reserved.add(at);
  for (const sign of doorSignPlan(state)) reserved.add(sign.cell.ty * state.width + sign.cell.tx);
  const result: TradeWorldProp[] = [];
  const markedStreets = new Set<string>();
  const boxes: ReturnType<typeof tradePropBox>[] = backyardPlan(state).map(yardDecalRect);
  for (const household of [...trades.households].sort((a, b) => a.houseId.localeCompare(b.houseId))) {
    const building = buildings.get(household.houseId), house = houses.get(household.houseId);
    if (building === undefined || house === undefined || house.residents <= 0 || house.abandonedTick !== undefined || house.burntTick !== undefined) continue;
    const front = doorSignFront(state, building);
    const ownYard = yards.find(yard => yard.buildingId === building.id);
    const namedStreet = trades.streets.some(street => street.tradeId === household.tradeId && street.houseIds.includes(building.id));
    const slots = new Set<string>();
    for (const candidate of tradeWorldGroundEntries) {
      if (!candidate.occupations.includes(household.tradeId) || (candidate.season !== undefined && candidate.season !== season)) continue;
      // Fuller's water_mill fact exists; these authored races and supports lack a verified fit to the painted river.
      if (candidate.archetypes.some(kind => kind === 'water_power')) continue;
      const consumer = candidate.id.startsWith('street_') ? 'street' : candidate.id.startsWith('front_') ? 'front' : 'yard';
      if (slots.has(consumer) || (consumer === 'street' && (!namedStreet || markedStreets.has(household.tradeId)))) continue;
      const entry = ART_REGISTRY.select('ground-prop', `rb-trade-${consumer}`, {
        occupation: household.tradeId, archetype: candidate.archetypes[0], placement: candidate.placement, season,
      }, yardHash(`${building.id}|${consumer}`, 73));
      if (entry === null || entry.kind !== 'ground-prop' || entry.placement === 'land' || !('occupations' in entry)) continue;
      const back = entry.placement === 'back-yard' || entry.placement === 'yard';
      const waterside = entry.archetypes.includes('waterside_workshop');
      const cells = waterside ? tradeWatersideCells(state, building) : back ? ownYard?.spill ?? [] : front === null ? [] : yardBackRow(building, front).flatMap(cell =>
        [-1, 1].map(side => ({ tx: cell.tx + (front.ty === 0 ? 0 : side), ty: cell.ty + (front.tx === 0 ? 0 : side) })));
      for (const cell of cells) {
        if (!tradeSourceSpaceAllows(state, entry, cell)) continue;
        const side = yardBackSides(state, building)[0];
        if (back && side !== undefined && (cell.tx - building.tx) * side.tx + (cell.ty - building.ty) * side.ty <= 0) continue;
        const occupied = tradePropCells(entry, cell);
        if (occupied.some(point => {
          const at = point.ty * state.width + point.tx, tile = state.tiles[at];
          return point.tx < 0 || point.ty < 0 || point.tx >= state.width || point.ty >= state.height || reserved.has(at)
            || tile === undefined || tile.terrain !== 'grass' || tile.hasRoad || tile.buildingId !== null
            || !canTraverseWallBoundary(state, cell, point) || (waterside && tradeWaterCellBlocked(state, point));
        })) continue;
        // Keep the whole reserved island connected to its house without crossing a wall.
        if (!canTraverseWallBoundary(state, building, cell)) continue;
        const box = tradePropBox(entry, cell);
        if (boxes.some(other => boxesOverlap(box, other))) continue;
        for (const point of occupied) reserved.add(point.ty * state.width + point.tx);
        boxes.push(box); slots.add(consumer);
        if (consumer === 'street') markedStreets.add(household.tradeId);
        result.push({ id: `trade:${consumer}:${building.id}`, buildingId: building.id, assetId: entry.id, consumer,
          x: cell.tx, y: cell.ty, cell, cells: occupied });
        break;
      }
    }
  }
  return result;
}
