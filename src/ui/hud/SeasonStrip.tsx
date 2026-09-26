import type { GameState } from "../../engine/engine.types";
import { eventForecast } from "../../engine/eventSchedule";
import { arrivalOf, forecastMarks, seasonMarks, yearFraction, type SeasonMarkKind } from "../seasonStrip";
import { UiIcon } from "../UiIcon";
import { SEASON_STRIP_COPY } from "../seasonStripCopy.ko";
import { wave8ImageStyle, wave8Url, type Wave8ImageId } from "../wave8Art";

// UI-3 season strip, small by default (UX-3): a thin strip under the date in the status pill with the pin at today;
// a tap on the date opens the full Wave 8 strip with the event marks and the list of what comes next.
const MARK_IMAGE: Readonly<Record<SeasonMarkKind, Wave8ImageId>> = {
  sow: "season_event_sow", harvest: "season_event_harvest", period_end: "season_event_period_end", market_day: "season_event_market_day",
};

export function SeasonStripMini({ tick }: { readonly tick: number }) {
  return (
    <span className="season-strip-mini" aria-hidden="true" style={{ backgroundImage: `url("${wave8Url("season_strip")}")` }}>
      <span className="season-strip-mini-pin" style={{ left: `${yearFraction(tick) * 100}%` }} />
    </span>
  );
}

export function SeasonStripPanel({ state, food, onClose }: {
  readonly state: GameState;
  /** The pill's food days and the tick they reach (null when no house eats). */
  readonly food: { readonly days: number | null; readonly untilTick: number | null };
  readonly onClose: () => void;
}) {
  const marks = seasonMarks(state);
  const coming = forecastMarks(eventForecast(state), state.tick);
  const until = food.untilTick === null ? null : arrivalOf(state.tick, food.untilTick);
  return (
    <section className="season-strip-panel" aria-label={SEASON_STRIP_COPY.listTitle}>
      <p className="season-strip-food" data-food-until={food.untilTick ?? ""}>{food.days === null || until === null ? SEASON_STRIP_COPY.foodNone
        : SEASON_STRIP_COPY.foodUntil(food.days, until.season, until.third, until.nextYear)}</p>
      <div className="season-strip-full" style={wave8ImageStyle("season_strip", 300)}>
        {marks.map(mark => <span key={mark.kind} className="season-strip-mark" data-mark={mark.kind}
          style={{ left: `${mark.fraction * 100}%`, ...wave8ImageStyle(MARK_IMAGE[mark.kind], 16) }} />)}
        {coming.map(mark => <span key={`${mark.kind}:${mark.tick}`} className="season-strip-mark season-strip-forecast" data-mark={`forecast_${mark.kind}`} data-stage={mark.stage}
          style={{ left: `${mark.fraction * 100}%` }}><UiIcon sheet="cause" cell={mark.kind === "fire" ? "safety" : "food"} /></span>)}
        <span className="season-strip-pin" data-fraction={yearFraction(state.tick).toFixed(3)}
          style={{ left: `${yearFraction(state.tick) * 100}%`, ...wave8ImageStyle("season_pin", 12) }} />
      </div>
      <h3>{SEASON_STRIP_COPY.listTitle}</h3>
      <ul className="season-strip-list">
        {coming.map(mark => {
          const when = arrivalOf(state.tick, mark.tick);
          return <li key={`${mark.kind}:${mark.tick}`} data-mark={`forecast_${mark.kind}`}><UiIcon sheet="cause" cell={mark.kind === "fire" ? "safety" : "food"} />
            {SEASON_STRIP_COPY.row(SEASON_STRIP_COPY.forecast(mark.kind, mark.famine, mark.stage === "sign"), SEASON_STRIP_COPY.arrival(when.season, when.third, when.nextYear))}</li>;
        })}
        {marks.map(mark => {
          const when = arrivalOf(state.tick, mark.tick);
          return <li key={mark.kind} data-mark={mark.kind}><span style={wave8ImageStyle(MARK_IMAGE[mark.kind], 16)} aria-hidden="true" />
            {SEASON_STRIP_COPY.row(SEASON_STRIP_COPY.kinds[mark.kind], SEASON_STRIP_COPY.arrival(when.season, when.third, when.nextYear))}</li>;
        })}
      </ul>
      <button type="button" className="season-strip-close" onClick={() => onClose()}>{SEASON_STRIP_COPY.close}</button>
    </section>
  );
}
