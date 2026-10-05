/**
 * LM-E9b (spec docs/design/registry.md ER-19, R3): what a hold costs — a hold is a real choice only when time costs it.
 * - A claim (or a suit's claim) held weakens: its strength (0–100, before evidence) falls by HOLD_CLAIM_WEAKEN.
 * - A sender that reads as one faction loses HOLD_RELATION_DELTA of its relation (the history ledger moves it).
 * - A promise or a negotiation held runs on toward its own deadline (the engine's broken-promise and withdrawal rules).
 * Game estimates, not measured: a claim needs about 20 strength more to win a hearing it would lose (estateConfig).
 */
export const HOLD_CLAIM_WEAKEN = 5;
export const HOLD_RELATION_DELTA = -2;
