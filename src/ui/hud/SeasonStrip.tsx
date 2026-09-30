import { idleWheat } from "./statusPillModel";
import type { GameState } from "../../engine/engine.types";
import { eventForecast } from "../../engine/eventSchedule";
import { warForecast } from "../../engine/war";
import { arrivalOf, forecastMarks, legacyMarks, plagueMarks, reorganisationMarks, seasonMarks, warMarks, yearFraction, type LegacyMark, type PlagueMark, type ReorganisationMark, type SeasonMarkKind, type WarMark } from "../seasonStrip";
import { plagueForecast } from "../../engine/plague";
import { reorganisationForecast } from "../../engine/reorganisation";
import { legacyForecast, legacyInterludes } from "../../engine/legacy";
import { UiIcon } from "../UiIcon";
import type { UiIconCell } from "../uiArt";
import { SEASON_STRIP_COPY } from "../seasonStripCopy.ko";
import { wave8ImageStyle, wave8Url, type Wave8ImageId } from "../wave8Art";
import { Button } from "../kit";

// UI-3 season strip, small by default (UX-3): a thin strip under the date in the status pill with the pin at today;
// a tap on the date opens the full Wave 8 strip with the event marks and the list of what comes next.
const MARK_IMAGE: Readonly<Record<SeasonMarkKind, Wave8ImageId>> = {
  sow: "season_event_sow", harvest: "season_event_harvest", period_end: "season_event_period_end", market_day: "season_event_market_day",
};

// UI-6: the war's steps by the cause family they press on — the Crown's demands (rights), the coast's danger (safety),
// the refugees (labour).
const WAR_ICON: Readonly<Record<WarMark["id"], UiIconCell<"cause">>> = {
  messenger: "rights", wool_levy: "rights", commission: "rights", subsidy: "rights", beacon: "safety", raid: "safety", refugees: "labour", recovery: "rights",
};

// UI-8: the plague's steps by the cause family they press on — deaths and second wave (safety), labour disruptions,
// ordinance and end (rights), abandoned fields (food).
const PLAGUE_ICON: Readonly<Record<PlagueMark["id"], UiIconCell<"cause">>> = {
  rumour: "safety", arrival: "safety", wage_demand: "labour", abandoned_fields: "food", ordinance: "rights", resettlement: "labour", second: "safety", end: "rights",
};

// UI-9: the reorganisation's steps by the cause family they press on — the wages war and the weavers (labour), the
// town's trade (food for the alehouses' bread and ale), the petitions, the earl, the tax, the charter (rights), the
// rumour of 1381 (safety).
const REORG_ICON: Readonly<Record<ReorganisationMark["id"], UiIconCell<"cause">>> = {
  wage_competition: "labour", textile_street: "labour", alehouse_boom: "food", petitions_surge: "rights", guild_demand: "rights", cloth_or_grain: "food",
  overlord_warning: "rights", poll_tax: "rights", rebellion_rumour: "safety", autonomy_request: "rights", end: "rights",
};

// UI-10: chapter 5's steps and the interlude's events by the cause family they press on — the town's demands, the
// Crown, the heir, the seal and the charter, the family, the legacy (rights); the Staple and the market (food); the fire
// (safety); the guild's quarrel (labour).
const LEGACY_ICON: Readonly<Record<LegacyMark["id"], UiIconCell<"cause">>> = {
  mayor_demand: "rights", royal_tax_envoy: "rights", succession: "rights", city_seal: "rights", charter_sealing: "rights", family_departure: "rights",
  legacy_record: "rights", last_market: "food", staple: "food", guild_dispute: "labour", market_fire: "safety", church_rebuilding: "rights", deposition: "rights",
};
const legacyLabel = (mark: LegacyMark) => mark.interlude ? SEASON_STRIP_COPY.interlude[mark.id as keyof typeof SEASON_STRIP_COPY.interlude]
  : SEASON_STRIP_COPY.legacy[mark.id as keyof typeof SEASON_STRIP_COPY.legacy];

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
  const war = warMarks(warForecast(state), state.tick);
  const plague = plagueMarks(plagueForecast(state), state.tick);
  const reorg = reorganisationMarks(reorganisationForecast(state), state.tick);
  const legacy = legacyMarks(legacyForecast(state), legacyInterludes(state), state.tick);
  const until = food.untilTick === null ? null : arrivalOf(state.tick, food.untilTick);
  return (
    <section className="season-strip-panel" aria-label={SEASON_STRIP_COPY.listTitle}>
      <p className="season-strip-food" data-food-until={food.untilTick ?? ""}>{food.days === null || until === null ? SEASON_STRIP_COPY.foodNone
        : SEASON_STRIP_COPY.foodUntil(food.days, until.season, until.third, until.nextYear)}</p>
      {idleWheat(state) > 0 ? <p className="season-strip-food season-strip-idle-wheat">{SEASON_STRIP_COPY.idleWheat(idleWheat(state))}</p> : null}
      <div className="season-strip-full" style={wave8ImageStyle("season_strip", 300)}>
        {marks.map(mark => <span key={mark.kind} className="season-strip-mark" data-mark={mark.kind}
          style={{ left: `${mark.fraction * 100}%`, ...wave8ImageStyle(MARK_IMAGE[mark.kind], 16) }} />)}
        {coming.map(mark => <span key={`${mark.kind}:${mark.tick}`} className="season-strip-mark season-strip-forecast" data-mark={`forecast_${mark.kind}`} data-stage={mark.stage}
          style={{ left: `${mark.fraction * 100}%` }}><UiIcon sheet="cause" cell={mark.kind === "fire" ? "safety" : "food"} /></span>)}
        {war.map(mark => <span key={`war:${mark.id}`} className="season-strip-mark season-strip-forecast" data-mark={`war_${mark.id}`}
          style={{ left: `${mark.fraction * 100}%` }}><UiIcon sheet="cause" cell={WAR_ICON[mark.id]} /></span>)}
        {plague.map(mark => <span key={`plague:${mark.id}`} className="season-strip-mark season-strip-forecast" data-mark={`plague_${mark.id}`}
          style={{ left: `${mark.fraction * 100}%` }}><UiIcon sheet="cause" cell={PLAGUE_ICON[mark.id]} /></span>)}
        {reorg.map(mark => <span key={`reorg:${mark.id}`} className="season-strip-mark season-strip-forecast" data-mark={`reorg_${mark.id}`}
          style={{ left: `${mark.fraction * 100}%` }}><UiIcon sheet="cause" cell={REORG_ICON[mark.id]} /></span>)}
        {legacy.map(mark => <span key={`legacy:${mark.id}`} className="season-strip-mark season-strip-forecast" data-mark={`legacy_${mark.id}`}
          style={{ left: `${mark.fraction * 100}%` }}><UiIcon sheet="cause" cell={LEGACY_ICON[mark.id]} /></span>)}
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
        {war.map(mark => {
          const when = arrivalOf(state.tick, mark.tick);
          return <li key={`war:${mark.id}`} data-mark={`war_${mark.id}`}><UiIcon sheet="cause" cell={WAR_ICON[mark.id]} />
            {SEASON_STRIP_COPY.row(SEASON_STRIP_COPY.war[mark.id] ?? mark.id, SEASON_STRIP_COPY.arrival(when.season, when.third, when.nextYear))}</li>;
        })}
        {plague.map(mark => {
          const when = arrivalOf(state.tick, mark.tick);
          return <li key={`plague:${mark.id}`} data-mark={`plague_${mark.id}`}><UiIcon sheet="cause" cell={PLAGUE_ICON[mark.id]} />
            {SEASON_STRIP_COPY.row(SEASON_STRIP_COPY.plague[mark.id] ?? mark.id, SEASON_STRIP_COPY.arrival(when.season, when.third, when.nextYear))}</li>;
        })}
        {reorg.map(mark => {
          const when = arrivalOf(state.tick, mark.tick);
          return <li key={`reorg:${mark.id}`} data-mark={`reorg_${mark.id}`}><UiIcon sheet="cause" cell={REORG_ICON[mark.id]} />
            {SEASON_STRIP_COPY.row(SEASON_STRIP_COPY.reorg[mark.id] ?? mark.id, SEASON_STRIP_COPY.arrival(when.season, when.third, when.nextYear))}</li>;
        })}
        {legacy.map(mark => {
          const when = arrivalOf(state.tick, mark.tick);
          return <li key={`legacy:${mark.id}`} data-mark={`legacy_${mark.id}`}><UiIcon sheet="cause" cell={LEGACY_ICON[mark.id]} />
            {SEASON_STRIP_COPY.row(legacyLabel(mark), SEASON_STRIP_COPY.arrival(when.season, when.third, when.nextYear))}</li>;
        })}
        {marks.map(mark => {
          const when = arrivalOf(state.tick, mark.tick);
          return <li key={mark.kind} data-mark={mark.kind}><span style={wave8ImageStyle(MARK_IMAGE[mark.kind], 16)} aria-hidden="true" />
            {SEASON_STRIP_COPY.row(SEASON_STRIP_COPY.kinds[mark.kind], SEASON_STRIP_COPY.arrival(when.season, when.third, when.nextYear))}</li>;
        })}
      </ul>
      <Button type="button" className="season-strip-close" onPress={() => onClose()} variant="icon">{SEASON_STRIP_COPY.close}</Button>
    </section>
  );
}
