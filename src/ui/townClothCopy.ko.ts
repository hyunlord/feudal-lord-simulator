import { moneyShort } from "./money.ko";

// C5 (CL-10 API townCloth): the town's cloth chain on the ledger drawer and the season card.
export const TOWN_CLOTH_COPY = {
  heading: "도시의 직물",
  sheep: (count: number, cells: number) => `양 ${count}마리 · 목초지 ${cells}칸`,
  spinningHouses: (count: number) => `실 잣는 집 ${count}채`,
  buildingCount: (name: string, count: number) => `${name} ${count}동`,
  buildingsLine: (parts: readonly string[]) => parts.join(" · "),
  /** The season card's line: the closed season's cloth money by its ledger categories' own names. */
  closedSeason: (parts: readonly (readonly [label: string, amount: number])[]) =>
    `이 계절 직물 수입: ${parts.map(([label, amount]) => `${label} +${moneyShort(amount)}`).join(" · ")}`,
} as const;
