import { useSyncExternalStore } from "react";

// UI-3 / NAT-4: the new game's loading screen (App `.chapter-loading`, CHAPTER_LOADING_MS) kept outside React state.
// A start that sends start_new_game replaces the state, and the game store then remounts the whole app (gameStore.ts
// `sessionKey`), so a flag in App's own state was reset in the same click: the screen showed only on the riverside's
// map 1, which sends nothing (LU-D7). Every start since NAT-4 opens on a random map number and sends the command, so
// the screen never showed. Here the flag and its timer live at module level and survive the remount.

let visible = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Shows the loading screen for `ms` (a second start restarts the time). */
export function showChapterLoading(ms: number): void {
  if (timer !== undefined) clearTimeout(timer);
  visible = true;
  timer = setTimeout(() => { visible = false; timer = undefined; emit(); }, ms);
  emit();
}

export function chapterLoadingVisible(): boolean {
  return visible;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Whether the loading screen is up (the same answer before and after the store's remount). */
export function useChapterLoading(): boolean {
  return useSyncExternalStore(subscribe, chapterLoadingVisible, () => false);
}
