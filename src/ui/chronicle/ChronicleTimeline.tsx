import type { CSSProperties } from "react";
import { wave19ImageStyle, wave19Url } from "../wave19Art";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";
import { timelineX, type SeasonCell, type TimelineChapter, type TimelineMarker, type TimelineSegment } from "./chronicleScreenModel";
import { Button } from "../kit";

// CHRON-1 timeline (CHRONICLE_DESIGN 2.1): the Wave 19 strip (1024 x 64 art; its five coloured segments are the
// scenario's five eras, each an equal share, linear in time inside it), the weightiest record of each stretch as a
// marker (five kinds), the chapters under it, `timeline_pin_now` at now and `timeline_pin_select` at the picked time.
// A press on the strip picks that time (the list scrolls to it); [계절 보기] opens the season ruler around it.

/** The coloured band inside the strip art (measured on timeline_strip_base.png: x 41–984 of 1024). */
export const STRIP_BAND = { left: 41 / 1024, right: 984 / 1024 } as const;
const MARKER_SIZE = 22;
const PIN_SIZE = 20;
/** The picked time's ring sits over the band's marker. */
const RING_SIZE = 28;

const bandLeft = (x: number): CSSProperties => ({ left: `${(STRIP_BAND.left + x * (STRIP_BAND.right - STRIP_BAND.left)) * 100}%` });

/** The band fraction (0–1) at a client x on the strip. */
export function stripFraction(clientX: number, rect: { readonly left: number; readonly width: number }): number {
  const x = (clientX - rect.left) / rect.width;
  return Math.min(1, Math.max(0, (x - STRIP_BAND.left) / (STRIP_BAND.right - STRIP_BAND.left)));
}

export function ChronicleTimeline({ segments, markers, chapters, nowTick, pickedTick, zoomed, seasons, pickedSeason, onPick, onPickSeason, onZoom, onShift }: {
  readonly segments: readonly TimelineSegment[]; readonly markers: readonly TimelineMarker[]; readonly chapters: readonly TimelineChapter[];
  readonly nowTick: number; readonly pickedTick: number; readonly zoomed: boolean; readonly seasons: readonly SeasonCell[]; readonly pickedSeason: number;
  /** A place along the band (0–1), or null for a keyboard press (Enter / Space on the strip: open the season ruler). */
  readonly onPick: (fraction: number | null) => void; readonly onPickSeason: (cell: SeasonCell) => void;
  readonly onZoom: () => void; readonly onShift: (seasons: number) => void;
}) {
  return (
    <section className="chronicle-timeline-block" aria-label={COPY.timelineLabel}>
      <div className="chronicle-strip-row">
        <Button type="button" className="chronicle-strip" aria-label={COPY.timelineLabel}
          style={{ backgroundImage: `url("${wave19Url("timeline_strip_base")}")` }}
          onPressAt={at => onPick(at.keyboard ? null : stripFraction(at.clientX, at.rect))} variant="surface">
          {markers.map(marker => (
            <span key={marker.recordId} className={`chronicle-marker chronicle-marker--${marker.kind}`} aria-hidden="true" data-marker={marker.kind}
              style={{ ...bandLeft(marker.x), ...wave19ImageStyle(`timeline_marker_${marker.kind}`, MARKER_SIZE) }} />
          ))}
          <span className="chronicle-pin chronicle-pin--now" aria-hidden="true" style={{ ...bandLeft(timelineX(segments, nowTick)), ...wave19ImageStyle("timeline_pin_now", PIN_SIZE) }} />
          <span className="chronicle-pin chronicle-pin--select" aria-hidden="true" style={{ ...bandLeft(timelineX(segments, pickedTick)), ...wave19ImageStyle("timeline_pin_select", RING_SIZE) }} />
        </Button>
        <Button type="button" className="chronicle-zoom" aria-pressed={zoomed} onPress={() => onZoom()} variant="toggle">
          <span aria-hidden="true" style={wave19ImageStyle("timeline_zoom_handle", 24)} />{zoomed ? COPY.zoomOut : COPY.zoomIn}
        </Button>
      </div>
      <div className="chronicle-strip-labels" aria-hidden="true">
        {segments.map((segment, index) => (
          <span key={segment.eraId} className="chronicle-era-label" data-entered={segment.entered ? "true" : undefined} style={bandLeft(index / segments.length)}>
            {COPY.eraLabel(segment.fromYear, segment.label)}
            {segment.entered ? null : <span className="chronicle-era-ahead">{COPY.eraAhead}</span>}
          </span>
        ))}
        {chapters.map(chapter => {
          const from = timelineX(segments, chapter.from); const to = timelineX(segments, chapter.to);
          return <span key={chapter.chapter} className="chronicle-chapter-bar" data-ended={chapter.ended ? "true" : undefined}
            style={{ ...bandLeft(from), width: `${Math.max(0.4, (to - from) * (STRIP_BAND.right - STRIP_BAND.left) * 100)}%` }}>{COPY.chapter(chapter.chapter)}</span>;
        })}
      </div>
      {zoomed ? (
        <div className="chronicle-seasons" role="group" aria-label={COPY.seasonsLabel}>
          <Button type="button" className="chronicle-season-shift" onPress={() => onShift(-8)} variant="secondary">{COPY.earlier}</Button>
          <ol className="chronicle-season-cells">
            {seasons.map(cell => (
              <li key={cell.index}>
                <Button type="button" className={`chronicle-season chronicle-season--${cell.season}`} aria-pressed={cell.index === pickedSeason}
                  aria-label={COPY.seasonCell(cell.label, cell.count)} data-season-index={cell.index} onPress={() => onPickSeason(cell)} variant="surface">
                  <span className="chronicle-season-name">{cell.season === 0 ? cell.label : COPY.seasonShort(cell.season)}</span>
                  <span className="chronicle-season-marks" aria-hidden="true">
                    {cell.kinds.slice(0, 3).map(kind => <span key={kind} style={wave19ImageStyle(`timeline_marker_${kind}`, 14)} />)}
                    {cell.count > 0 ? <span className="chronicle-season-count">{cell.count}</span> : null}
                  </span>
                </Button>
              </li>
            ))}
          </ol>
          <Button type="button" className="chronicle-season-shift" onPress={() => onShift(8)} variant="secondary">{COPY.later}</Button>
        </div>
      ) : null}
    </section>
  );
}
