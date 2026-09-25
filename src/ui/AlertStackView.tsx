import type { ReactElement } from "react";

import type { GameState } from "../engine/engine.types";
import { platformServices } from "../platform/platform";
import { ALERT_STACK_COPY } from "./alertStackCopy.ko";
import { alertRowLookAtIntent, alertStackRows, type AlertRow } from "./alertStackModel";

export type AlertStackProps = Readonly<{
  state: GameState;
  /** Called with the first affected building (or construction-site) id after the camera moves to it. */
  onInspect: (buildingId: string) => void;
}>;

/** `[보기]`: camera to the first affected building (the `lookAt` input intent, handled by the map), then inspect it. */
export function inspectAlertRow(row: AlertRow, onInspect: (buildingId: string) => void): void {
  const first = row.targetIds[0];
  if (first === undefined) return;
  platformServices().input.emit(alertRowLookAtIntent(row));
  onInspect(first);
}

/** Markup of the warning stack; `AlertStack.tsx` adds its stylesheet (kept apart so node tests can render this). */
export function AlertStack({ state, onInspect }: AlertStackProps): ReactElement | null {
  const rows = alertStackRows(state);
  if (rows.length === 0) return null;
  return (
    <section className="alert-stack" aria-label={ALERT_STACK_COPY.regionLabel}>
      <ul className="alert-stack-list">
        {rows.map((row) => (
          <li key={row.id} className={`alert-stack-row alert-stack-row--${row.severity}`}>
            <span className="alert-stack-shape" role="img" aria-label={ALERT_STACK_COPY.severityLabel[row.severity]}>{row.shape}</span>
            <div className="alert-stack-text">
              <p className="alert-stack-title"><strong>{row.title}</strong> · <span>{row.countLabel}</span></p>
              <p className="alert-stack-cause">{row.cause}</p>
            </div>
            <button
              type="button"
              className="alert-stack-inspect"
              aria-label={ALERT_STACK_COPY.inspectLabel(row.title)}
              onClick={() => inspectAlertRow(row, onInspect)}
            >
              {ALERT_STACK_COPY.inspect}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
