/**
 * DEC-TRACE (the user's decision 2026-10-06, docs/design/dec-trace.md): choices held off after the v4.2 audit — their
 * commands only set a subsidy or the estate policy (the audit's `indirect`), which promises the card's matter without
 * reaching it. An event left with fewer than two choices is held whole (`registryV4.ts`). They come back on when the
 * thread of consequence can show "this household built that because of the subsidy" and the card says so honestly:
 * "a subsidy lets households build by their reasons".
 */
export interface HeldChoice {
  readonly entry: string;
  readonly choice: string;
  readonly reason: string;
}

const SUBSIDY_ONLY = "장려금만 거는 선택이라 카드의 일(길·병·징발)을 직접 바꾸지 않는다 — 장려금은 가구가 이유에 따라 지을 수 있게 할 뿐(v4.2 감사의 indirect)";
const POLICY_ONLY = "영지 방침만 바꾸는 선택이라 카드의 일을 직접 바꾸지 않는다(v4.2 감사의 indirect)";

export const V4_HELD_CHOICES: readonly HeldChoice[] = [
  { entry: "ck_evt_024", choice: "market_promise", reason: SUBSIDY_ONLY },
  { entry: "ck_evt_042", choice: "encourage", reason: SUBSIDY_ONLY },
  { entry: "ck_evt_102", choice: "b", reason: SUBSIDY_ONLY },
  { entry: "ck_evt_102", choice: "c", reason: SUBSIDY_ONLY },
  { entry: "ck_evt_123", choice: "b", reason: SUBSIDY_ONLY },
  { entry: "ck_evt_123", choice: "c", reason: POLICY_ONLY },
  { entry: "ck_evt_138", choice: "b", reason: SUBSIDY_ONLY },
  { entry: "ck_evt_138", choice: "c", reason: SUBSIDY_ONLY },
  { entry: "ck_evt_144", choice: "a", reason: SUBSIDY_ONLY },
  { entry: "ck_evt_083", choice: "b", reason: SUBSIDY_ONLY },
  { entry: "ck_evt_090", choice: "b", reason: SUBSIDY_ONLY },
  { entry: "ck_evt_092", choice: "c", reason: POLICY_ONLY },
];

/** The words of an event held whole because too few choices were left. */
export const TOO_FEW_CHOICES_LEFT = "선택지를 끄고 나니 두 개 미만이 남았다";
