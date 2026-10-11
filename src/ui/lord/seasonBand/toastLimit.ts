import { useRef } from "react";

import { BALANCE } from "../../../content/balanceConfig";

const SEASON_TICKS = BALANCE.TICKS_PER_YEAR / 4;

/** The completion toast last let through (its first moment) and its season. */
export type ToastSeen = Readonly<{ firstAtMs: number; season: number }>;

/**
 * LS1-1 (lord-screen-v1.md §2): in lord mode one completion toast a season — the first that comes shows (VIS-1: they read
 * well); the season's later ones are the season-turn band's "새 건물 N". The same toast stays let through while it shows.
 */
export function toastLetThrough(seen: ToastSeen | null, toast: { readonly firstAtMs: number } | null, season: number): boolean {
  if (toast === null) return false;
  if (seen === null || seen.firstAtMs === toast.firstAtMs) return true;
  return seen.season !== season;
}

/** The hook form: `enabled` (lord mode) applies the limit; off, every toast is let through. */
export function useSeasonToastLimit(toast: { readonly firstAtMs: number } | null, tick: number, enabled: boolean): boolean {
  const seen = useRef<ToastSeen | null>(null);
  if (!enabled || toast === null) return toast !== null;
  const season = Math.floor(tick / SEASON_TICKS);
  const through = toastLetThrough(seen.current, toast, season);
  if (through && seen.current?.firstAtMs !== toast.firstAtMs) seen.current = { firstAtMs: toast.firstAtMs, season };
  return through;
}
