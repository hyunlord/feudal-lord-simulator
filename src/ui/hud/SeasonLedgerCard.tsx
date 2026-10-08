import { UiIcon } from "../UiIcon";
import type { SeasonLedgerCardModel } from "../seasonLedgerCard";
import { SEASON_LEDGER_COPY } from "../seasonLedgerCopy.ko";
import { wave8FrameLayerStyle } from "../wave8Art";
import { seasonSceneStyle } from "../wave19Art";
import { Button } from "../kit";
import { ResourceGlyph } from "../ResourceArtwork";
import { SeasonStewardSection } from "../lord/steward/SeasonStewardSection";

// UI-3 season ledger card (S-28, a modal: time stops while it is up). The Wave 8 scroll: three scenes (the season's
// biggest changes, UI-4b: Wave 19 icons chosen from the history ledger) in its header slots, their names under the
// title (no hover-only meaning), then the numbers, what happened and the next objective.
const SCENE_ICON_PX = 30;

export function SeasonLedgerCard({ model, onResume, onHint, onPolicy, auto, onAutoChange, first = false }: {
  readonly model: SeasonLedgerCardModel; readonly onResume: () => void; readonly onHint: () => void;
  /** DEC-CARD-2 (lord mode): a steward's matter's [이 종류의 방침을 정한다] — the lord screen's standing policies on its kind. */
  readonly onPolicy?: ((kind: string) => void) | undefined;
  readonly auto: boolean; readonly onAutoChange: (auto: boolean) => void;
  /** LM-R1 (playtest #7): the first card that opened by itself — it asks how later seasons come (the toggle's place). */
  readonly first?: boolean;
}) {
  return (
    <div className="season-ledger-backdrop" role="presentation">
      <section className="season-ledger-card" data-frame="season-ledger" role="dialog" aria-modal="true" aria-label={model.title} data-season={model.key}>
        <span className="season-ledger-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_season_ledger")} />
        <ol className="season-ledger-scenes" aria-label={SEASON_LEDGER_COPY.label}>
          {model.scenes.map(scene => <li key={scene.id} className="season-ledger-scene" data-scene={scene.id}>
            <span className="season-ledger-scene-icon" role="img" aria-label={scene.name} style={seasonSceneStyle(scene.id, SCENE_ICON_PX)} />
            {scene.box === null ? null : <strong>{scene.box}</strong>}</li>)}
        </ol>
        <div className="season-ledger-body">
          {/* INSTALL-3: the card's own controls (계속, the auto toggle) stay pinned below the season's lines. */}
          <div className="season-ledger-content">
            <h2>{model.title}</h2>
            <p className="season-ledger-scenes-line">{model.scenesLine}</p>
            {model.lines.map(line => <p key={line} className="season-ledger-line">{line}</p>)}
            {/* INSTALL-3: the ale chain's goods held now, each with its icon (the line reads the same without them). */}
            {model.drinkLine === null ? null : <p className="season-ledger-line season-ledger-drink">
              <span>{SEASON_LEDGER_COPY.heldNowLabel}</span>
              {model.drink.map(item => <span key={item.resource} className="season-ledger-drink-item" data-resource={item.resource}>
                <ResourceGlyph resource={item.resource} size={16} />{SEASON_LEDGER_COPY.held(item.name, item.amount)}</span>)}</p>}
            {model.aleLines.map(line => <p key={line} className="season-ledger-line season-ledger-ale">{line}</p>)}
            {/* C5: the cloth chain's goods held now, each with its icon (parallel to the ale drink row). */}
            {model.clothLine === null ? null : <p className="season-ledger-line season-ledger-cloth">
              <span>{SEASON_LEDGER_COPY.heldNowLabel}</span>
              {model.cloth.map(item => <span key={item.resource} className="season-ledger-cloth-item" data-resource={item.resource}>
                <ResourceGlyph resource={item.resource} size={16} />{SEASON_LEDGER_COPY.held(item.name, item.amount)}</span>)}</p>}
            {model.clothLines.map(line => <p key={line} className="season-ledger-line season-ledger-cloth-money">{line}</p>)}
            <ul className="season-ledger-events">{model.events.map(event => <li key={event}>{event}</li>)}</ul>
            {model.steward === undefined ? null : <SeasonStewardSection view={model.steward} onPolicy={onPolicy} />}
            {model.hint === null ? null : <Button type="button" className="season-ledger-hint" onPress={() => onHint()} variant="secondary">
              <UiIcon sheet="action" cell="open" />{model.hint.text}</Button>}
          </div>
          {first ? <div className="season-ledger-first" role="group" aria-label={SEASON_LEDGER_COPY.firstAsk}>
            <span>{SEASON_LEDGER_COPY.firstAsk}</span>
            <Button type="button" className="season-ledger-first-auto" aria-pressed={auto} onPress={() => onAutoChange(true)} variant="toggle">{SEASON_LEDGER_COPY.firstAuto}</Button>
            <Button type="button" className="season-ledger-first-notice" aria-pressed={!auto} onPress={() => onAutoChange(false)} variant="toggle">{SEASON_LEDGER_COPY.firstNotice}</Button>
          </div> : null}
          <div className="season-ledger-actions">
            <Button type="button" className="season-ledger-resume" onPress={() => onResume()} variant="primary"><UiIcon sheet="time" cell="play" />{SEASON_LEDGER_COPY.resume}</Button>
            {first ? null : <Button type="button" className="season-ledger-auto" aria-pressed={auto} onPress={() => onAutoChange(!auto)} variant="toggle">
              {auto ? SEASON_LEDGER_COPY.autoOn : SEASON_LEDGER_COPY.autoOff}</Button>}
          </div>
        </div>
      </section>
    </div>
  );
}
