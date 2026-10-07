import { LEGACY_BALANCE } from "../content/legacyConfig";
import { moneyFull, moneyShort } from "./money.ko";

// UI-6: what each petition asks, by the petition's defId (F2-A WR-2…WR-8, FAIL-3 FL-6). The answers' labels are the
// ledger's own (historyCopy `WAR_CHOICES`). DEC-CARD: what each answer does, now and later, is the card's own copy
// (`decisionCard/families/petitionCardCopy.ko.ts`), read off the answer run on the state.
// COPY-1r: a ratio is written "70%" (glossary rule 7).
const percent = (permille: number) => `${Math.round(permille / 10)}%`;
export const PETITION_COPY = {
  restore_right: {
    title: "권리 복원 청원",
    demand: "쇠퇴 때 잃은 권리를 넘겨받은 쪽이 영주에게 그 권리를 되팔겠다고 제안합니다.",
  },
  wool_payment: {
    title: "양모 공납 칙령",
    demand: (houses: number, levy: number) => `국왕이 전쟁에 쓸 양모를 명합니다: 사는 집 ${houses}채 × 1s 8d = ${moneyShort(levy)}.`,
  },
  levy_response: {
    title: "징집 명령",
    demand: (men: number) => `국왕이 군역을 명합니다: 어른 스무 명에 한 명, 모두 ${men}명.`,
  },
  war_funding: {
    title: "전쟁 보조세 요구",
    demand: (subsidy: number) => `국왕이 전쟁 보조세를 요구합니다: 동산의 10분의 1, ${moneyShort(subsidy)}.`,
  },
  refugee_admission: {
    title: "피란민의 청원",
    demand: (households: number, people: number, room: number) =>
      `습격을 피해 온 ${households}가구(${people}명)가 받아 달라고 청합니다 · 지금 들일 자리는 ${room}가구분입니다.`,
  },
  wall_or_market: {
    title: "석벽과 시장 사이의 선택",
    demand: "습격이 지나갔습니다. 도시 사람들이 묻습니다: 돌로 성벽을 쌓을까요, 장을 넓힐까요?",
  },
  // UI-8: the four plague petitions (F3-A PL-5…PL-8), each offering exactly the def's two answers.
  vacant_priest: {
    title: "빈 사제 자리",
    demand: "첫 사망과 함께 사제가 역병으로 죽었습니다. 교회가 비어 있습니다.",
  },
  wages: {
    title: "일꾼들의 임금 요구",
    demand: (workers: number) => `역병이 지나 일손이 줄었습니다. 일꾼 ${workers}명이 임금 인상을 요구합니다.`,
  },
  land_redistribution: {
    title: "빈 필지의 주인",
    demand: (vacant: number) => `역병이 빈 필지 ${vacant}곳을 남겼습니다. 주민들이 어떻게 쓸지 청합니다.`,
  },
  cash_rent: {
    title: "부역을 돈으로 바꾸자는 청원",
    demand: "재정착이 시작됩니다. 소작인들이 부역 대신 화폐 지대를 청합니다.",
  },
  // UI-9 (F4-A RG-5…RG-9): chapter 4's four cards.
  guild_charter: {
    title: "길드 인가 청원",
    demand: "장인들이 직물 길드를 세우게 해 달라고 청합니다. 길드가 서면 직물 네 건물이 더 빨리 돌아갑니다.",
  },
  tax_collection: {
    title: "인두세 징수 방식",
    demand: "1377년 인두세(14세 이상 한 사람 4d)를 도시 공동체가 대신 걷겠다고 청합니다. 이후 징수의 대상과 금액은 게임 규칙으로 간소화되며, 금고에는 징수 방식에 따른 수입만 들어옵니다.",
  },
  cloth_or_grain: {
    title: "직물 대 곡물",
    demand: "상인들이 영지의 쟁기밭을 양으로 돌려 직물에 걸자고 청합니다.",
  },
  borough_charter: {
    title: "자치 특허 협상",
    demand: "도시 공동체가 자치 특허를 청합니다. 시장 좌판세와 통행세 절반을 도시가 걷고, 그 대가로 해마다 영주에게 자치 연납금(fee farm)을 내겠다고 합니다.",
  },
  // UI-10 (F5-A LG-2…LG-6): chapter 5's four cards.
  royal_tax: {
    title: "왕실 보조세 요구",
    demand: (share: number, due: number, min: number, max: number) =>
      // COPY-1r CA-052 / CA-005: the game's rule named as such, and the sums asked in full (£·s·d).
      `국왕의 사절이 왕실 보조세(15분의 1세·10분의 1세)를 요구합니다. 게임에서는 지금 금고의 ${percent(share)}를 기준으로 ${moneyFull(min)}~${moneyFull(max)}을 냅니다: 지금은 ${moneyFull(due)}.`,
  },
  heir_choice: {
    title: "영주의 후계자",
    // COPY-1r CA-012: "늙은" only from the engine's own old age (LEGACY_BALANCE.lordOldAge); the petition also comes to a
    // grown lord at its deadline.
    demand: (lord: string, age: number) => lord === ""
      ? "가문을 이을 사람을 정해야 합니다. 상위 영주가 상속세를 받고 후계자를 인정합니다. 물러나는 영주와 그 배우자는 가족으로 남습니다."
      : `${age >= LEGACY_BALANCE.lordOldAge ? "늙은 " : ""}영주 ${lord}(${age}살)의 뒤를 이을 사람을 정해야 합니다. 상위 영주가 상속세를 받고 후계자를 인정합니다. 물러나는 영주와 그 배우자는 가족으로 남습니다.`,
    /** The answer's label when the nephew's place is a distant kinsman's (LG-3: the lord has no brother or sister). */
    kinsmanLabel: "먼 친척에게 잇게 한다",
  },
  borough_autonomy: {
    title: "자치 특허의 인장",
    demand: (mayor: string) => mayor === ""
      ? "도시가 제 인장을 새기고 자치 특허에 찍어 달라고 청합니다. 시장을 뽑는 권리와 도시 인장을 도시에 넘기는 특허입니다."
      : `도시가 제 인장을 새기고 자치 특허에 찍어 달라고 청합니다. 시장을 뽑는 권리와 도시 인장을 도시에 넘기는 특허입니다. 시장 후보는 ${mayor}입니다.`,
  },
  legacy_choice: {
    title: "남길 유산 하나",
    demand: (endowment: number) => `영주가 도시에 무엇을 남길지 정할 때입니다. 금고에서 ${moneyShort(endowment)}(모자라면 있는 만큼)을 하나에 씁니다.`,
  },
  // UI-10 (FIX-9 LG-13): the interlude's two petitions, the Wave 33 illustrations.
  guild_dispute: {
    title: "길드와 상인의 다툼",
    demand: "길드와 첫 상인 가문이 직물을 파는 권리를 두고 다툽니다. 직인들이 영주에게 길드 편을 들어 달라고 청합니다.",
  },
  church_rebuilding: {
    title: "교회 증축 청원",
    demand: (cost: number) => `교구가 낡은 교회에 새 회중석을 지어 달라고 청합니다. 증축에 드는 돈은 ${moneyShort(cost)}입니다.`,
  },
  /** UI-10 (LG-3): an heir candidate on the heir's card — who, through whom, what of the old lord they have, their records. */
  heir: {
    who: (relation: string, age: string) => `${relation} · ${age}`,
    son: "영주의 아들",
    daughter: "영주의 딸",
    husband: (daughter: string) => daughter === "" ? "영주의 딸의 남편" : `영주의 딸 ${daughter}의 남편`,
    nephew: (parent: string, sister: boolean) => parent === "" ? "영주의 형제자매의 아들" : `영주의 ${sister ? "자매" : "형제"} ${parent}의 아들`,
    kinsman: "가문의 먼 친척",
    resemblance: (parts: readonly string[]) => parts.length === 0 ? "영주와 닮은 데가 없습니다" : `닮은 점: 영주의 ${parts.join(", ")}`,
    /** The same pool face as the old lord (`portraitIdentity`). */
    face: "얼굴 생김",
    records: (born: number, left: number | null, records: number, newcomer: boolean) =>
      [`${born}년생`, ...(left === null ? [] : [`${left}년 영주관을 떠남`]), ...(newcomer ? ["이번에 영지에 옴"] : []), `원장 기록 ${records}건`].join(" · "),
    heading: "후보",
  },
  /** A list of relation moves with short names (the home petition's numbers, `lordCardsModel`). */
  relations: (moves: readonly (readonly [who: string, delta: number])[]) => `관계 ${moves.map(([who, delta]) => `${who} ${delta > 0 ? "+" : "−"}${Math.abs(delta)}`).join(" · ")}`,
  relationNames: { town: "도시", merchant_house_1: "상인", overlord: "백작", crown: "국왕", commons: "평민", bishop: "주교", neighbour_1: "이웃 영주" } as Readonly<Record<string, string>>,
  /** The Crown's writ (its hanging seal carries the Crown's arms); the petitioner line for every card. */
  writ: "국왕의 칙서",
  senderHeading: "보낸 사람",
  from: (name: string) => `보낸 이: ${name}`,
  /** UI-6b: a faction that brings another's plea (the refugees' by the bishop, FX-3), and whose arms fill the roundel. */
  onBehalf: { refugee_admission: "피란민을 대신해" } as Readonly<Record<string, string>>,
  fromOnBehalf: (name: string, behalf: string) => `보낸 이: ${name} (${behalf})`,
  arms: (name: string) => `${name}의 문장`,
  leader: (name: string) => `대표: ${name}`,
} as const;
