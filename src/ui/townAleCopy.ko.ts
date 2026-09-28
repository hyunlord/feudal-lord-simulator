// ECON-UI (engine FIX-7 `townAle`, AL-10): the town's ale on the ledger drawer, the stores and the season card.
export const TOWN_ALE_COPY = {
  heading: "도시의 에일",
  stock: (casks: number, inAlehouses: number) => `에일 ${casks}통 · 그중 에일집 ${inAlehouses}통`,
  houses: (brewing: number, alehouses: number) => `빚는 집 ${brewing}채 · 에일집 ${alehouses}채`,
  served: (served: number, drinking: number, need: number) => `에일을 누린 집 ${served}/${drinking}채 · 한 계절에 ${need}통 필요`,
  season: (brewed: number, drunk: number, sold: number) => `빚음 ${brewed}통 · 마심 ${drunk}통 · 에일집에서 삼 ${sold}통`,
  thisSeason: (line: string) => `이번 계절: ${line}`,
  lastSeason: (line: string) => `지난 계절: ${line}`,
  /** The stores' card: ale is kept in the houses, never in a store. */
  inHouses: (casks: number, inAlehouses: number) => `에일은 집 안에 둡니다 — 도시에 ${casks}통, 그중 에일집 ${inAlehouses}통`,
  /** The season card: the season just closed. */
  closedSeason: (line: string) => `이 계절 에일: ${line}`,
} as const;
