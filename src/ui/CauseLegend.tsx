import { CAUSE_REGISTRY } from './causeRegistry';
import { CAUSE_MARKER_COPY } from './causeMarkerCopy.ko';
import { CAUSE_ICON } from './uiArt';
import { UiIcon } from './UiIcon';

export function CauseLegend() {
  return <section className="cause-legend" aria-label="문제 원인 범례">
    <strong>문제만 보기 · O</strong>
    <ul>{Object.entries(CAUSE_REGISTRY).map(([id, entry]) => <li key={id}>
      {CAUSE_ICON[id] === undefined
        ? <span className="cause-legend-symbol" style={{ color: entry.color }}>{entry.glyphText}</span>
        : <UiIcon sheet="cause" cell={CAUSE_ICON[id]} className="cause-legend-symbol" />}
      <span>{id === 'delivery' ? '도로·배송 연결' : entry.shortLabel}</span>
    </li>)}</ul>
    <small className="cause-legend-key">
      <UiIcon sheet="marker" cell="urgent" /> {CAUSE_MARKER_COPY.legendUrgent} · <UiIcon sheet="marker" cell="warn" /> {CAUSE_MARKER_COPY.legendWarn} · {CAUSE_MARKER_COPY.legendRest}
    </small>
  </section>;
}
