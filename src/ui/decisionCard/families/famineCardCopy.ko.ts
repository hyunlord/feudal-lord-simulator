import type { FamineResponseChoice } from "../../../content/chapterConfig";
import { moneyJosa, moneyShort } from "../../money.ko";

// DEC-CARD, the Great Famine (FC-2): who suffers, what is at stake, and each answer's now and later in sentences. The
// numbers are the engine's (the households short of bread, the stores, the treasury, the answer's own forecast two
// seasons on and its actual's date); who remembers is the answer's faction records. Words: docs/design/glossary.md.

const sumSubject = (amount: number) => { const printed = moneyShort(amount); return `${printed}${moneyJosa(printed, "이", "가")}`; };
const times = (permille: number) => `${(permille / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })}배`;

export const FAMINE_CARD_COPY = {
  from: "청지기가 올린 일",
  situation: (short: number, lived: number) => short > 0
    ? `흉년으로 빵 값이 치솟았습니다. 사는 집 ${lived}곳 가운데 가장 가난한 ${short}곳이 빵을 살 수 없습니다. 그대로 두면 굶는 집은 마을을 떠납니다.`
    : `흉년으로 빵 값이 치솟았습니다. 사는 집 ${lived}곳 가운데 가장 가난한 집들부터 빵을 사기 어려워집니다.`,
  stake: (days: number | null, lived: number, treasury: number, ends: string) =>
    `${days === null ? "" : `창고의 식량 ${days}일분, `}사는 집 ${lived}곳, 금고의 ${sumSubject(treasury)} 걸려 있습니다. 기근은 ${ends}쯤 끝납니다.`,
  deadline: (ends: string) => `기근이 끝나는 ${ends}쯤까지 답할 수 있습니다. 답하지 않는 동안 영주는 아무 조치도 하지 않습니다.`,
  /** What the answer does, in words (FC-2; the engine's own shares in it). */
  now: {
    relief: () => "가난한 집이 먹을 한 계절치 빵을 기근 값으로 사서 곡창에 넣습니다. 그 집들은 굶지 않습니다.",
    price_control: (capPermille: number) => `빵과 밀 값을 평소의 ${times(capPermille)}로 묶습니다. 가난한 집도 빵을 살 수 있습니다.`,
    laissez_faire: () => "아무것도 하지 않습니다. 빵을 못 사는 집은 그대로 굶습니다.",
    speculation: (sharePermille: number) => `곡창의 빵과 밀 ${Math.round(sharePermille / 10)}%를 기근 값으로 팝니다.`,
  } satisfies Readonly<Record<FamineResponseChoice, (permille: number) => string>>,
  /** What follows while the famine lasts (FC-2: each season's start). */
  eachSeason: {
    relief: "기근이 이어지는 동안 계절마다 금고에서 빵값이 나갑니다.",
    price_control: (gauge: number) => `기근이 이어지는 동안 계절마다 상인 게이지가 ${Math.abs(gauge)}씩 내려갑니다.`,
    laissez_faire: "기근이 이어지는 동안 계절마다 빵을 못 사는 집이 떠날 수 있습니다.",
    speculation: "기근이 이어지는 동안 계절마다 곡창에서 또 팝니다. 그만큼 마을의 식량이 줄어듭니다.",
  },
  forecast: (population: number, populationNow: number, treasury: number, treasuryNow: number) =>
    `두 계절 뒤 인구는 ${population}명(지금 ${populationNow}명), 금고는 ${sumSubject(treasury)} 될 것으로 봅니다(지금 ${moneyShort(treasuryNow)}).`,
  leaving: (people: number) => `그때까지 ${people}명쯤이 마을을 떠날 것으로 봅니다.`,
  nobodyLeaves: "그때까지 떠나는 집은 없을 것으로 봅니다.",
  actualDue: (date: string) => `실제로 어떻게 되었는지는 ${date}에 연대기에 적힙니다.`,
  refused: "지금은 이 답을 할 수 없습니다.",
} as const;
