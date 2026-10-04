import type { StuckReason } from "../engine/stuckStock";
import type { Compass } from "./stuckGoodsModel";

/** UI-AUDIT-1: the HUD's stuck-goods chip (`북쪽 헛간에 밀 800 묶임`). LM-R1: the engine's reasons (FIX-11 SK-1). */
export const STUCK_GOODS_COPY = {
  regionLabel: "묶인 물자",
  where: {
    north: "북쪽", northEast: "북동쪽", east: "동쪽", southEast: "남동쪽",
    south: "남쪽", southWest: "남서쪽", west: "서쪽", northWest: "북서쪽", centre: "성채 곁",
  } satisfies Record<Compass, string>,
  /** `북쪽 헛간에 밀 800 묶임`. */
  line: (where: string, building: string, good: string, amount: number) => `${where} ${building}에 ${good} ${amount.toLocaleString("ko-KR")} 묶임`,
  /** The short reason after the line (the engine's `stuckStock` reason). */
  reason: {
    no_road: "길 없음",
    no_carrier: "운반꾼 부족",
    receiver_full: "받을 곳 가득",
  } satisfies Record<StuckReason, string>,
  /** `receiver_full`: the store the pile waits on and how full it is (`창고 200/200`). */
  storeFullness: (store: string, used: number, capacity: number) => `${store} ${used.toLocaleString("ko-KR")}/${capacity.toLocaleString("ko-KR")}`,
  /** The reason with the store's fullness: `받을 곳 가득 · 창고 200/200`. */
  withStore: (reason: string, store: string) => `${reason} · ${store}`,
  /** More piles than the one shown: `외 2곳`. */
  more: (count: number) => `외 ${count}곳`,
  /** The engine's field entry: this year's ripe wheat the full barn could not take. */
  spoiling: (reason: string) => `${reason} · 수확 버려짐`,
  /** Accessible name: the whole line, the reason, and what a press does. */
  pressLabel: (line: string, reason: string) => `${line} — ${reason}. 누르면 그 건물로 갑니다`,
  /** LM-R1: the inspector's jump from the pile's building to the full store it waits on. */
  toStore: (store: string) => `${store} 보기`,
  toStoreLabel: (fullness: string) => `${fullness} — 누르면 그 건물로 갑니다`,
} as const;
