import { useEffect, useRef, useState, type ReactNode } from "react";

import { BALANCE } from "../content/balanceConfig";
import { KO_UI } from "../content/locale.ko";
import { decideNextAction } from "../engine/autoplay";
import { shouldRetryAutoplayAfterMillReplenishment } from "../engine/autoplayMillReplenishment";
import { sampleAutoplayDecision, type AutoplayDecisionCache, type AutoplayDecision } from "./autoplayDecisionCache";
import type { GameState, GameSpeed } from "../engine/engine.types";
import { useGameStore } from "../state/gameStore";
import { SaveControls } from "./SaveControls";
import { UiIcon } from "./UiIcon";
import { BoundaryRenderToggle } from "../render/BoundaryRenderToggle";
import {
  autoplayActionLabel,
  AUTOPLAY_TICK_CADENCE,
  canRunAutoplayAtTick,
  presentThenScheduleAutoplayAction,
  publishAutoplayPulse,
} from "./autoplayPresentation";

/** UX-2: the painted time icons (pause · play · two and three chevrons). */
const SPEED_SEALS: readonly {
  readonly speed: GameSpeed;
  readonly label: string;
  readonly icon: "pause" | "play" | "fast" | "fastest";
}[] = [
  { speed: 0, label: KO_UI.speeds.paused, icon: "pause" },
  { speed: 1, label: KO_UI.speeds.normal, icon: "play" },
  { speed: 3, label: KO_UI.speeds.threefold, icon: "fast" },
  { speed: 5, label: KO_UI.speeds.fivefold, icon: "fastest" },
];

export function speedToIntervalMs(speed: GameSpeed): number | null {
  return speed === 0 ? null : 1_000 / BALANCE.TICKS_PER_SECOND;
}

type SpeedSealsProps = {
  readonly speed: GameSpeed;
  readonly onChange: (speed: GameSpeed) => void;
  /** UX-1: more settings rows (the tutorial toggle). */
  readonly extraSettings?: ReactNode;
};

export function SpeedSeals({ speed, onChange, extraSettings }: SpeedSealsProps) {
  const { state, dispatch } = useGameStore();
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const latestTickRef = useRef(state.tick);
  const lastAutoplayCommitTickRef = useRef(-AUTOPLAY_TICK_CADENCE);
  const cancelPendingCommitRef = useRef<(() => void) | null>(null);
  const decisionCacheRef = useRef<AutoplayDecisionCache<GameState> | null>(null);
  const lastScheduledDecisionRef = useRef<AutoplayDecision | null>(null);
  decisionCacheRef.current = sampleAutoplayDecision(decisionCacheRef.current, {
    state, enabled: autoplayEnabled, pending: cancelPendingCommitRef.current !== null,
  }, decideNextAction, shouldRetryAutoplayAfterMillReplenishment);
  const decision = decisionCacheRef.current.decision;
  const nextAction = decision?.action ?? { kind: "none" as const };
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
    if (decision === null || lastScheduledDecisionRef.current === decision) return;
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
    lastScheduledDecisionRef.current = decision;
    cancelPendingCommitRef.current = cancelPendingCommit;
  }, [autoplayEnabled, decision, dispatch, nextAction, state]);

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
            <UiIcon sheet="time" cell={option.icon} size={32} />
          </button>
        ))}
      </div>
      <details className="command-disclosure settings-disclosure"><summary>설정</summary>
      <div className="command-popover autoplay-control" aria-label="자동 발전 제어">
        <button
          className="autoplay-toggle"
          type="button"
          aria-pressed={autoplayEnabled}
          onClick={() => setAutoplayEnabled((enabled) => !enabled)}
        >
          자동 발전
        </button>
        <span className="autoplay-hint">{autoplayEnabled ? autoplayActionLabel(nextAction) : "자동 발전 꺼짐"}</span>
        {extraSettings}
        <BoundaryRenderToggle />
        <SaveControls />
      </div></details>
    </div>
  );
}
