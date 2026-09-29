// C5 (CL-10 API townCloth): the town's cloth chain on the ledger drawer and the season card.
export const TOWN_CLOTH_COPY = {
  heading: "도시의 직물",
  sheep: (count: number, cells: number) => `양 ${count}마리 · 목초지 ${cells}칸`,
  spinningHouses: (count: number) => `실 잣는 집 ${count}채`,
  buildingCount: (name: string, count: number) => `${name} ${count}동`,
  buildingsLine: (parts: readonly string[]) => parts.join(" · "),
  /** The season card's line: ulnage and fulling_toll from the closed season. */
  closedSeason: (ulnage: number, fullingToll: number) =>
    `이 계절 직물 수입: 직물 인장세 +${ulnage}d · 축융 사용료 +${fullingToll}d`,
} as const;
