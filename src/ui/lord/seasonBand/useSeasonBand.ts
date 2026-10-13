import { useEffect, useRef, useState } from "react";

import type { GameState } from "../../../engine/engine.types";
import { seasonJustClosed } from "../../seasonLedgerCard";
import { scenarioOf } from "../../../engine/scenarioState";
import { seasonStewardView } from "../steward/seasonStewardModel";
import { recordTownClose } from "./townCloses";
import { growthBlock } from "../../../engine/growthBlock";
import { GROWTH_COPY } from "../growth/growthCopy.ko";
import { growthView } from "../growth/growthMark";
import { growthHeldQuery, noteGrowthClose, startGrowthTrack } from "../growth/growthTrack";
import { seasonBand, townSize, townSnapshot, type SeasonBand, type TownSnapshot } from "./seasonBandModel";

/** LS1-2: how long the band stays (real time; a newer band replaces it sooner; held while the pointer is on it). */
export const SEASON_BAND_MS = 5_000;
/** The time in use: SEASON_BAND_MS, or the proof query `season-band-ms=<ms>` (the audit holds the band to measure and
 * press it on a busy machine, as `story-delay` holds a card's world). */
export function seasonBandMs(): number {
  if (typeof window === "undefined") return SEASON_BAND_MS;
  const value = Number(new URLSearchParams(window.location.search).get("season-band-ms"));
  return Number.isFinite(value) && value > 0 ? value : SEASON_BAND_MS;
}

/**
 * LS1-2 (lord-screen-v1.md): the season-turn band, lord mode only — at every season's close, at every speed, the town's
 * changes in it (seasonBand) for SEASON_BAND_MS or until the next. Its `before` is the town at the prior close (a new
 * game's first tick counts as one); after a load or a jump of seasons it starts again from the next close.
 */
export function useSeasonBand(state: GameState, enabled: boolean): { readonly band: SeasonBand | null; readonly hold: (held: boolean) => void; readonly dismiss: () => void } {
  const history = state.seasons?.history ?? [];
  const lastEnd = history.at(-1)?.endTick ?? null;
  const priorEnd = history.at(-2)?.endTick ?? null;
  const lastEndRef = useRef(lastEnd);
  const snapshotRef = useRef<TownSnapshot | null>(null);
  // LS1-3: the stop's count starts with the page — a new game knows the town's growth from its first tick, a load does not.
  const trackRef = useRef(false);
  if (!trackRef.current) { trackRef.current = true; startGrowthTrack(state.tick < 5, townSize(townSnapshot(state)), growthHeldQuery()); }
  // A new game's first tick counts as the close before it (LS1-5: its first year's start).
  if (snapshotRef.current === null && state.tick < 5) {
    snapshotRef.current = townSnapshot(state);
    recordTownClose(scenarioOf(state).startYear - 1, 3, snapshotRef.current);
  }
  const [band, setBand] = useState<SeasonBand | null>(null);
  const [held, setHeld] = useState(false);
  const [shownAt, setShownAt] = useState(0);
  const [stayMs] = useState(seasonBandMs);
  useEffect(() => {
    const previous = lastEndRef.current;
    lastEndRef.current = lastEnd;
    if (previous === lastEnd) return;
    const closed = history.at(-1);
    const after = townSnapshot(state);
    if (closed !== undefined) { recordTownClose(closed.year, closed.season, after); noteGrowthClose(closed.year, closed.season, growthBlock(state), townSize(after)); }
    if (!enabled || closed === undefined || !seasonJustClosed(previous, lastEnd, priorEnd)) { snapshotRef.current = after; return; }
    const stewardHandled = seasonStewardView(state, closed.startTick)?.items.length ?? 0;
    const growth = growthView(state);
    setBand(seasonBand({ season: closed, before: snapshotRef.current, after, stewardHandled,
      growth: growth === null || growth.mark === null ? null : GROWTH_COPY.band(growth.years, growth.reason) }));
    setShownAt(performance.now());
    snapshotRef.current = after;
  // why: keyed by the season's close only; the state read is the close's own
  }, [lastEnd]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (band === null || held) return undefined;
    const timer = window.setTimeout(() => setBand(null), Math.max(0, stayMs - (performance.now() - shownAt)));
    return () => window.clearTimeout(timer);
  }, [band, held, shownAt, stayMs]);
  return {
    band: enabled ? band : null,
    // Held while the pointer is on it; let go, it stays its full time again from then.
    hold: next => { setHeld(next); if (!next) setShownAt(performance.now()); },
    dismiss: () => setBand(null),
  };
}
