import type { CarterWalker } from './walker.types';
import type { DeliveryStepInput } from './deliveryTypes';
export type MaterialActivity =
  | { readonly kind: 'dispatch'; readonly tick: number; readonly walker: CarterWalker }
  | { readonly kind: 'raw_home'; readonly tick: number; readonly homeId: string; readonly walkerId: string; readonly amount: number }
  | { readonly kind: 'wall_delivery'; readonly tick: number; readonly homeId: string; readonly walkerId: string; readonly wallId: string; readonly siteId: string; readonly amount: number }
  | { readonly kind: 'physical_return' | 'cancelled'; readonly tick: number; readonly homeId: string; readonly walkerId: string };
export function observeMaterialReturn(input: DeliveryStepInput, walker: CarterWalker): void {
  if (walker.cancellation !== null || !input.buildings.some(home => home.id === walker.homeBuildingId)) return;
  if (walker.mission === 'fetch' && walker.cargo?.resource === 'stone_raw') input.materialActivity?.({ kind: 'raw_home', tick: input.tick,
    homeId: walker.homeBuildingId, walkerId: walker.id, amount: walker.cargo.amount });
  input.materialActivity?.({ kind: 'physical_return', tick: input.tick, homeId: walker.homeBuildingId, walkerId: walker.id });
}
