import { pence } from "./hud/hudCopy.ko";

// UI-6: what each petition asks and what each answer does, by the petition's defId (F2-A WR-2…WR-8, FAIL-3 FL-6). The
// answers' labels are the ledger's own (historyCopy `WAR_CHOICES`); the numbers come from the rules (war.ts).
const percent = (permille: number) => `${Math.round(permille / 10)} %`;
export const PETITION_COPY = {
  restore_right: {
    title: "권리 복원 청원",
    demand: "쇠퇴 때 잃은 권리를 넘겨받은 쪽이 되사기를 제안합니다.",
    accept: (paid: number) => `${pence(paid)}에 권리를 되삽니다 · 칭호도 곧바로 돌아옵니다`,
    accept_with_price: (paid: number) => `값을 깎아 ${pence(paid)}에 되삽니다 · 칭호는 한 해 뒤에 돌아옵니다`,
    refuse: () => "거절합니다 · 한 해 뒤에 다시 청해 옵니다",
  },
  wool_payment: {
    title: "양모 공납 칙령",
    demand: (houses: number, levy: number) => `국왕이 전쟁에 쓸 양모를 명합니다: 사는 집 ${houses}채 × 20d = ${pence(levy)}.`,
    accept: (total: number, perSeason: number, seasons: number) => `현물로 ${pence(total)}어치를 ${seasons}계절에 나눠 냅니다(계절마다 ${pence(perSeason)})`,
    /** ECON-UI (FIX-7, C5 CL-9): what a season's share takes now — the fleece in the town's stores first, the rest in coin. */
    inKindSplit: (fleeces: number, inKind: number, cash: number) => fleeces === 0
      ? `창고에 양털이 없어 계절마다 ${pence(cash)} 모두 현금`
      : cash === 0 ? `계절마다 창고 양털 ${fleeces}뭉치(${pence(inKind)})로 다 냅니다` : `계절마다 창고 양털 ${fleeces}뭉치(${pence(inKind)}) + 현금 ${pence(cash)}`,
    acceptInKind: (share: string, split: string) => `${share} · ${split}`,
    accept_with_price: (levy: number) => `현금 ${pence(levy)}을 지금 냅니다`,
    refuse: (seized: number) => `거절합니다 · 조달관이 ${pence(seized)}을 가져가고, 왕실의 신임을 잃습니다`,
  },
  levy_response: {
    title: "징집 명령",
    demand: (men: number) => `국왕이 군역을 명합니다: 어른 스무 명에 한 명, 모두 ${men}명.`,
    accept: (men: number, seasons: number) => `${men}명이 ${seasons}계절 떠납니다 · 다섯에 하나는 돌아오지 못합니다`,
    accept_with_price: (fee: number) => `면제금 ${pence(fee)}을 내고 아무도 보내지 않습니다`,
    refuse: () => "사람도 돈도 보내지 않습니다 · 왕실의 신임을 잃습니다",
  },
  war_funding: {
    title: "전쟁 보조세 요구",
    demand: (subsidy: number) => `국왕이 전쟁 보조세를 요구합니다: 동산의 10분의 1, ${pence(subsidy)}.`,
    accept: (repay: number, seasons: number) => `상인에게 빌려 곧바로 냅니다 · ${seasons}계절에 걸쳐 ${pence(repay)}을 갚습니다 · 상인 게이지 +10`,
    accept_with_price: (subsidy: number, surcharge: number, seasons: number) =>
      `금고에서 ${pence(subsidy)}을 냅니다 · ${seasons}계절 동안 지대를 ${percent(surcharge)} 더 걷습니다 · 가난한 가구가 떠날 수 있습니다`,
    refuse: () => "내지 않습니다 · 왕실의 신임을 잃습니다",
  },
  refugee_admission: {
    title: "피란민의 청원",
    demand: (households: number, people: number, room: number) =>
      `습격을 피해 온 ${households}가구(${people}명)가 받아 달라고 청합니다 · 지금 들일 자리는 ${room}가구분입니다.`,
    accept: () => "모두 받아들입니다 · 빈 집부터, 자리가 모자라면 들어간 만큼만",
    accept_with_price: (households: number, fee: number) => `절반(${households}가구)만 받고 가구당 ${pence(fee)}을 받습니다`,
    refuse: () => "돌려보냅니다",
  },
  wall_or_market: {
    title: "석벽과 시장 사이의 선택",
    demand: "습격이 지나갔습니다. 도시 사람들이 묻습니다: 돌로 성벽을 쌓을까요, 장을 넓힐까요?",
    accept: () => "석벽 사업을 합니다 · 선포 조건과 비용은 그대로입니다",
    accept_with_price: (favour: boolean) => favour ? "성벽세로 석벽을 쌓습니다 · 석벽이 다 설 때까지 통행세 × 2 · 상인 게이지 −5"
      : "왕실의 신임이 없어 성벽세가 붙지 않습니다 · 석벽 사업과 같습니다",
    refuse: () => "석벽을 포기하고 장을 넓힙니다 · 좌판세 × 2 · 상인 게이지 +5",
  },
  // UI-8: the four plague petitions (F3-A PL-5…PL-8), each offering exactly the def's two answers.
  vacant_priest: {
    title: "빈 사제 자리",
    demand: "첫 사망과 함께 사제가 역병으로 죽었습니다. 교회가 비어 있습니다.",
    /** PL-6: accept — monastery priest; refuse — lay clerk. */
    accept: (stipend: number) => `봉급 ${pence(stipend)}를 내고 수도원의 사제를 청합니다 · 두 계절 뒤에 옵니다 · 주교 세력 +10`,
    refuse: () => "평신도 서기를 세웁니다 · 돈이 들지 않고 곧 기도를 맡습니다 · 주교 세력 −15",
  },
  wages: {
    title: "일꾼들의 임금 요구",
    demand: (workers: number) => `역병이 지나 일손이 줄었습니다. 일꾼 ${workers}명이 임금 인상을 요구합니다.`,
    /** PL-5: accept — raise wages; refuse — hold by statute. */
    accept: "임금을 올립니다 · 장부 기간마다 일꾼 1인당 1d · 일꾼이 남습니다",
    refuse: () => "임금을 묶습니다 · 계절마다 가난한 가구가 임금을 주는 곳으로 떠날 수 있습니다",
  },
  land_redistribution: {
    title: "빈 필지의 주인",
    demand: (vacant: number) => `역병이 빈 필지 ${vacant}곳을 남겼습니다. 주민들이 어떻게 쓸지 청합니다.`,
    /** PL-7: accept — neighbours expand; accept_with_price — new settlers with entry fine. */
    accept: "이웃 가구가 빈 필지를 넓혀 씁니다 · 계절마다 한 가구씩 듭니다",
    accept_with_price: (households: number, fine: number) => `새 이주민을 받습니다 · 계절마다 ${households}가구씩, 가구당 ${pence(fine)}`,
  },
  cash_rent: {
    title: "부역을 돈으로 바꾸자는 청원",
    demand: "재정착이 시작됩니다. 소작인들이 부역 대신 화폐 지대를 청합니다.",
    /** PL-8: accept — commute to cash; refuse — keep labour services. */
    accept: () => "화폐 지대로 바꿉니다 · 지대 ×1.25 · 권리 목록에 화폐 지대 권리",
    refuse: () => "부역을 지킵니다 · 영주 시설 유지비 ×0.75 · 계절마다 가구가 달아날 수 있습니다",
  },
  // UI-9 (F4-A RG-5…RG-9): chapter 4 reorganisation petitions (two answers each — accept / refuse).
  // UI-9 (F4-A RG-5…RG-9): chapter 4's four cards; each answer's relations come from the engine's table (`relations`).
  guild_charter: {
    title: "길드 인가 청원",
    demand: "장인들이 직물 길드를 세우게 해 달라고 청합니다. 길드가 서면 직물 네 건물이 더 빨리 돌아갑니다.",
    accept: (relations: string) => `길드를 인가합니다 · 직물 네 건물 작업 ×¾ · 도시의 힘 +20 · 자치 요구가 1382년으로 · ${relations}`,
    refuse: (households: number, relations: string) => `거부합니다 · 다음 계절 직조공 ${households}가구가 떠남 · 직조 작업 ×1¼ · 반란 압력 +10 · ${relations}`,
  },
  tax_collection: {
    title: "인두세 징수 방식",
    demand: "국왕의 인두세(14세 이상 한 사람 4d)를 도시 공동체가 스스로 걷겠다고 청합니다. 국왕의 몫은 금고를 지나지 않고 영주의 몫만 듭니다.",
    accept: (perAdult: number, relations: string) => `도시 공동체에 맡깁니다 · 걷을 때마다 어른 한 사람당 ${pence(perAdult)} · ${relations}`,
    refuse: (perAdult: number, relations: string) => `영주의 징수원이 걷습니다 · 어른 한 사람당 ${pence(perAdult)} · 반란 압력 +40 · ${relations}`,
  },
  cloth_or_grain: {
    title: "직물 대 곡물",
    demand: "상인들이 영지의 쟁기밭을 양으로 돌려 직물에 걸자고 청합니다.",
    accept: (price: number, harvestPercent: number, relations: string) =>
      `직물에 겁니다 · 직물 값 ${pence(price)} · 흉년 수확 ${harvestPercent} %로 줄어듦(식량이 약해짐) · 반란 압력 +10 · ${relations}`,
    refuse: (relations: string) => `곡물을 지킵니다 · 바뀌는 것 없음 · ${relations}`,
  },
  borough_charter: {
    title: "자치 특허 협상",
    demand: "도시 공동체가 자치 특허를 청합니다. 시장 좌판세와 통행세 절반을 도시가 걷고, 그 대가로 해마다 영주에게 fee farm을 내겠다고 합니다.",
    accept: (feeFarm: number, relations: string) => `일부 허용합니다 · 시장 좌판세 도시로 · 통행세 절반 도시로 · 도시가 해마다 봄에 ${pence(feeFarm)} · ${relations}`,
    refuse: (relations: string) => `거부합니다 · 권리는 그대로 · 5장에 도시의 반발 · ${relations}`,
  },
  /** The relations an answer moves, short names (`REORGANISATION_RELATIONS`); the earl's line after his warning. */
  relations: (moves: readonly (readonly [who: string, delta: number])[]) => `관계 ${moves.map(([who, delta]) => `${who} ${delta > 0 ? "+" : "−"}${Math.abs(delta)}`).join(" · ")}`,
  relationNames: { town: "도시", merchant_house_1: "상인", overlord: "백작", crown: "국왕", commons: "평민" } as Readonly<Record<string, string>>,
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
