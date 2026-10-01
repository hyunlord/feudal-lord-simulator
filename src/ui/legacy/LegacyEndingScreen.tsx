import { useState } from "react";
import type { LegacyAxis } from "../../content/legacyConfig";
import type { GameState } from "../../engine/engine.types";
import { platformServices } from "../../platform/platform";
import { ChronicleArtView } from "../chronicle/ChronicleArtView";
import { EmblemImage } from "../heraldry/EmblemImage";
import { Button } from "../kit";
import { UiIcon } from "../UiIcon";
import type { UiIconSize } from "../uiArt";
import { wave8ContentStyle, wave8FrameLayerStyle } from "../wave8Art";
import { wave21Url } from "../wave21Art";
import { endingArtUrl } from "../endingArt";
import { LEGACY_SCREEN_COPY as COPY } from "./legacyScreenCopy.ko";
import { exportChronicleText, type LegacyAxisView, type LegacyEndingView, type LegacyVerdictView } from "./legacyScreenModel";

// UI-10 (LG-7, LG-8): the campaign's end — after chapter 5's page, the legacy verdict over the ending's painting
// (INSTALL-33: one per ending; before, the one Wave 21 campaign-ending painting for all six): the ending's title plate in
// its own colours (legacy.css, `data-ending`) with the leading axis's arms and icon, its sentence, the three axes with
// their parts, the chosen legacy and the ledger records the sentence quotes. From here: the chronicle book, the
// sandbox, the text export.

/** The axis's icon (P0 sheets): the market for the town, the rights' seal for the house, the chapel for the church. */
export function AxisIcon({ axis, size = 24 }: { readonly axis: LegacyAxis; readonly size?: UiIconSize }) {
  return axis === "town" ? <UiIcon sheet="building" cell="market" size={size} className="legacy-axis-icon" />
    : axis === "family" ? <UiIcon sheet="cause" cell="rights" size={size} className="legacy-axis-icon" />
    : <UiIcon sheet="building" cell="chapel" size={size} className="legacy-axis-icon" />;
}

/** The export's state line: the file saved, or that it could not be. */
export function useChronicleExport(state: GameState): { readonly status: string | null; readonly run: () => void } {
  const [status, setStatus] = useState<string | null>(null);
  return {
    status,
    run: () => { void exportChronicleText(state, platformServices().files).then(result => setStatus(result.saved ? COPY.exported(result.fileName) : COPY.exportFailed)); },
  };
}

export function LegacyAxes({ axes }: { readonly axes: readonly LegacyAxisView[] }) {
  return (
    <ul className="legacy-axes" aria-label={COPY.axesLabel}>
      {axes.map(axis => (
        <li key={axis.axis} className="legacy-axis" data-axis={axis.axis} data-lead={axis.lead}>
          <div className="legacy-axis-head">
            <AxisIcon axis={axis.axis} />
            <strong className="legacy-axis-name">{axis.name}</strong>
            <span className="legacy-axis-bar" aria-hidden="true"><span style={{ width: `${axis.score}%` }} /></span>
            <span className="legacy-axis-score" aria-label={COPY.scoreLabel(axis.name, axis.score)}>{COPY.score(axis.score)}</span>
            {axis.lead ? <span className="legacy-axis-lead">{COPY.lead}</span> : null}
          </div>
          <ul className="legacy-axis-parts">
            {axis.parts.map(part => <li key={part.key} data-zero={part.value === 0}>{part.line}</li>)}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** The ending's plate (its colours by `data-ending`), sentence and quoted records. */
export function LegacyEndingBlock({ ending, headingLevel = 2 }: { readonly ending: LegacyEndingView; readonly headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="legacy-ending-block" data-ending={ending.id} data-axis={ending.axis}>
      <div className="legacy-ending-plate">
        <span className="legacy-ending-emblem"><EmblemImage emblem={ending.emblem} size={56} label={COPY.emblemLabel(ending.emblemName)} /></span>
        <div className="legacy-ending-plate-text">
          <span className="legacy-ending-kicker">{COPY.endingHeading}</span>
          <Heading className="legacy-ending-title">{ending.title}</Heading>
        </div>
        <span className="legacy-ending-axis"><AxisIcon axis={ending.axis} size={32} /></span>
      </div>
      <p className="legacy-ending-sentence">{ending.sentence}</p>
      {ending.final ? null : <p className="legacy-ending-provisional">{COPY.provisional}</p>}
      <h3 className="legacy-quotes-heading">{COPY.quotesHeading}</h3>
      {ending.quotes.length === 0 ? <p className="legacy-quotes-empty">{COPY.noQuotes}</p> : (
        <ol className="legacy-quotes">
          {ending.quotes.map(quote => (
            <li key={quote.id} className="legacy-quote" data-record={quote.id}>
              <ChronicleArtView art={quote.art} size={40} className="legacy-quote-art" />
              <span className="legacy-quote-date">{quote.date}</span>
              <span className="legacy-quote-line">{quote.sentence}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * INSTALL-33: the ending's own painting (one per ending) once the ending is written; a provisional view (the scores'
 * ending before the last market day) keeps the shared Wave 21 ch5_campaign_ending, as it is not yet this town's end.
 */
export function endingBackdrop(ending: Pick<LegacyEndingView, "id" | "final">): { readonly id: string; readonly url: string } {
  return ending.final ? { id: ending.id, url: endingArtUrl(ending.id) } : { id: "ch5_campaign_ending", url: wave21Url("ch5_campaign_ending") };
}

export function LegacyEndingScreen({ state, view, onBook, onKeepPlaying }: {
  readonly state: GameState; readonly view: LegacyVerdictView; readonly onBook: () => void; readonly onKeepPlaying: () => void;
}) {
  const exporting = useChronicleExport(state);
  return (
    <div className="story-modal-backdrop legacy-ending-backdrop" role="presentation" data-backdrop={endingBackdrop(view.ending).id}
      style={{ backgroundImage: `url("${endingBackdrop(view.ending).url}")` }}>
      <section className="chronicle-page legacy-ending" data-frame="chapter-page" role="dialog" aria-modal="true" aria-label={view.ending.title} data-ending={view.ending.id}
        data-final={view.ending.final}>
        <span className="chronicle-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_chronicle_page")} />
        <div className="chapter-page-body legacy-ending-body" style={wave8ContentStyle("frame_chronicle_page")}>
          <div className="legacy-ending-scroll">
            <p className="legacy-verdict-title">{COPY.verdictTitle}</p>
            <LegacyEndingBlock ending={view.ending} />
            <h3>{COPY.axesHeading}</h3>
            <LegacyAxes axes={view.axes} />
            <p className="legacy-verdict-lines"><span>{view.leadLine}</span><span>{view.chosenLine}</span></p>
          </div>
          {/* The three buttons stay in view: the footer is the body's last row, the verdict scrolls in the row above it
              (UI-AUDIT-1: beside it, not under it). */}
          <div className="legacy-ending-footer">
            <div className="chronicle-actions legacy-actions">
              <Button type="button" className="legacy-open-book" onPress={() => onBook()} variant="primary"><UiIcon sheet="action" cell="log" />{COPY.openBook}</Button>
              <Button type="button" className="legacy-export" onPress={() => exporting.run()} variant="secondary"><UiIcon sheet="action" cell="open" />{COPY.exportText}</Button>
              <Button type="button" className="legacy-keep" onPress={() => onKeepPlaying()} variant="secondary"><UiIcon sheet="time" cell="play" />{COPY.keepPlaying}</Button>
            </div>
            <p className="legacy-export-status" role="status">{exporting.status ?? ""}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
