import { useEffect, useRef, useState, type ReactNode } from "react";

import { BALANCE } from "../content/balanceConfig";
import { KO_UI } from "../content/locale.ko";
import { decideNextAction } from "../engine/autoplay";
import { shouldRetryAutoplayAfterMillReplenishment } from "../engine/autoplayMillReplenishment";
import { sampleAutoplayDecision, type AutoplayDecisionCache, type AutoplayDecision } from "./autoplayDecisionCache";
import type { GameState, GameSpeed } from "../engine/engine.types";
import { useGameApi, useGameSelector } from "../state/gameStore";
import { presentedState } from "../render/presentation/presentedState";
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
import { Button, Disclosure } from "./kit";
import { SPEED_SEALS, sealPress, sealView } from "./speedSeals";

/** The advisor with nothing to do (one object, so the scheduling effect below does not rerun each render). */
const NO_ACTION = { kind: "none" } as const;


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
  const { dispatch } = useGameApi();
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  // CODE-1c: the autoplay follows every tick while it is on; off, the seals keep the first state and do not re-render
  // on a tick (the decision sampler returns nothing when disabled).
  const idleStateRef = useRef<GameState | null>(null);
  const state = useGameSelector(autoplayEnabled ? presentedState : (current: GameState) => (idleStateRef.current ??= presentedState(current)));
  const latestTickRef = useRef(state.tick);
  const lastAutoplayCommitTickRef = useRef(-AUTOPLAY_TICK_CADENCE);
  const cancelPendingCommitRef = useRef<(() => void) | null>(null);
  const decisionCacheRef = useRef<AutoplayDecisionCache<GameState> | null>(null);
  const lastScheduledDecisionRef = useRef<AutoplayDecision | null>(null);
  decisionCacheRef.current = sampleAutoplayDecision(decisionCacheRef.current, {
    state, enabled: autoplayEnabled, pending: cancelPendingCommitRef.current !== null,
  }, decideNextAction, shouldRetryAutoplayAfterMillReplenishment);
  const decision = decisionCacheRef.current.decision;
  const nextAction = decision?.action ?? NO_ACTION;
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
        {/* UX-2: the painted time icons (pause · play · two and three chevrons); NAT-4: one fast seal for 5x and 10x (speedSeals.ts). */}
        {SPEED_SEALS.map((seal) => {
          const view = sealView(seal, speed);
          return (
            <Button
              key={seal.id}
              className="speed-seal"
              type="button"
              data-seal={seal.id}
              aria-label={view.label}
              aria-pressed={view.pressed}
              onPress={() => onChange(sealPress(seal, speed))}
             variant="icon">
              <UiIcon sheet="time" cell={seal.icon} size={32} />
              {view.mark === null ? null : <span className="speed-seal-mark" aria-hidden="true">{view.mark}</span>}
            </Button>
          );
        })}
      </div>
      <Disclosure className="command-disclosure settings-disclosure" summary="설정">
      <div className="command-popover autoplay-control" data-frame="dark" aria-label="자동 발전 제어">
        <Button
          className="autoplay-toggle"
          type="button"
          aria-pressed={autoplayEnabled}
          onPress={() => setAutoplayEnabled((enabled) => !enabled)}
         variant="toggle">
          자동 발전
        </Button>
        <span className="autoplay-hint">{autoplayEnabled ? autoplayActionLabel(nextAction) : "자동 발전 꺼짐"}</span>
        {extraSettings}
        <BoundaryRenderToggle />
        <SaveControls />
      </div></Disclosure>
    </div>
  );
}
