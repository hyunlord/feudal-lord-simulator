import { useSyncExternalStore } from "react";

// LR1-D7 (user 2026-10-05): the line a mode's start shows once — the sandbox's build guidance, lord mode's goal — which the
// welcome no longer says. Kept outside React state as the loading screen is (chapterLoadingStore.ts): a start that sends
// start_new_game remounts the whole app, so App's own state would lose it in the same click.

/** How long the hint stays (the loading screen's 900 ms, then time to read one line). */
export const START_HINT_MS = 9_000;

let text: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Shows `hint` for START_HINT_MS (null clears it; a second start replaces it). */
export function showStartHint(hint: string | null): void {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
  text = hint;
  if (hint !== null) timer = setTimeout(() => { text = null; timer = undefined; emit(); }, START_HINT_MS);
  emit();
}

export function startHint(): string | null {
  return text;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** The start hint on screen (the same before and after the store's remount). */
export function useStartHint(): string | null {
  return useSyncExternalStore(subscribe, startHint, () => null);
}
