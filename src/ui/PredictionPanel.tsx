import { useLayoutEffect, useRef, useState } from "react";
import { PREDICTION_SEVERITY_TONE, toPredictionLine, type PresentablePredictionLine } from './predictionTypes';
import type { Point } from '../render/camera';
import { UiIcon } from './UiIcon';

/** UX-2: the painted prediction icons (speech bubble · check · warning diamond · cross). */
const LINE_SYMBOLS = { info: { icon: 'pending', label: '안내' }, ok: { icon: 'ok', label: '충족' },
  warn: { icon: 'warn', label: '주의' }, block: { icon: 'block', label: '미충족' } } as const;

export type PredictionPresentation = {
  readonly lines: readonly PresentablePredictionLine[];
  readonly position: Point;
};

/** Facility-independent presentation; callers own prediction semantics. */
export function PredictionPanel({ lines, position }: PredictionPresentation) {
  const panelRef = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(184);
  useLayoutEffect(() => {
    const element = panelRef.current;
    if (element === null) return;
    const measure = () => setHeight(Math.ceil(element.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [lines]);
  if (lines.length === 0) return null;
  return <aside ref={panelRef} className="prediction-panel" data-testid="placement-prediction-panel" aria-label="행동 결과 예측"
    style={{ left: `clamp(12px, ${position.x}px, calc(100% - 372px))`, top: `clamp(var(--resource-height), ${position.y}px, calc(100% - var(--command-height) - ${height + 12}px))` }}>
    <ul>{lines.map(toPredictionLine).map(line => <li key={line.id} className={`prediction-line prediction-line--${PREDICTION_SEVERITY_TONE[line.severity]}`}>
      <UiIcon sheet="prediction" cell={LINE_SYMBOLS[line.severity].icon} className="prediction-line-symbol" label={LINE_SYMBOLS[line.severity].label} /><span>{line.text}</span>
    </li>)}</ul>
  </aside>;
}
