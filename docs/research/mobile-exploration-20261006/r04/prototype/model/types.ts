export const AXES = ['agriculture', 'trade', 'craft', 'military', 'faith', 'scholarship', 'maritime', 'diplomacy'] as const;
export const TERRAINS = ['river', 'coast', 'mountain', 'forest', 'marsh'] as const;
export const RESOURCES = ['food', 'materials', 'tools', 'coin'] as const;
export type Axis = typeof AXES[number];
export type Terrain = typeof TERRAINS[number];
export type Resource = typeof RESOURCES[number];
export type Policy = Record<Axis, number>;
export type Stocks = Record<Resource, number>;
export type Tile = { readonly x: number; readonly y: number; readonly water: boolean; readonly elevation: number; readonly fertility: number; readonly wood: number; road: boolean };
export type Facility = { readonly id: number; readonly axis: Axis; readonly x: number; readonly y: number; workers: number; hp: number };
export type Household = { readonly id: number; people: number; readonly x: number; readonly y: number; readonly skills: Record<Axis, number>; facilityId: number | null };
export type Candidate = { readonly axis: Axis; readonly x: number; readonly y: number; readonly score: number; readonly reasons: Readonly<Record<string, number>> };
export type Receipt = { readonly tick: number; readonly householdId: number; readonly chosen: Candidate | null; readonly alternatives: readonly Candidate[]; readonly reason: string; readonly costs: Readonly<Stocks>; readonly policy: Readonly<Policy> };
export type LedgerEntry = { readonly tick: number; readonly account: 'city' | 'market'; readonly resource: Resource; readonly amount: number; readonly reason: string };
export type Booking = { readonly resource: Resource; readonly amount: number; readonly reason: string; readonly account?: 'city' | 'market' };
// City is deliberately a mutable deterministic simulation accumulator. Clone before forecasting.
export type City = {
 readonly seed: number; rng: number; readonly terrain: Terrain; tick: number; policy: Policy;
 stocks: Stocks; externalMarket: Stocks; readonly initialStocks: Readonly<Stocks>; readonly initialMarket: Readonly<Stocks>;
 households: Household[]; facilities: Facility[]; tiles: Tile[]; ledger: LedgerEntry[]; receipts: Receipt[];
 services: { knowledge: number; care: number; influence: number; transport: number; training: number };
 mobilized: number; migrantsRemaining: number; starvation: number;
};
