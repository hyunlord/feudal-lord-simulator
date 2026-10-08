// SUIT-THREAD (DTR-23; Astra lordplay2 friction 1, "영주가 막을 명령은 없습니다"): the ledger's words for the lord sued —
// his defence in a house's suit against him (`suitDefenceActions`: evidence, a patron, the final concord, the hold) — and
// for a forcible entry forewarned (`entryThreats`, `entryDefenceCosts`: the guard, the gift). The canon's terms
// (docs/design/glossary.md): 최종 합의(짧게 '합의'), 점유 침탈 소송, 강제 점거, 남은 권리. Each refusal the engine
// gives is a sentence here, keyed by its reason; costs, weights and supports are the engine's numbers.
import type { SuitDefenceActions } from "../../../engine/suitDefence";

type Refusal<K extends keyof SuitDefenceActions> = NonNullable<SuitDefenceActions[K] extends readonly (infer E)[] ? E extends { readonly refusal: infer R } ? R : never
  : SuitDefenceActions[K] extends { readonly refusal: infer R } ? R : never>;

export const SUIT_DEFENCE_COPY = {
  heading: "영주의 방어",
  evidenceHeading: "방어 증거",
  evidenceLabel: (kind: string, note: string) => `방어 증거 내기: ${kind} · ${note}`,
  evidenceRefusals: { stage: "증거는 소송이 제기·증거 단계일 때만 낼 수 있습니다", given: "이미 냈습니다", treasury: "금고가 모자랍니다" } satisfies Record<Refusal<"evidence">, string>,
  patronHeading: "방어 후원자",
  patronChosen: (name: string, support: number) => `${name} · 지지 ${support}`,
  patronSupport: (support: number) => `지지 ${support}`,
  patronLabel: (name: string, support: number) => `방어 후원 청하기: ${name} · 지지 ${support}`,
  patronRefusals: { stage: "후원은 소송이 후원 단계일 때만 청할 수 있습니다", chosen: "이미 후원자를 얻었습니다", relation: "후원을 청할 만큼 관계가 좋은 세력이 없습니다" } satisfies Record<Refusal<"patrons">, string>,
  concordHeading: "합의",
  concordNote: "합의하면 소송이 끝나고, 그 가문의 남은 권리도 끝납니다",
  pay: (money: string) => `돈을 주고 지키기 · ${money}`,
  payLabel: (what: string, money: string) => `합의: 돈을 주고 ${what} 지키기 · ${money}`,
  yieldPiece: "땅을 내주기",
  yieldLabel: (what: string) => `합의: ${what} 내주기`,
  concordRefusals: { treasury: "금고가 모자랍니다" } satisfies Record<Refusal<"concord">, string>,
  holdHeading: "버티기",
  holdLine: (hold: number, boost: number) => `지금 버티는 힘 ${hold} · 사람을 들이면 +${boost}`,
  hold: (money: string) => `사람을 들여 버티기 · ${money}`,
  holdLabel: (what: string, money: string) => `사람을 들여 버티기: ${what} · ${money}`,
  holdRefusals: {
    stage: "버티기는 판결에 진 뒤 점유 집행 단계에서 할 수 있습니다", not_possessor: "영주가 점유하고 있지 않아 버틸 것이 없습니다",
    held: "올해는 이미 사람을 들였습니다", treasury: "금고가 모자랍니다",
  } satisfies Record<Refusal<"hold">, string>,
  // DTR-23 (S3): a forcible entry forewarned.
  threatsHeading: "강제 점거 예고",
  threatWhen: (house: string, date: string, due: string, when: string) => `상대 ${house} · 예고 ${date} · 올 때 ${due}(${when})`,
  guarded: "지킬 사람을 들였습니다",
  guard: (money: string) => `지킬 사람 들이기 · ${money}`,
  guardLabel: (what: string, money: string) => `지킬 사람 들이기: ${what} · ${money}`,
  appease: (money: string) => `선물로 달래기 · ${money}`,
  appeaseLabel: (house: string, money: string) => `선물로 달래기: ${house} · ${money}`,
  pastHeading: "지난 강제 점거",
} as const;
