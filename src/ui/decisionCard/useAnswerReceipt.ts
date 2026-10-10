import { useCallback, useState } from "react";
import { useGameApi } from "../../state/gameStore";
import type { GameAction } from "../../state/gameStore.types";
import type { UiModal } from "../stateMachine/uiStateMachine";
import { answerReceipt, type AnswerMeta, type AnswerReceiptView } from "./answerReceiptModel";

// RECEIPTS: the lord answers a heavy decision through this, and its card turns over to the answer's receipt in the same
// modal (time stays stopped until the lord closes it). The state is read just before and just after the command, on the
// store itself (the reducer runs it at once), and only the receipt's words are kept, never the two states (LEAK-1).

export type ShownReceipt = AnswerReceiptView & Readonly<{ modal: UiModal }>;

export function useAnswerReceipt() {
  const api = useGameApi();
  const [receipt, setReceipt] = useState<ShownReceipt | null>(null);
  /** Gives the answer; true when the engine took it (its receipt is up), false when it refused it (nothing changed). */
  const answer = useCallback((modal: UiModal, command: GameAction, meta: AnswerMeta): boolean => {
    const before = api.getState();
    api.dispatch(command);
    const after = api.getState();
    if (after === before) return false;
    setReceipt({ ...answerReceipt(before, after, meta), modal });
    return true;
  }, [api]);
  const close = useCallback(() => setReceipt(null), []);
  return { receipt, answer, close };
}
