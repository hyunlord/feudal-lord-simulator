/**
 * The chapters' petitions: what each answer means (`accept` / `accept_with_price` / `refuse` / `expired`), in the words of
 * the choice itself — the ledger's decision lines, the petition cards (as `WAR_CHOICES`) and, COPY-1e (CA-001), the
 * factions' memory read them, so an answer that is no refusal (a legacy to the church, a nephew as heir) is never written
 * "refused".
 */
export const PETITION_CHOICES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  wool_payment: { accept: "현물로 낸다", accept_with_price: "현금으로 낸다", refuse: "거절", expired: "답하지 않음" },
  levy_response: { accept: "사람을 보낸다", accept_with_price: "면제금을 낸다", refuse: "거절", expired: "답하지 않음" },
  war_funding: { accept: "상인에게 빌린다", accept_with_price: "세금을 올린다", refuse: "거절", expired: "답하지 않음" },
  refugee_admission: { accept: "모두 받아들인다", accept_with_price: "절반만 받는다", refuse: "돌려보낸다", expired: "답하지 않음" },
  wall_or_market: { accept: "석벽을 쌓는다", accept_with_price: "성벽세로 석벽을 쌓는다", refuse: "시장을 넓힌다", expired: "답하지 않음" },
  vacant_priest: { accept: "수도원에 사제를 청한다", refuse: "평신도 서기를 세운다", expired: "답하지 않음" },
  wages: { accept: "임금을 올린다", refuse: "조례대로 묶는다", expired: "답하지 않음" },
  land_redistribution: { accept: "이웃 가구가 넓혀 쓴다", accept_with_price: "새 이주민을 받는다", expired: "답하지 않음" },
  cash_rent: { accept: "돈으로 바꾼다", refuse: "부역을 지킨다", expired: "답하지 않음" },
  guild_charter: { accept: "길드를 인가한다", refuse: "길드를 거부한다", expired: "답하지 않음" },
  tax_collection: { accept: "도시 공동체에 맡긴다", refuse: "영주의 징수원이 걷는다", expired: "답하지 않음" },
  cloth_or_grain: { accept: "직물에 걸고 쟁기밭을 양에게 준다", refuse: "곡물을 지킨다", expired: "답하지 않음" },
  borough_charter: { accept: "시장과 통행세 일부를 넘긴다", refuse: "특허를 거절한다", expired: "답하지 않음" },
  royal_tax: { accept: "보조세를 낸다", refuse: "감면을 청원한다", expired: "답하지 않음" },
  heir_choice: { accept: "맏아들에게 잇게 한다", accept_with_price: "딸의 남편에게 잇게 한다", refuse: "조카에게 잇게 한다", expired: "답하지 않음" },
  borough_autonomy: { accept: "자치 특허에 인장을 찍는다", refuse: "가문이 계속 다스린다", expired: "답하지 않음" },
  legacy_choice: { accept: "도시에 길드홀과 시청을 남긴다", accept_with_price: "가문의 영주관과 문장, 혈통 기록을 남긴다", refuse: "교회를 넓히고 기도처를 세운다", expired: "답하지 않음" },
  guild_dispute: { accept: "길드 편을 든다", refuse: "상인 편을 든다", expired: "답하지 않음" },
  church_rebuilding: { accept: "교회를 넓혀 짓는다", refuse: "증축을 미룬다", expired: "답하지 않음" },
};
