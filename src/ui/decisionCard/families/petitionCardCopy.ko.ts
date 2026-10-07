import type { PetitionResponse } from "../../../content/chapterConfig";
import type { PetitionDefId } from "../../petitionPresentation";
import { moneyFull, moneyJosa, moneyObject, moneyShort } from "../../money.ko";

// DEC-CARD, the political petitions (every PETITION_DEFS kind, chapters 1–5 and the interlude): what is at stake in each,
// and each answer's now and later as sentences. The numbers in them are the engine's (the answer run on the state, the
// war's and the plague's own sums, the state after the answer); who remembers is the answer's own faction records, not
// here. Words follow docs/design/glossary.md: the lord's answers are his act ("~한다"), the card's lines "~합니다".

/** The particle after a Korean word: the first form after a final consonant (받침), the second after a vowel. */
const josa = (word: string, withFinal: string, without: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? withFinal : without;
};
const sumSubject = (amount: number) => { const printed = moneyShort(amount); return `${printed}${moneyJosa(printed, "이", "가")}`; };
const fullSubject = (amount: number) => { const printed = moneyFull(amount); return `${printed}${moneyJosa(printed, "이", "가")}`; };
const percent = (permille: number) => `${Math.round(permille / 10)}%`;
const times = (permille: number) => `${(permille / 1000).toLocaleString("en-US", { maximumFractionDigits: 2 })}배`;

/** What is at stake in each kind (the situation is the petition's own demand, `petitionPresentation`). */
export const PETITION_STAKE: Readonly<Record<PetitionDefId, string>> = {
  market_charter: "장을 열 권리와 좌판세, 그리고 상인 무리가 영주를 어떻게 여기는지가 걸려 있습니다.",
  restore_right: "쇠퇴 때 잃은 권리와 영주의 칭호, 그리고 되사는 값이 걸려 있습니다.",
  wool_payment: "금고나 창고의 양털, 그리고 왕실의 신임이 걸려 있습니다.",
  levy_response: "마을의 일손, 또는 면제금, 그리고 왕실의 신임이 걸려 있습니다.",
  war_funding: "금고, 상인에게 질 빚이나 가난한 가구의 지대, 그리고 왕실의 신임이 걸려 있습니다.",
  refugee_admission: "빈 집과 일손, 그리고 갈 곳 없는 가구들이 걸려 있습니다.",
  wall_or_market: "도시가 돌 성벽을 갖는지, 더 넓은 장을 갖는지가 걸려 있습니다.",
  vacant_priest: "교회의 기도와 주교와의 사이, 그리고 사제의 봉급이 걸려 있습니다.",
  wages: "일꾼들이 마을에 남는지, 그리고 장부 기간마다 나가는 임금이 걸려 있습니다.",
  land_redistribution: "빈 필지를 누가 쓰는지, 그리고 새로 오는 가구가 낼 입주금이 걸려 있습니다.",
  cash_rent: "영주의 부역 권리와 지대, 그리고 소작인이 달아나는지가 걸려 있습니다.",
  guild_charter: "직물 일의 속도와 직조공 가구, 그리고 도시가 얼마나 힘을 갖는지가 걸려 있습니다.",
  tax_collection: "인두세가 얼마나 걷히는지, 그리고 평민의 분노가 걸려 있습니다.",
  cloth_or_grain: "직물 값과, 흉년에 먹을 곡식이 걸려 있습니다.",
  borough_charter: "시장 좌판세와 통행세 절반, 해마다 받을 연납금, 그리고 백작과 도시의 사이가 걸려 있습니다.",
  royal_tax: "금고의 보조세, 그리고 국왕과 도시의 사이가 걸려 있습니다.",
  heir_choice: "누가 가문을 잇는지, 그리고 상위 영주에게 낼 상속세가 걸려 있습니다.",
  borough_autonomy: "도시가 스스로 다스리는지, 그리고 가문이 영주관에 남는지가 걸려 있습니다.",
  legacy_choice: "금고의 기부금과, 연대기가 이 가문을 무엇으로 기억할지가 걸려 있습니다.",
  guild_dispute: "직물을 파는 권리, 그리고 길드와 상인 가문의 사이가 걸려 있습니다.",
  church_rebuilding: "증축비와 교회에 남길 이름, 그리고 주교와의 사이가 걸려 있습니다.",
};

/** One answer's own sentences, besides the money, the people and the gauge the card reads off the state after it. */
export type AnswerWords = Readonly<{ now: readonly string[]; later: readonly string[] }>;
const say = (now: readonly string[], later: readonly string[] = []): AnswerWords => ({ now, later });

export const PETITION_ANSWER_COPY = {
  market_charter: (response: PetitionResponse, stallPermille: number | null) => response === "refuse"
    ? say(["시장권을 주지 않습니다. 장은 영주의 관리 아래 그대로 열립니다."])
    : say([`상인들에게 시장권을 줍니다. ${stallPermille === null || stallPermille === 1000 ? "좌판세는 그대로입니다." : `좌판세는 평소의 ${percent(stallPermille)}가 됩니다.`}`,
      ...(response === "accept_with_price" ? ["그 대신 인가료를 받습니다."] : [])]),
  restore_right: {
    accept: say(["권리를 되삽니다. 영주의 칭호도 곧바로 돌아옵니다."]),
    haggled: (returns: string) => say(["값을 깎아 권리를 되삽니다."], [`칭호는 ${returns}에 돌아옵니다.`]),
    refuse: (again: string) => say(["권리를 되사지 않습니다."], [`${again}에 다시 청해 옵니다.`]),
    /** LM-R1 (Astra B04): the treasury cannot pay — the engine records the answer and restores nothing. */
    short: (price: number, treasury: number, again: string) =>
      say([`값은 ${moneyFull(price)}인데 금고에 ${moneyFull(treasury)}뿐이라(${moneyFull(price - treasury)} 모자람), 지금 답하면 권리는 돌아오지 않습니다.`], [`${again}에 다시 청해 옵니다.`]),
  },
  wool_payment: {
    inKind: (fleeces: number, inKind: number, cash: number) => say(["양모를 현물로 나눠 냅니다. 계절이 바뀔 때마다 한 몫씩 나갑니다."], [
      fleeces === 0 ? `지금 창고대로라면 양털이 없어, 한 몫 ${sumSubject(cash)} 모두 현금으로 나갑니다.`
        : cash === 0 ? `지금 창고대로라면 한 몫은 창고 양털 ${fleeces}뭉치(${moneyShort(inKind)})로 다 냅니다.`
        : `지금 창고대로라면 한 몫은 창고 양털 ${fleeces}뭉치(${moneyShort(inKind)})와 현금 ${moneyShort(cash)}로 냅니다.`]),
    cash: say(["양모 값을 현금으로 한꺼번에 냅니다."]),
    refuse: say(["거절합니다. 조달관이 대신 양모를 거둬 갑니다."]),
  },
  levy_response: {
    accept: (men: number) => say([`어른 ${men}명을 군역에 보냅니다.`]),
    exempt: say(["면제금을 내고 아무도 보내지 않습니다."]),
    refuse: say(["사람도 돈도 보내지 않습니다."]),
  },
  war_funding: {
    loan: say(["상인에게 빌려 보조세를 곧바로 냅니다."]),
    treasury: say(["금고에서 보조세를 냅니다."]),
    refuse: say(["보조세를 내지 않습니다."]),
  },
  refugee_admission: {
    all: say(["모두 받아들입니다. 빈 집부터 채우고, 자리가 모자라면 들어간 만큼만 받습니다."]),
    half: say(["절반만 받고, 가구마다 들일 값을 받습니다."]),
    refuse: say(["피란민을 돌려보냅니다."]),
  },
  wall_or_market: {
    wall: say(["석벽 사업을 합니다. 선포 조건과 비용은 그대로입니다."]),
    murage: (tollPermille: number) => say(["성벽세를 붙여 석벽을 쌓습니다."], [`석벽이 다 설 때까지 통행세가 ${times(tollPermille)}가 됩니다.`]),
    noFavour: say(["왕실의 신임이 없어 성벽세는 붙지 않습니다. 석벽 사업과 같습니다."]),
    market: (stallPermille: number) => say([`석벽을 포기하고 장을 넓힙니다. 좌판세가 ${times(stallPermille)}가 됩니다.`]),
  },
  vacant_priest: {
    monastery: (comes: string | null) => say(["봉급을 내고 수도원의 사제를 청합니다."], comes === null ? [] : [`사제는 ${comes}쯤 옵니다. 그때까지 교회가 비어 있습니다.`]),
    clerk: say(["평신도 서기를 세웁니다. 돈이 들지 않고, 곧바로 기도를 맡습니다."]),
  },
  wages: {
    raise: (perWorker: number) => say(["일꾼들의 임금을 올립니다. 일꾼들이 마을에 남습니다."], [`장부 기간마다 일꾼 한 사람당 ${moneyShort(perWorker)}씩 더 나갑니다.`]),
    bind: say(["임금을 법대로 묶습니다."], ["계절마다 가난한 가구가 임금을 더 주는 곳으로 떠날 수 있습니다."]),
  },
  land_redistribution: {
    neighbours: say(["이웃 가구들이 빈 필지를 넓혀 씁니다."], ["계절마다 한 가구씩 빈 필지에 듭니다."]),
    settlers: (households: number, fine: number) => say(["새 이주민을 받습니다."], [`계절마다 ${households}가구씩 들고, 가구마다 입주금 ${moneyObject(fine)} 냅니다.`]),
  },
  cash_rent: {
    commute: (rentPermille: number) => say(["부역을 화폐 지대로 바꿉니다. 권리 목록에 화폐 지대가 오릅니다."], [`지대가 ${times(rentPermille)}가 됩니다.`]),
    keep: (upkeepPermille: number) => say(["부역을 지킵니다."], [`부역 덕에 영주 시설 유지비가 ${times(upkeepPermille)}가 됩니다.`, "계절마다 가구가 달아날 수 있습니다."]),
  },
  guild_charter: {
    grant: (fasterPercent: number, autonomyYear: number) => say([`직물 길드를 인가합니다. 직물 생산 시설 4종의 작업 시간이 ${fasterPercent}% 줄어듭니다.`],
      [`도시의 자치 요구가 ${autonomyYear}년으로 당겨집니다.`]),
    refuse: (slowerPercent: number, households: number) => say([`길드를 거부합니다. 직조 작업 시간이 ${slowerPercent}% 늘어납니다.`], [`다음 계절 직조공 ${households}가구가 떠납니다.`]),
  },
  tax_collection: {
    town: (perAdult: number) => say(["도시 공동체에 인두세 징수를 맡깁니다."], [`걷을 때마다 어른 한 사람당 ${sumSubject(perAdult)} 들어옵니다.`]),
    lord: (perAdult: number) => say(["영주의 징수원이 직접 걷습니다."], [`걷을 때마다 어른 한 사람당 ${sumSubject(perAdult)} 들어옵니다.`]),
  },
  cloth_or_grain: {
    cloth: (price: number, harvestPercent: number) => say([`쟁기밭을 양으로 돌려 직물에 겁니다. 직물 값이 ${sumSubject(price)} 됩니다.`],
      [`흉년에는 수확이 ${harvestPercent}%로 줄어 식량이 약해집니다.`]),
    grain: say(["곡물을 지킵니다. 바뀌는 것은 없습니다."]),
  },
  borough_charter: {
    grant: (feeFarm: number) => say(["일부 허용합니다. 시장 좌판세와 통행세 절반이 도시로 갑니다."], [`도시가 해마다 봄에 자치 연납금 ${moneyObject(feeFarm)} 냅니다.`]),
    refuse: say(["자치 특허를 거부합니다. 권리는 그대로입니다."], ["5장에서 도시가 이 거절에 반발합니다."]),
  },
  royal_tax: {
    pay: say(["왕실 보조세를 냅니다."]),
    plead: (confirmation: number) => say(["감면을 청원하고, 지금은 내지 않습니다."], [`나중에 자치 특허를 내주면 국왕 확인금 ${moneyObject(confirmation)} 냅니다.`]),
  },
  heir_choice: {
    seated: (name: string, lineage: string) => say([`${lineage} ${name}${josa(name, "이", "가")} 영주관의 가장이 됩니다. 상위 영주에게 상속세를 냅니다.`]),
    unnamed: say(["후계자가 영주관의 가장이 됩니다. 상위 영주에게 상속세를 냅니다."]),
    othersLeave: "고르지 않은 새 후보는 영지를 떠납니다.",
    daughterBack: "딸이 영주관으로 돌아옵니다.",
  },
  borough_autonomy: {
    seal: (tolls: boolean, feeFarm: number) => say([`특허에 인장을 찍습니다. 시장 선출권과 도시 인장이 도시로 갑니다${tolls ? ". 좌판세와 통행세 절반도 도시로 갑니다" : ""}.`],
      [`도시의 연납금은 해마다 ${moneyShort(feeFarm)}입니다.`, "가문은 영주관을 떠납니다."]),
    keep: (backlash: number) => say(["가문이 계속 다스립니다. 연납금은 그대로입니다.", `도시의 반발이 ${backlash}까지 오릅니다.`], ["가문은 영주관에 남습니다."]),
  },
  legacy_choice: (legacy: string) => say([`${legacy}${josa(legacy, "을", "를")} 남깁니다.`]),
  guild_dispute: {
    guild: say(["길드 편을 듭니다. 돈은 들지 않습니다."]),
    merchants: say(["상인 가문 편을 듭니다. 돈은 들지 않습니다."]),
  },
  church_rebuilding: {
    build: say(["교회에 새 회중석을 지어 넓힙니다."]),
    wait: say(["증축을 미룹니다. 돈은 들지 않습니다."]),
  },
} as const;

/** The lines every answer may add, read off the state after it (the same on every card). */
export const PETITION_CARD_COPY = {
  treasuryIn: (pennies: number) => `금고에 ${fullSubject(pennies)} 들어옵니다.`,
  treasuryOut: (pennies: number) => `금고에서 ${fullSubject(pennies)} 나갑니다.`,
  treasurySame: "금고는 지금 그대로입니다.",
  peopleIn: (people: number) => `${people}명이 마을에 듭니다.`,
  peopleOut: (people: number) => `${people}명이 마을을 떠납니다.`,
  gauge: (from: number, to: number) => `상인 게이지가 ${from}에서 ${to}까지 ${to > from ? "오릅니다" : "내려갑니다"}.`,
  favourLost: "왕실의 신임을 잃습니다. 신임이 없으면 나중에 성벽세를 붙일 수 없습니다.",
  instalment: (category: string, perSeason: number, seasons: number) => category === "war_loan"
    ? `앞으로 ${seasons}계절 동안 계절마다 ${moneyShort(perSeason)}씩 상인에게 갚습니다.`
    : `앞으로 ${seasons}계절 동안 계절마다 ${moneyShort(perSeason)}어치를 냅니다. 창고의 양털이 먼저 나가고, 모자라면 현금이 나갑니다.`,
  conscripts: (men: number, back: string, lost: number) =>
    `${men}명이 ${back}쯤 돌아옵니다.${lost > 0 ? ` 그중 ${lost}명은 돌아오지 못합니다.` : ""}`,
  warTax: (seasons: number, permille: number) => `${seasons}계절 동안 지대를 ${percent(permille)} 더 걷습니다. 가난한 가구가 떠날 수 있습니다.`,
  legacyPoints: (axis: string, points: number) => `${axis} 유산 점수가 ${points > 0 ? `${points} 오릅니다` : `${-points} 내려갑니다`}.`,
  /** RG-8: what an answer adds to (or takes from) the revolt's pressure — in chapter 4, or carried there from chapter 3. */
  pressure: (cause: string, amount: number, later: boolean) =>
    `${later ? "4장의 " : ""}반란 압력이 ${Math.abs(amount)} ${amount > 0 ? "오릅니다" : "내려갑니다"} (까닭: ${cause}).`,
  pressureCause: {
    direct_collection: "영주의 징수원", labour_services: "지켜진 부역", wages_bound: "묶인 임금", guild_refused: "거부된 길드",
    cloth_specialised: "직물에 건 영지", commons_estranged: "등 돌린 평민",
  } as Readonly<Record<string, string>>,
  /** HL-3: the engine's forecast two seasons on, and when the actual is written. */
  forecast: (treasury: number, now: number) => treasury === now ? `두 계절 뒤에도 금고는 지금과 같은 ${moneyShort(now)}로 봅니다.`
    : `두 계절 뒤 금고는 ${moneyShort(treasury)}로 봅니다(지금 ${moneyShort(now)}).`,
  actualDue: (date: string) => `실제로 어떻게 되었는지는 ${date}에 연대기에 적힙니다.`,
  refused: "지금은 이 답을 할 수 없습니다.",
  /** Until when, and what silence means (the engine's own answer to silence, compared with the answers on the card). */
  untilYearEnd: (year: number) => `${year}년이 끝나기 전에 답해야 합니다.`,
  /** The season the answer must come in ("1340년 봄"): until it passes. */
  until: (season: string) => `${season}${josa(season, "이", "가")} 가기 전에 답해야 합니다.`,
  noDeadline: "답할 때까지 기다립니다.",
  silenceSame: (label: string) => `답하지 않으면 "${label}"${josa(label, "과", "와")} 같은 답으로 칩니다.`,
  silenceMoves: (who: string) => `답하지 않으면 청원은 그대로 끝나고, ${who}.`,
  silenceNothing: "답하지 않으면 청원은 그대로 끝나고, 바뀌는 것은 없습니다.",
  silenceWho: (name: string, how: string) => `${name}${josa(name, "이", "가")} ${how}`,
} as const;
