import { LORD_HOUSE_NAMES_KO } from "../content/historyCopy.ko";

// UI-6: the ledger drawer's rights tab — the ruling house and its arms, the lord's title, the three rights (FAIL-3
// FL-1…FL-8) and, in the war (F2-A), the Crown's favour, the men away and the ring's defence.
// UI-9: 4장 권리 이양 (RG-7) — market_tolls and bridge_tolls granted to the town via borough_charter.
const house = (name: string) => LORD_HOUSE_NAMES_KO[name] ?? name;
// UI-9: localised names for the rights the town receives in chapter 4.
const RIGHTS_TRANSFER_NAMES: Readonly<Record<string, string>> = {
  market_tolls: "시장 좌판세", bridge_tolls: "통행세 절반",
};
export const LORDSHIP_COPY = {
  tab: "권리",
  heading: "영주 권리 등록부",
  house: (name: string, order: number, sinceYear: number) => `${house(name)} 가문 · ${order}대째 가문 · ${sinceYear}년부터`,
  houseArms: (name: string) => `${house(name)} 가문의 문장`,
  /** UI-10 (F5-A LG-1): the family left the manor after the charter (towns without a keep read it here). */
  countrySeat: (name: string, year: number) => `${house(name)} 가문은 ${year}년부터 시골 장원에 삽니다 — 영주관은 비었습니다`,
  pastHouses: (names: readonly string[]) => `앞선 가문: ${names.map(house).join(" · ")}`,
  titles: { manor: "장원 영주", market: "시장도시 영주", borough: "자치도시 영주" } as Readonly<Record<string, string>>,
  title: (rank: string) => `칭호: ${LORDSHIP_COPY.titles[rank] ?? rank}`,
  demoted: (base: string) => `강등됨 — 본래 ${LORDSHIP_COPY.titles[base] ?? base}`,
  rightsHeading: "영주의 권리",
  status: { held: "지님", suspended: "상위 영주가 맡음", seized: "상인들이 가져감" } as Readonly<Record<string, string>>,
  absent: "도시에 아직 없음",
  since: (year: number) => `${year}년부터`,
  grantedHeading: "영주가 준 권리",
  decline: (cause: string) => `쇠퇴 중 — ${cause} 영지가 기울었습니다. 원인이 풀리면 권리를 되사자는 청원이 옵니다`,
  warHeading: "전쟁",
  favour: (held: boolean) => held ? "왕실의 신임: 있음" : "왕실의 신임: 잃음(조달 면허·성벽세 없음)",
  away: (men: number) => `징집되어 떠난 사람 ${men}명`,
  awayUntil: (men: number, year: number, season: string) => `징집되어 떠난 사람 ${men}명 · ${year}년 ${season}에 돌아옵니다`,
  defence: (percent: number, closed: boolean) => closed ? `성벽의 방어 ${percent} %` : "성벽에 틈이 있어 방어 0 %",
  seasonDeclined: (cause: string, right: string | null, byOverlord: boolean) =>
    `영지가 쇠퇴했습니다 — ${cause} ${right === null ? "잃은 권리 없이" : `${right}${byOverlord ? "를 상위 영주가 맡았고" : "를 상인들이 가져갔고"}`} 칭호가 강등되었습니다`,
  seasonHouse: (withdrew: string, arrived: string) => `${house(withdrew)} 가문이 물러나고 ${house(arrived)} 가문이 영지를 맡았습니다`,
  seasonAway: (men: number) => `징집되어 떠나 있는 사람 ${men}명`,
  // UI-9: RG-7 rights-transfer section (rights held by the town from ch4).
  rightsTransferHeading: "4장 권리 이양",
  rightsTransferLine: (id: string, year: number) =>
    `${RIGHTS_TRANSFER_NAMES[id] ?? id} → 도시 · ${year}년 자치 특허`,
  /** RG-9: the fee farm is the town's duty for the rights, not a right (decision RG6). */
  feeFarmLine: (pence: number) => `도시가 해마다 봄에 영주에게 ${pence}d를 냅니다(fee farm) — 권리가 아니라 넘긴 권리의 대가`,
  /** A lord's right the charter passed to the town (the market's stall tax, half the tolls). */
  passedToTown: (year: number, half: boolean) => `${half ? "절반을 " : ""}도시로 넘김 · ${year}년`,
} as const;
