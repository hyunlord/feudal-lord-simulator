/**
 * LM-E9b (spec docs/design/registry.md ER-19, R3, the user's decision 2026-10-04): the canon v4's senders (events-v4.json
 * `sender.faction`, free text) that read as one faction of the engine. A hold's cost to a sender's relation applies only
 * to these; a compound or unclear sender ("도시 공동체·거래 당사자", "장인과 상인") is not guessed (the hold is hidden).
 */
export const V4_SENDER_FACTION: Readonly<Record<string, string>> = {
  "상인 가문": "merchant_house_1",
  "첫째 상인 가문": "merchant_house_1",
  "도시 공동체": "town",
  "농민 공동체": "commons",
  "소작인 공동체": "commons",
  "교회": "bishop",
  "교회 측": "bishop",
  "본당": "bishop",
  "왕실": "crown",
};
