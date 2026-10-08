import type { StandingSetting } from "../../../content/stewardPolicyConfig";
import type { HomePetitionKind } from "../../../engine/stewardship.types";
import type { PetitionParties } from "../../lordCardsCopy.ko";
import { moneyJosa, moneyShort } from "../../money.ko";

// DEC-CARD, the home estate's petitions: what is at stake in each kind (the situation is the petition's own words,
// HOME_PETITION_COPY.demand), and the answer's money in a sentence. Words follow docs/design/glossary.md.

const sum = (amount: number) => moneyShort(amount);
/** A sum with its particle, read aloud ("3s과", "7d와"; "3s이", "7d가"). */
const sumAnd = (amount: number) => { const printed = moneyShort(amount); return `${printed}${moneyJosa(printed, "과", "와")}`; };
const sumSubject = (amount: number) => { const printed = moneyShort(amount); return `${printed}${moneyJosa(printed, "이", "가")}`; };

export const HOME_PETITION_STAKE: Readonly<Record<HomePetitionKind, (amount: number, p: PetitionParties) => string>> = {
  boundary_dispute: (_amount, p) => `밭 한 뙈기의 경계, 그리고 우리 소작인과 ${p.party} 쪽 사이의 이웃 사이가 걸려 있습니다.`,
  mill_suit: amount => `영주 방앗간의 제분료(${sum(amount)})와, 집에서 곡식을 갈고 싶은 소작인들의 수고가 걸려 있습니다.`,
  heriot: amount => `과부 집의 가장 좋은 소(${sum(amount)})와, 장원의 오랜 관습이 걸려 있습니다.`,
  merchet: amount => `혼인 부담금 ${sumAnd(amount)}, 소작인 집안의 혼인이 걸려 있습니다.`,
  ale_fines: amount => `벌금 ${sumAnd(amount)}, 에일을 빚는 집들의 살림과 장원의 에일 품질이 걸려 있습니다.`,
  road_bridge: amount => `수리비 ${sumAnd(amount)}, 장원의 길과 다리가 걸려 있습니다.`,
  stall_dispute: (_amount, p) => `장날의 좌판 자리, 그리고 ${p.firstHouse}과 ${p.secondHouse}의 사이가 걸려 있습니다.`,
  wardship: amount => `어린 상속자의 땅, 그리고 영주가 후견을 쥐면 들어올 ${sumSubject(amount)} 걸려 있습니다.`,
  common_pasture: (_amount, p) => `공유지의 풀, 그리고 짐승이 많은 ${p.secondHouse}와 작은 소작인들의 사이가 걸려 있습니다.`,
  newcomer: amount => `입주금 ${sumAnd(amount)}, 장원에 새 일손이 드는지가 걸려 있습니다.`,
  pannage: amount => `숲 사용료 ${sumAnd(amount)}, 소작인들의 돼지가 걸려 있습니다.`,
  chancel_repair: (amount, p) => `수리비 ${sumAnd(amount)}, ${p.bishop}와의 사이가 걸려 있습니다.`,
};

export const HOME_PETITION_CARD_COPY = {
  from: "장원의 청원",
  /** Until when, and what silence means (an unanswered home petition lapses as refused, SW-11). */
  deadline: (days: number) => `${days}일 안에 답해야 합니다. 답하지 않으면 기각한 것으로 칩니다.`,
  treasuryIn: (pennies: number) => `금고에 ${sumSubject(pennies)} 들어옵니다.`,
  treasuryOut: (pennies: number) => `금고에서 ${sumSubject(pennies)} 나갑니다.`,
  treasurySame: "금고는 그대로입니다.",
  /** DTR-1: the standing policies' words (the lord's policy screen sets them; `set_standing_policy`). */
  settings: { customary: "관습대로", lenient: "가볍게", strict: "엄하게", lord: "영주에게" } satisfies Record<StandingSetting, string>,
  /** DTR-1: what the steward does with the kind from now on — its standing policy, and why this one came to the lord. */
  standingLord: "이 청원의 상시 방침은 \"영주에게\"라서, 이런 청원은 앞으로도 영주에게 옵니다.",
  standing: (setting: string, why: "large" | "recurring" | null, answer: string | null) =>
    `이 청원의 상시 방침은 "${setting}"입니다. ${why === "large" ? "이번에는 큰 돈이 걸려 영주에게 왔습니다. " : why === "recurring" ? "이번에는 장원 청원을 모두 올리라는 규칙이 켜져 있어 영주에게 왔습니다. " : ""}`
    + `앞으로 이런 청원은 청지기가 그 방침대로${answer === null ? "" : `("${answer}")`} 답합니다. "영주에게"로 두면 영주에게 옵니다.`,
  refused: "지금은 이 답을 할 수 없습니다.",
} as const;
