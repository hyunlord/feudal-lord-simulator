import type { RegistryCondition } from "../content/registry/registryTypes";
import type { EstatePolicy } from "../engine/townAgency.types";
import { POLICY_COPY } from "./lord/policyCopy.ko";
import { moneyShort } from "./money.ko";

// EVENT-ART: the registry event card's own words (lord mode; src/ui/hud/RegistryCard.tsx). The entry's title, body and
// answers are the registry's (src/content/registry/registryCopy.ko.ts); here are the frame's lines and "why it came"
// (identity 8, reasons are visible): each condition the engine checked, in words. A condition with no words yet is said
// generically — a raw field name never reaches the card.

type Leaf = Extract<RegistryCondition, { field: unknown }>;

const EVIDENCE: Readonly<Record<string, string>> = {
  charter: "특허장", deed: "재산 증서", court_roll: "법정 기록", witnesses: "증인 증언", possession_years: "점유한 햇수",
};
const SUIT_STAGE: Readonly<Record<string, string>> = {
  filed: "소장을 낸", evidence: "증거를 모으는", patronage: "후원을 구하는", hearing: "심리 중인", judged: "판결이 난", enforcing: "점유를 집행할", closed: "끝난",
};
const policyName = (value: unknown): string | null => typeof value === "string" && Object.hasOwn(POLICY_COPY.policies, value) ? POLICY_COPY.policies[value as EstatePolicy] : null;
const words = (value: Leaf["value"], name: (item: unknown) => string | null): string | null => {
  const items = (Array.isArray(value) ? value : [value]).map(name);
  return items.some(item => item === null) ? null : items.join("·");
};
/** 이/가 after a word (its last syllable's final consonant). */
const subject = (word: string) => { const code = word.charCodeAt(word.length - 1) - 0xac00; return `${word}${code >= 0 && code < 11172 && code % 28 !== 0 ? "이" : "가"}`; };
const atLeast = (op: Leaf["op"]) => op === "gte" ? "이상" : op === "lte" ? "이하" : null;

/** One condition in words, or null when it has none yet (the card then says it generically). */
export function conditionWords(leaf: Leaf): string | null {
  const { op, value } = leaf;
  const bound = atLeast(op);
  switch (leaf.field) {
    case "market.exists": return op === "eq" && value === true ? "장터가 서 있습니다" : op === "eq" && value === false ? "장터가 아직 없습니다" : null;
    case "market.duesPermille": {
      if (typeof value !== "number") return null;
      const percent = `${Math.round(value / 10)}%`;
      return op === "eq" ? `시장 좌판세가 기본의 ${percent}입니다` : bound === null ? null : `시장 좌판세가 기본의 ${percent} ${bound}입니다`;
    }
    case "treasury": return typeof value === "number" && bound !== null ? `금고에 ${moneyShort(value)} ${bound} 있습니다` : null;
    case "agency.policy": {
      const names = words(value, policyName);
      return names === null ? null : op === "in" ? `영지 방침이 ${names} 가운데 하나입니다` : op === "eq" ? `영지 방침이 ${names}입니다` : null;
    }
    case "bound.suitStage": {
      const stages = words(value, item => typeof item === "string" ? SUIT_STAGE[item] ?? null : null);
      return stages === null || (op !== "in" && op !== "eq") ? null : `걸린 소송이 ${stages} 단계입니다`;
    }
    case "bound.evidence": {
      const kind = typeof value === "string" ? EVIDENCE[value] ?? null : null;
      return kind === null ? null : op === "lacks" ? `소송에 ${subject(kind)} 아직 없습니다` : op === "has" ? `소송에 ${subject(kind)} 이미 있습니다` : null;
    }
    case "bound.revealedKept": return op === "gte" && value === 1 ? "감사에서 청지기가 감춘 돈이 드러났습니다" : null;
    case "bound.stewardConnected": return op === "eq" && value === true ? "그 청지기 뒤에 연줄 있는 세력이 있습니다" : null;
    case "bound.stewardLoyalty": return typeof value === "number" && bound !== null ? `그 청지기의 충성이 ${value} ${bound}입니다` : null;
    case "estates.delegated": return typeof value === "number" && op === "gte" ? `청지기에게 맡긴 영지가 ${value}곳 이상입니다` : null;
    case "steward.lordDecided": return typeof value === "number" && op === "gte" ? `맡긴 영지의 청원에 영주가 직접 답한 일이 ${value}번 이상 있습니다` : null;
    case "steward.rules.amountAtLeast": return op === "gte" && value === 0 ? "금액으로 거르는 예외 규칙이 걸려 있습니다" : null;
    case "timber.order": return op === "eq" && value === 0 ? "주문해 둔 목재가 없습니다" : null;
    default: return null;
  }
}

export const REGISTRY_CARD_COPY = {
  /** The card's kicker: who sends it. */
  from: (name: string) => `보낸 쪽 · ${name}`,
  fromHouse: "영주 가문",
  fromUnknown: "영지에 온 일",
  /** An entry the registry has no words for (one added before its copy). */
  title: "영지에 온 일",
  choice: (index: number) => `${index}번째 답`,
  /** How long the offer waits (the engine's deadline: days left, and the season it ends in). */
  waits: (days: number, year: number, season: string) => `답을 기다림 · ${days}일 남음(${year}년 ${season}까지)`,
  whyHeading: "왜 왔나",
  drawn: (permille: number) => `이번 철 추첨에 뽑혔습니다(이 일이 올 가능성 ${Math.round(permille / 10)}%)`,
  noConditions: "따로 맞아야 할 조건이 없는 일입니다",
  /** An `any`: its parts (each a list of lines) as one line. */
  anyOf: (parts: readonly (readonly string[])[]) => parts.map(lines => lines.join(", ")).join(" 또는 "),
  /** A condition the card has no words for yet. */
  unknownCondition: "이 일의 조건 하나가 맞았습니다(아직 풀이가 없는 조건)",
  /** A shut answer: the engine would not carry it out now. */
  shut: "지금은 고를 수 없습니다",
  /** A choice's own condition not met, as what it needs ("금고에 40d 이상 있어야 합니다"). */
  needs: (line: string) => `지금은 고를 수 없습니다: ${line.replace(/있습니다$/, "있어야 합니다").replace(/없습니다$/, "없어야 합니다").replace(/입니다$/, "이어야 합니다")}`,
  needsUnknown: "지금은 고를 수 없습니다: 이 답의 조건이 맞지 않습니다",
  already: "지금은 고를 수 없습니다: 이미 그렇게 정해져 있습니다",
  /** What an unanswered offer does at its deadline. */
  lapse: (label: string | null) => label === null ? "답하지 않으면 기한이 지나 그대로 넘어갑니다" : `답하지 않으면 기한에 "${label}"(으)로 정해집니다`,
  advice: "답하면 바로 장부에 적힙니다. 나중에 정해도 기한까지 기다립니다",
} as const;
