import { useEffect, useRef, useState } from "react";

import { BALANCE } from "../content/balanceConfig";
import { KO_UI } from "../content/locale.ko";
import { decideNextAction } from "../engine/autoplay";
import type { GameSpeed } from "../engine/engine.types";
import { useGameStore } from "../state/gameStore";
import {
  autoplayActionLabel,
  AUTOPLAY_TICK_CADENCE,
  canRunAutoplayAtTick,
  presentThenScheduleAutoplayAction,
  publishAutoplayPulse,
} from "./autoplayPresentation";

const SPEED_SEALS: readonly {
  readonly speed: GameSpeed;
  readonly label: string;
  readonly paths: readonly string[];
}[] = [
  { speed: 0, label: KO_UI.speeds.paused, paths: ["M8 6v12", "M16 6v12"] },
  { speed: 1, label: KO_UI.speeds.normal, paths: ["m9 6 8 6-8 6Z"] },
  { speed: 3, label: KO_UI.speeds.threefold, paths: ["m5 6 7 6-7 6Z", "m12 6 7 6-7 6Z"] },
  { speed: 5, label: KO_UI.speeds.fivefold, paths: ["m3 6 6 6-6 6Z", "m9 6 6 6-6 6Z", "m15 6 6 6-6 6Z"] },
];

export function speedToIntervalMs(speed: GameSpeed): number | null {
  return speed === 0 ? null : 1_000 / BALANCE.TICKS_PER_SECOND;
}

type SpeedSealsProps = {
  readonly speed: GameSpeed;
  readonly onChange: (speed: GameSpeed) => void;
};

export function SpeedSeals({ speed, onChange }: SpeedSealsProps) {
  const { state, dispatch } = useGameStore();
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const latestTickRef = useRef(state.tick);
  const lastAutoplayCommitTickRef = useRef(-AUTOPLAY_TICK_CADENCE);
  const cancelPendingCommitRef = useRef<(() => void) | null>(null);
  const nextAction = decideNextAction(state);
  latestTickRef.current = state.tick;

  useEffect(() => {
    if (autoplayEnabled) return;
    cancelPendingCommitRef.current?.();
    cancelPendingCommitRef.current = null;
  }, [autoplayEnabled]);

  useEffect(() => () => {
    cancelPendingCommitRef.current?.();
    cancelPendingCommitRef.current = null;
  }, []);

  useEffect(() => {
    if (!canRunAutoplayAtTick({
      enabled: autoplayEnabled,
      currentTick: state.tick,
      lastActionTick: lastAutoplayCommitTickRef.current,
      pending: cancelPendingCommitRef.current !== null,
    })) return;
    const cancelPendingCommit = presentThenScheduleAutoplayAction({
      action: nextAction,
      state,
      publishPulse: () => publishAutoplayPulse(nextAction, window, performance.now()),
      schedule: (commit, delayMs) => {
        const timeoutId = window.setTimeout(commit, delayMs);
        return () => { window.clearTimeout(timeoutId); };
      },
      beforeDispatch: () => {
        lastAutoplayCommitTickRef.current = latestTickRef.current;
        cancelPendingCommitRef.current = null;
      },
      dispatch,
    });
    if (cancelPendingCommit === null) return;
    cancelPendingCommitRef.current = cancelPendingCommit;
  }, [autoplayEnabled, dispatch, nextAction, state]);

  return (
    <div className="speed-control-stack">
      <div className="speed-seals" role="group" aria-label={KO_UI.speeds.ariaLabel}>
        {SPEED_SEALS.map((option) => (
          <button
            key={option.speed}
            className="speed-seal"
            type="button"
            aria-label={option.label}
            aria-pressed={speed === option.speed}
            onClick={() => onChange(option.speed)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              {option.paths.map((path) => <path key={path} d={path} />)}
            </svg>
          </button>
        ))}
      </div>
      <div className="autoplay-control" aria-label="자동 발전 제어">
        <button
          className="autoplay-toggle"
          type="button"
          aria-pressed={autoplayEnabled}
          onClick={() => setAutoplayEnabled((enabled) => !enabled)}
        >
          자동 발전
        </button>
        <span className="autoplay-hint">{autoplayActionLabel(nextAction)}</span>
      </div>
    </div>
  );
}
