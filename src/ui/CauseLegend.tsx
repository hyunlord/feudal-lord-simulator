import { CAUSE_REGISTRY } from './causeRegistry';
import { CAUSE_MARKER_COPY } from './causeMarkerCopy.ko';

export function CauseLegend() {
  return <section className="cause-legend" aria-label="문제 원인 범례">
    <strong>문제만 보기 · O</strong>
    <ul>{Object.entries(CAUSE_REGISTRY).map(([id, entry]) => <li key={id}>
      <span className="cause-legend-symbol" style={{ color: entry.color }}>{entry.glyphText}</span>
      <span>{id === 'delivery' ? '도로·배송 연결' : entry.shortLabel}</span>
    </li>)}</ul>
    <small>{CAUSE_MARKER_COPY.legend}</small>
  </section>;
}
