import { KING_NAMES_KO } from "../content/personNames.ko";
import type { HomePetitionKind } from "../engine/stewardship.types";
import { moneyFullDelta, moneyJosa, moneyObject, moneyShort } from "./money.ko";

// LM-R1 (petitions) the lord's cards in lord mode: the home estate's petitions (FIX-14 SW-11, one per kind), the town's
// requests (TA-7) and the court line (the king, the lord, the guardian). The
// words follow docs/design/glossary.md: 청지기, 후견인, 사망 부과금(헤리엇), 혼인 부담금(머쳇), 입주금, 마을 대표;
// answer buttons are the lord's act ("~한다"), the petitioners' and the steward's lines "~합니다".

/** Who is named in a petition's lines: the neighbour house the boundary sets against, the two merchant houses, the bishop. */
export type PetitionParties = Readonly<{ party: string; firstHouse: string; secondHouse: string; bishop: string }>;
type KindCopy = Readonly<{
  title: string;
  demand: (amount: number, parties: PetitionParties) => string;
  grant: (parties: PetitionParties) => string;
  refuse: (parties: PetitionParties) => string;
}>;

const sum = (amount: number) => moneyShort(amount);
/** A sum as a subject ("3s이", "7d가"). */
const sumSubject = (amount: number) => { const printed = moneyShort(amount); return `${printed}${moneyJosa(printed, "이", "가")}`; };

export const HOME_PETITION_COPY: Readonly<Record<HomePetitionKind, KindCopy>> = {
  boundary_dispute: {
    title: "경계 다툼",
    demand: (_amount, p) => `우리 소작인과 ${p.party} 쪽 농부가 밭의 경계석을 두고 다툽니다. 마을 대표가 막대로 재어 보았습니다. 어느 쪽 말이 옳은지 정해 주십시오.`,
    grant: () => "우리 소작인 편을 든다", refuse: () => "이웃 영지 편을 든다",
  },
  mill_suit: {
    title: "방앗간 강제",
    demand: amount => `소작인이 집에서 맷돌로 곡식을 갈다 방앗간 주인에게 들켰습니다. 영주의 방앗간에서만 갈아야 하는 관습을 풀어 달라고 청합니다. 풀면 제분료 ${sumSubject(amount)} 들어오지 않습니다.`,
    grant: () => "집 맷돌을 허락한다", refuse: () => "영주의 방앗간에서 갈게 한다",
  },
  heriot: {
    title: "사망 부과금(헤리엇)",
    demand: amount => `소작인이 죽어 과부와 아들이 가장 좋은 소를 영주에게 바쳐야 합니다. 부과금을 면해 달라고 청합니다. 소의 값은 ${sum(amount)}입니다.`,
    grant: () => "부과금을 면해 준다", refuse: () => "관습대로 소를 받는다",
  },
  merchet: {
    title: "혼인 부담금(머쳇)",
    demand: amount => `소작인이 딸을 장원 밖으로 시집보내려 허락을 청합니다. 혼인 부담금 ${moneyObject(amount)} 내겠다고 합니다.`,
    grant: () => "부담금을 받고 허락한다", refuse: () => "혼인을 허락하지 않는다",
  },
  ale_fines: {
    title: "에일 검정",
    demand: amount => `에일 검정에서 물 탄 에일과 모자란 되가 나왔습니다. 에일을 빚는 이들이 벌금 ${moneyObject(amount)} 덜어 달라고 청합니다.`,
    grant: () => "벌금을 덜어 준다", refuse: () => "벌금을 걷는다",
  },
  road_bridge: {
    title: "길·다리 수리 분담",
    demand: amount => `장원의 길과 다리가 무너져 갑니다. 도시 공동체가 수리비 ${moneyObject(amount)} 영주가 나눠 맡아 달라고 청합니다.`,
    grant: () => "수리비를 나눠 맡는다", refuse: () => "도시가 고치게 둔다",
  },
  stall_dispute: {
    title: "시장 좌판 다툼",
    demand: (_amount, p) => `${p.firstHouse}과 ${p.secondHouse}이 장날 같은 좌판 자리를 두고 다툽니다. 어느 집에 자리를 줄지 정해 주십시오.`,
    grant: p => `${p.firstHouse} 편을 든다`, refuse: p => `${p.secondHouse} 편을 든다`,
  },
  wardship: {
    title: "미성년 상속자 후견",
    demand: amount => `소작인이 어린 상속자를 남기고 죽었습니다. 친족이 아이와 땅의 후견을 맡겠다고 청합니다. 영주가 후견을 쥐면 ${sumSubject(amount)} 들어옵니다.`,
    grant: () => "후견을 친족에게 준다", refuse: () => "후견을 영주가 쥔다",
  },
  common_pasture: {
    title: "공유지 방목",
    demand: (_amount, p) => `공유지에 짐승이 너무 많습니다. 소작인들이 집마다 놓을 짐승 수를 정해 달라고 청합니다. ${p.secondHouse}의 양 떼가 가장 큽니다.`,
    grant: () => "방목 한도를 정한다", refuse: () => "한도를 두지 않는다",
  },
  newcomer: {
    title: "이주민 정착 허가",
    demand: amount => `새로 온 이주민 가족이 장원에 땅을 얻어 살겠다고 청합니다. 입주금 ${moneyObject(amount)} 내겠다고 합니다.`,
    grant: () => "입주금을 받고 정착을 허락한다", refuse: () => "정착을 허락하지 않는다",
  },
  pannage: {
    title: "돼지 방목 사용료",
    demand: amount => `소작인들이 도토리 철에 영주의 숲에 돼지를 놓는 사용료 ${moneyObject(amount)} 면해 달라고 청합니다.`,
    grant: () => "사용료를 면해 준다", refuse: () => "관습대로 사용료를 받는다",
  },
  chancel_repair: {
    title: "교회 성단 수리",
    demand: (amount, p) => `${p.bishop}가 교회 제단 쪽(성단)의 수리비 ${moneyObject(amount)} 영주가 맡아 달라고 청합니다.`,
    grant: () => "수리비를 맡는다", refuse: () => "수리비를 맡지 않는다",
  },
};

export const LORD_CARDS_COPY = {
  /** The card's kicker: whose petition it is. */
  homeFrom: "장원의 청원",
  /** One answer's numbers: the treasury now, then the relation moves (`PETITION_COPY.relations`), or none. */
  treasury: (pennies: number) => pennies === 0 ? "금고 변화 없음" : `금고 ${moneyFullDelta(pennies)}`,
  noRelations: "관계 변화 없음",
  /** How long the petition waits for an answer (it lapses as refused after). */
  waits: (days: number) => `답을 기다림 · ${days}일 남음`,
  /** ER-6: the lord's same answer twice running makes the kind a precedent; the steward answers it after that. */
  precedentHint: "같은 답을 두 번 이어서 하면, 다음부터는 청지기가 선례대로 답합니다",
  precedentSettled: (answer: string) => `선례가 있습니다: ${answer}. 다시 올리는 규칙이 켜져 있어 영주에게 왔습니다`,
  /** The court line on every lord card: the season, the king (kingAt), the lord (old from the engine's age) and a guardian. */
  court: (year: number, season: string, kingName: string, lord: string | null) =>
    `${year}년 ${season} · 국왕 ${KING_NAMES_KO[kingName] ?? kingName}${lord === null ? "" : ` · ${lord}`}`,
  lord: (name: string, age: number, old: boolean) => `${old ? "늙은 영주" : "영주"} ${name}(${age}살)`,
  guardian: (name: string) => `후견인 ${name}`,
  guardianOverlord: "후견: 상위 영주",
  /** TA-7: the town's requests. */
  requestFrom: "도시의 요청",
  request: {
    proclaim_era: { title: "시장도시 선포를 기다립니다", demand: "도시가 목책을 두르고 시장도시로 선포해 달라고 청합니다. 선포하면 장이 서고 도시가 더 자랍니다.",
      grant: "시장도시를 선포한다" },
    set_wall_construction_priority: { title: "성벽 공사를 먼저", demand: "도시가 성벽 공사에 일손과 자재를 먼저 돌려 달라고 청합니다.",
      grant: "성벽 공사를 먼저 하게 한다" },
    order_timber: { title: "목재 주문", demand: (amount: number) => `도시가 시장 상인에게 목재 ${amount}개를 주문해 달라고 청합니다.`,
      grant: "목재를 주문한다" },
  },
  requestWaits: (count: number) => count > 1 ? `요청 ${count}건 가운데 첫째` : "",
  requestAdvice: "들어주면 도시가 바로 움직입니다. 나중에 정해도 요청은 남아 있습니다",
} as const;
