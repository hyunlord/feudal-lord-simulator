import type { Compass, StuckGoodsReason } from "./stuckGoodsModel";

/** UI-AUDIT-1: the HUD's stuck-goods chip (`북쪽 헛간에 밀 800 묶임`). */
export const STUCK_GOODS_COPY = {
  regionLabel: "묶인 물자",
  where: {
    north: "북쪽", northEast: "북동쪽", east: "동쪽", southEast: "남동쪽",
    south: "남쪽", southWest: "남서쪽", west: "서쪽", northWest: "북서쪽", centre: "성채 곁",
  } satisfies Record<Compass, string>,
  /** `북쪽 헛간에 밀 800 묶임`. */
  line: (where: string, building: string, good: string, amount: number) => `${where} ${building}에 ${good} ${amount.toLocaleString("ko-KR")} 묶임`,
  /** The short reason after the line; `store` is the good's receiver (곡창, 창고). */
  reason: {
    no_road: () => "길 없음",
    no_receiver: (store: string) => `${store} 없음`,
    receiver_full: (store: string) => `${store} 가득`,
    no_carrier: () => "운반꾼 부족",
    unknown: () => "나가지 않음",
  } satisfies Record<StuckGoodsReason, (store: string) => string>,
  /** More piles than the one shown: `외 2곳`. */
  more: (count: number) => `외 ${count}곳`,
  /** The pile's harvest is being lost in the field behind the full barn. */
  spoiling: (reason: string) => `${reason} · 수확 버려짐`,
  /** Accessible name: the whole line, the reason, and what a press does. */
  pressLabel: (line: string, reason: string) => `${line} — ${reason}. 누르면 그 건물로 갑니다`,
} as const;
