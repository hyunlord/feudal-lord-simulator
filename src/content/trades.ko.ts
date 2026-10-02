/** LM-E6a (docs/design/trades.md): the trades' names and their receipt, bottleneck and street lines (terms: docs/design/glossary.md). */
import { resourceName } from "./resourceCatalog.ko";
import type { ResourceType } from "./resourceConfig";
import type { LocationFactor, TradeChain, TradeGood, TradeId, WorkshopArchetype } from "./trades";
import { TRADE_BY_ID } from "./trades";
import type { ChainState, TradeReason } from "../engine/trades.types";

export const TRADE_NAMES: Readonly<Record<TradeId, string>> = {
  baker: "제빵사", brewer: "양조인", butcher: "푸줏간 주인", miller: "방앗간지기", innkeeper: "여관 주인", tailor: "재단사",
  weaver: "직조공", smith: "대장장이", carpenter: "목수", shoemaker: "구두장이", carter: "수레꾼", merchant: "상인",
  fuller: "축융공", dyer: "염색공", tanner: "무두장이", cooper: "통장이", wheelwright: "수레장이", mercer: "잡화상",
  spicer: "향료상", vintner: "포도주상",
};

export const WORKSHOP_NAMES: Readonly<Record<WorkshopArchetype, string>> = {
  front_shop: "앞방 점포", back_workshop: "후면 공방", big_yard: "큰 뒷마당", dirty_yard: "더러운 뒷마당", edge_stink_yard: "외곽 냄새 마당",
  forge: "대장간", waterside: "물가 공방", water_mill: "수력 공방", warehouse_shop: "창고상점", institution: "기관", no_shop: "무점포", itinerant: "순회",
};

export const TRADE_GOOD_NAMES: Readonly<Record<TradeGood | "livestock" | "bark" | "stores" | "none", string>> = {
  meat: "고기", hides: "생가죽", leather: "가죽", shoes: "구두", cloth: "생모직", fulled_cloth: "축융 모직", dyed_cloth: "염색 모직",
  garments: "옷", iron: "철", tools: "연장", barrels: "통", carts: "수레", dyes: "염료", wine: "포도주", spices: "향신료", smallwares: "잡화",
  livestock: "가축", bark: "나무껍질", stores: "창고 물자", none: "없음",
};

export const CHAIN_NAMES: Readonly<Record<TradeChain, string>> = {
  grain: "곡물·빵", ale: "에일", meat_leather: "고기·가죽", cloth: "모직", metal: "금속", wood: "목재", commerce: "상업·운송",
};

const FACTOR_NAMES: Readonly<Record<Exclude<LocationFactor, "raw" | "nuisance">, string>> = {
  customers: "손님", kin: "친족", water: "물", road: "길", plot: "필지", rent: "임대료", competition: "경쟁",
};

/** An input's name: a trade good, the land's supply, or a game resource. */
export function inputName(subject: string): string {
  return (TRADE_GOOD_NAMES as Readonly<Record<string, string>>)[subject] ?? resourceName(subject as ResourceType);
}

const signed = (value: number) => (value >= 0 ? `+${value}` : `−${-value}`);

function reasonName(tradeId: TradeId, reason: TradeReason): string {
  if (reason.factor === "raw") return inputName(reason.subject ?? "none");
  if (reason.factor === "nuisance") return TRADE_BY_ID.get(tradeId)?.nuisance === "fire" ? "화재 규정" : "악취 규정";
  return FACTOR_NAMES[reason.factor];
}

/** TR-3: "무두장이: 생가죽 +28 · 물 +23 · 친족 +15 · 악취 규정 −8" (largest items first). */
export function tradeReceiptLine(tradeId: TradeId, reasons: readonly TradeReason[]): string {
  const items = [...reasons].sort((left, right) => Math.abs(right.value) - Math.abs(left.value)).map(reason => `${reasonName(tradeId, reason)} ${signed(reason.value)}`);
  return `${TRADE_NAMES[tradeId]}: ${items.join(" · ")}`;
}

/** TR-6: "고기·가죽 생산성 38% — 무두장이, 주원인: 나무껍질 부족(2일분)". */
export function chainLine(chain: TradeChain, state: ChainState): string {
  const percent = Math.round(state.productivityPermille / 10);
  const who = state.tradeId === null ? "" : `${TRADE_NAMES[state.tradeId]}, `;
  const cause = state.cause.kind === "input" ? `${inputName(state.cause.subject)} 부족(${state.cause.days}일분)`
    : state.cause.kind === "demand" ? "살 사람 부족" : "없음";
  return `${CHAIN_NAMES[chain]} 생산성 ${percent}% — ${who}주원인: ${cause}`;
}

const STREET_NAMES: Readonly<Partial<Record<TradeId, string>>> = {
  butcher: "푸줏간 거리", tanner: "무두장이 거리", weaver: "직조공 거리", smith: "대장간 거리", baker: "빵집 거리", tailor: "재단사 거리",
  shoemaker: "구두장이 거리", fuller: "축융공 거리", dyer: "염색공 거리", brewer: "양조 거리", merchant: "상인 거리", carpenter: "목수 거리",
};

/** TR-8: the street's name (Butcher Row → "푸줏간 거리"). */
export function streetName(tradeId: TradeId): string {
  return STREET_NAMES[tradeId] ?? `${TRADE_NAMES[tradeId]} 거리`;
}
