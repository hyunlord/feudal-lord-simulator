import { moneyShort } from "../money.ko";

// DEC-CARD-2 (DC-D7): the engine's outlook for an answer (`answerOutlook`, src/state/decisionOutlook.ts) in words — the
// keys of what it sets going later. Every key is data; the card says each in a sentence. Words follow
// docs/design/glossary.md: the lord's acts "~한다", the card's lines "~합니다".

/** The particle after a Korean word: the first form after a final consonant (받침), the second after a vowel. A name's
 * closing gloss does not count ("드 코르벨 가문(이웃 영주)이": the particle follows 가문). */
const josa = (word: string, withFinal: string, without: string) => {
  const bare = word.replace(/\([^()]*\)$/, "");
  const code = bare.charCodeAt(bare.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? withFinal : without;
};
const subject = (word: string) => `${word}${josa(word, "이", "가")}`;
const object = (word: string) => `${word}${josa(word, "을", "를")}`;

export const OUTLOOK_COPY = {
  /** promise_due: a promise the answer leaves open, by whom it is held and its deadline (and its sum when it has one). */
  promiseDue: (promisee: string, date: string, amount: number | null) =>
    `${promisee}에게 한 약속${amount === null ? "" : `(${moneyShort(amount)})`}을 ${date}까지 지켜야 합니다.`,
  promisesDue: (promisee: string, count: number, first: string, last: string, amount: number | null) =>
    `${promisee}에게 한 약속 ${count}건${amount === null ? "" : `(한 번에 ${moneyShort(amount)})`}을 ${first}부터 ${last}까지 지켜야 합니다.`,
  /** promise_due held by the lord: a promise given to him. */
  promiseToLord: (date: string) => `영주가 받은 약속은 ${date}까지 지켜져야 합니다.`,
  /** war_tax: the seasons the war tax is still taken (a count). */
  warTax: (seasons: number) => seasons > 0 ? `앞으로 ${seasons}계절 동안 전쟁세를 걷습니다.` : "전쟁세는 더 걷지 않습니다.",
  /** subsidy_paid_when_built / subsidy_withdrawn: the building and the sum paid for each one built. */
  subsidy: (building: string, amount: number) => `앞으로 ${object(building)} 지으면 한 건에 ${moneyShort(amount)}의 장려금이 금고에서 나갑니다.`,
  subsidyGone: (building: string) => `앞으로 ${building} 장려금은 나가지 않습니다.`,
  /** suit_stage: the stage the suit stands at after the answer. */
  suitStage: (stage: string) => `답한 뒤 소송은 ${stage}입니다.`,
  suitStages: {
    filed: "소장을 낸 단계", evidence: "증거를 모으는 단계", patronage: "후원을 구하는 단계", hearing: "심리하는 단계", judged: "판결이 난 단계",
    enforcing: "점유를 집행할 단계", closed: "끝난 상태",
  } as Readonly<Record<string, string>>,
  suitStageUnknown: "다음 단계",
  /** timber_order: the timber standing ordered from the market's merchants (none: the order withdrawn). */
  timber: (amount: number) => amount > 0 ? `시장 상인에게 목재 ${amount}단을 주문해 둡니다. 상인이 가져오는 대로 들어옵니다.` : "목재 주문을 거둡니다.",
  /** stall_dues: the market's stall dues from now on, in percent of the usual (permille in the engine). */
  dues: (percent: number) => `앞으로 장날마다 좌판세를 평소의 ${percent}%로 걷습니다.`,
  /** dues_mind (DUES-REL): the merchant houses' turn each season while the fee stands above or below its reference (the agreed or usual rate, in percent). */
  duesMind: (perSeason: number, reference: number) => perSeason < 0
    ? `좌판세가 기준(평소의 ${reference}%)보다 높아, 이대로면 철마다 두 상인 가문의 마음이 ${-perSeason}씩 식습니다.`
    : `좌판세가 기준(평소의 ${reference}%)보다 낮아, 이대로면 철마다 두 상인 가문의 마음이 ${perSeason}씩 풀립니다.`,
  /** faction_mind: the factions whose later acts the chronicle ties to this decision. */
  factionMind: (names: string) => `${subject(names)} 나중에 이 일로 움직이면, 연대기에 이 결정 때문이라고 적힙니다.`,
  /** A list of names in a line ("상인 무리, 평민"). */
  list: (names: readonly string[]) => names.join(", "),
} as const;
