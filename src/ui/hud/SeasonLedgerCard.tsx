import { UiIcon } from "../UiIcon";
import type { SeasonLedgerCardModel } from "../seasonLedgerCard";
import { SEASON_LEDGER_COPY } from "../seasonLedgerCopy.ko";
import { wave8ContentStyle, wave8FrameLayerStyle } from "../wave8Art";
import { seasonSceneStyle } from "../wave19Art";

// UI-3 season ledger card (S-28, a modal: time stops while it is up). The Wave 8 scroll: three scenes (the season's
// biggest changes, UI-4b: Wave 19 icons chosen from the history ledger) in its header slots, their names under the
// title (no hover-only meaning), then the numbers, what happened and the next objective.
const SCENE_ICON_PX = 30;

export function SeasonLedgerCard({ model, onResume, onHint, auto, onAutoChange }: {
  readonly model: SeasonLedgerCardModel; readonly onResume: () => void; readonly onHint: () => void;
  readonly auto: boolean; readonly onAutoChange: (auto: boolean) => void;
}) {
  return (
    <div className="season-ledger-backdrop" role="presentation">
      <section className="season-ledger-card" role="dialog" aria-modal="true" aria-label={model.title} data-season={model.key}>
        <span className="season-ledger-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_season_ledger")} />
        <ol className="season-ledger-scenes" aria-label={SEASON_LEDGER_COPY.label}>
          {model.scenes.map(scene => <li key={scene.id} className="season-ledger-scene" data-scene={scene.id}>
            <span className="season-ledger-scene-icon" role="img" aria-label={scene.name} style={seasonSceneStyle(scene.id, SCENE_ICON_PX)} />
            {scene.value === null ? null : <strong>{scene.value}</strong>}</li>)}
        </ol>
        <div className="season-ledger-body" style={wave8ContentStyle("frame_season_ledger")}>
          <h2>{model.title}</h2>
          <p className="season-ledger-scenes-line">{model.scenesLine}</p>
          {model.lines.map(line => <p key={line} className="season-ledger-line">{line}</p>)}
          <ul className="season-ledger-events">{model.events.map(event => <li key={event}>{event}</li>)}</ul>
          <div className="season-ledger-actions">
            {model.hint === null ? null : <button type="button" className="season-ledger-hint" onClick={() => onHint()}>
              <UiIcon sheet="action" cell="open" />{model.hint.text}</button>}
            <button type="button" className="season-ledger-resume" onClick={() => onResume()}><UiIcon sheet="time" cell="play" />{SEASON_LEDGER_COPY.resume}</button>
          </div>
          <button type="button" className="season-ledger-auto" aria-pressed={auto} onClick={() => onAutoChange(!auto)}>
            {auto ? SEASON_LEDGER_COPY.autoOn : SEASON_LEDGER_COPY.autoOff}</button>
        </div>
      </section>
    </div>
  );
}
