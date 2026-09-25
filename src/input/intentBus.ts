import type { InputIntent } from "./inputIntent";

// The intent stream (B9): producers (the mouse / keyboard translator today, touch and controller later) emit, game
// and UI handlers subscribe. Handlers run in `order` (lower first, then subscription order). A handler returns
// "handled" when it acted on the intent, or "consumed" when it acted and later handlers must not see it (the zone
// brush's Esc drops only its own gesture, as `stopImmediatePropagation` did before). `emit` returns whether any
// handler acted, which the translator uses to decide `preventDefault`.

/** Where the input was aimed: the map, a native control (button, summary, card), or a text field. */
export type IntentTarget = "world" | "control" | "text";

export type IntentContext = { readonly target: IntentTarget };

export type IntentResult = "handled" | "consumed" | void;

export type IntentHandler = (intent: InputIntent, context: IntentContext) => IntentResult;

/** Handler order: the world handler (canvas) first, then the app shell, then menus. */
export const INTENT_ORDER = { world: 0, app: 10, menu: 20 } as const;

export type IntentBus = {
  readonly emit: (intent: InputIntent, context?: IntentContext) => boolean;
  readonly subscribe: (handler: IntentHandler, order?: number) => () => void;
};

const WORLD: IntentContext = { target: "world" };

export function createIntentBus(): IntentBus {
  let handlers: { readonly handler: IntentHandler; readonly order: number; readonly serial: number }[] = [];
  let serial = 0;
  return {
    emit(intent, context = WORLD) {
      let handled = false;
      for (const entry of [...handlers]) {
        const result = entry.handler(intent, context);
        if (result === "consumed") return true;
        if (result === "handled") handled = true;
      }
      return handled;
    },
    subscribe(handler, order = INTENT_ORDER.app) {
      const entry = { handler, order, serial: serial += 1 };
      handlers = [...handlers, entry].sort((a, b) => a.order - b.order || a.serial - b.serial);
      return () => { handlers = handlers.filter(candidate => candidate !== entry); };
    },
  };
}
