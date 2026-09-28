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
