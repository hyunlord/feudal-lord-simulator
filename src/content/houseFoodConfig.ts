export const HOUSE_FOOD_INTERVAL = 400;

export function houseFoodRation(house: { readonly residents?: number }): number {
  return Math.ceil(Math.max(0, house.residents ?? 0) / 8);
}

export function houseBreadCapacity(house: { readonly residents?: number }): number {
  return Math.max(3, houseFoodRation(house) * 3);
}
