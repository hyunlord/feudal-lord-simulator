/**
 * v28 is FIX-8 (decision FX8-1, spec `docs/design/ale-chain.md` AL-12): malt goes to the storehouse, no longer to the
 * granary. The malt a v27 granary holds is carried to the storehouses (id order, each to its free room); what does not
 * fit stays in the granary, where the brewsters take theirs first. The shape of the state is unchanged.
 */
type Stock = Record<string, number | undefined>;
type SavedBuilding = { readonly id: string; readonly kind: string; readonly inventory?: Stock; readonly reserved?: Stock };

/** A storehouse's room at v28 (`storageCapacity`), fixed here so the step does not move with later balance. */
const STOREHOUSE_ROOM = 200;

const total = (stock: Stock | undefined): number => Object.values(stock ?? {}).reduce<number>((sum, amount) => sum + Math.max(0, amount ?? 0), 0);

export function migrateV27ToV28(input: unknown): unknown {
  if (typeof input !== "object" || input === null) throw new TypeError("Schema v27 save must be an envelope object");
  const envelope = input as { readonly state?: unknown };
  if (typeof envelope.state !== "object" || envelope.state === null) throw new TypeError("Schema v27 save has no state");
  const state = envelope.state as { readonly buildings?: readonly SavedBuilding[] };
  const buildings = [...(state.buildings ?? [])];
  let malt = buildings.filter(building => building.kind === "granary").reduce((sum, building) => sum + Math.max(0, building.inventory?.malt ?? 0), 0);
  if (malt === 0) return { ...envelope, schemaVersion: 28 };
  const stores = buildings.map((building, at) => ({ building, at })).filter(({ building }) => building.kind === "storehouse")
    .sort((a, b) => a.building.id.localeCompare(b.building.id));
  let moved = 0;
  for (const { building, at } of stores) {
    const take = Math.min(malt, Math.max(0, STOREHOUSE_ROOM - total(building.inventory) - total(building.reserved)));
    if (take === 0) continue;
    buildings[at] = { ...building, inventory: { ...building.inventory, malt: (building.inventory?.malt ?? 0) + take } };
    malt -= take;
    moved += take;
  }
  // Take the moved malt out of the granaries in id order.
  const granaries = buildings.map((building, at) => ({ building, at })).filter(({ building }) => building.kind === "granary")
    .sort((a, b) => a.building.id.localeCompare(b.building.id));
  for (const { building, at } of granaries) {
    const held = Math.max(0, building.inventory?.malt ?? 0);
    const take = Math.min(held, moved);
    if (take === 0) continue;
    const { malt: _malt, ...rest } = building.inventory ?? {};
    buildings[at] = { ...building, inventory: held - take > 0 ? { ...rest, malt: held - take } : rest };
    moved -= take;
  }
  return { ...envelope, schemaVersion: 28, state: { ...state, buildings } };
}
