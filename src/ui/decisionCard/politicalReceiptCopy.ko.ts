import { HOLDER_KO, LORD_RIGHT_NAMES } from "../../content/historyCopy.ko";
import { moneyShort } from "../money.ko";

// RECEIPTS-2 (user 2026-10-10): the receipt's words for what the famine's and the political petitions' answers change at
// once (politicalReceiptRows.ts): the merchants' gauge, a right granted, the lordship's decline and title, the war's
// favour, men, instalments, tax and wall, the curacy, the guild, chapter 5's sums, heir, mayor and legacy, the people and
// the lived-in homes. Words follow docs/design/glossary.md and the cards' own words for the same things
// (petitionCardCopy.ko.ts, decisionCopy.ko.ts, lordshipCopy.ko.ts).

const percent = (permille: number) => `${Math.round(permille / 10)}%`;

/** The rights an answer grants (politics.rights ids): the market charter, the commuted rent, chapter 4's and 5's. */
const RIGHT_NAMES: Readonly<Record<string, string>> = {
  market_charter: "시장권", commuted_rent: "화폐 지대", market_tolls: "시장 좌판세", bridge_tolls: "통행세 절반", mayoralty: "시장 선출권", borough_seal: "도시 인장",
};

export const POLITICAL_RECEIPT_COPY = {
  gauge: "상인 게이지",
  population: "인구",
  livedHouses: "사람이 사는 집",
  right: (id: string) => `권리: ${RIGHT_NAMES[id] ?? id}`,
  rightGranted: (holder: string, stallPermille: number | null) =>
    `${HOLDER_KO[holder] ?? holder}에게 줌${stallPermille === null ? "" : ` · 좌판세 평소의 ${percent(stallPermille)}`}`,
  rightTaken: (holder: string) => `${HOLDER_KO[holder] ?? holder}에게서 거둠`,
  title: "영주 칭호",
  titleValue: (demoted: boolean) => demoted ? "강등됨" : "되찾음",
  titleReturns: (date: string) => `${date}에 돌아옴`,
  decline: "영지의 쇠퇴",
  declineValue: (declined: boolean) => declined ? "쇠퇴 중" : "벗어남",
  lostRight: (right: string) => LORD_RIGHT_NAMES[right] ?? right,
  rightBack: "되삼",
  again: "권리 복원 청원",
  againValue: (date: string) => `${date}에 다시 옴`,
  favour: "왕실의 신임",
  favourValue: (held: boolean) => held ? "있음" : "잃음",
  conscripts: "징집",
  conscriptsValue: (men: number, back: string) => `${men}명 떠남 · ${back}쯤 돌아옴`,
  instalment: (category: string) => category === "war_loan" ? "상인에게 진 빚" : "양모 공납",
  instalmentValue: (perSeason: number, seasons: number) => `계절마다 ${moneyShort(perSeason)}, ${seasons}계절`,
  warTax: "전쟁세",
  warTaxValue: (seasons: number, permille: number) => `${seasons}계절 · 지대 ${percent(permille)} 더`,
  wall: "석벽과 장",
  wallValue: { stone_wall: "석벽 사업", murage: "성벽세를 붙인 석벽", market: "넓힌 장" } as Readonly<Record<string, string>>,
  curacy: "교회의 사제",
  curacyValue: (by: string, comes: string | null) => by === "monastery" ? comes === null ? "수도원 사제가 맡음" : `수도원 사제가 ${comes}쯤 옴` : "평신도 서기가 맡음",
  guild: "직물 길드",
  guildValue: (head: string | null) => head === null ? "인가됨" : `인가됨 · 우두머리 ${head}`,
  royalSubsidy: "국왕에게 낸 왕실 보조세",
  endowment: "유산 기부금",
  feeFarm: "자치 연납금(해마다)",
  backlash: "도시의 반발",
  nave: "교회 회중석",
  naveValue: "새로 지음",
  legacy: "남길 유산",
  mayor: "시장",
  head: "가문의 가장",
  family: "가문의 거처",
  familyValue: { departed: "시골 장원", stayed: "영주관" } as Readonly<Record<string, string>>,
  left: "영지를 떠난 사람",
  joined: "가문에 든 사람",
  /** At most three names, then how many more. */
  people: (names: readonly string[]) => names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} 외 ${names.length - 3}명`,
  legacyScore: (axis: string) => `${axis} 유산 점수`,
} as const;
