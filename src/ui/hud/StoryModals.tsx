import type { FamineResponseChoice, PetitionResponse } from "../../content/chapterConfig";
import { CHRONICLE_COPY } from "../chronicleCopy.ko";
import type { ChronicleView } from "../chronicleModel";
import { DECISION_COPY } from "../decisionCopy.ko";
import type { FamineDecisionView, PetitionDecisionView } from "../decisionModels";
import { UiIcon } from "../UiIcon";
import { wave8ContentStyle, wave8FrameLayerStyle, wave8ImageStyle, wave8Url } from "../wave8Art";
import { wave16ImageStyle, wave16Url } from "../wave16Art";

// UI-4 story modals (state machine modals: time stops while one is up, and closing it returns to the state under it).
//  - The Great Famine's answer: the 1315 loading keyart behind, the intro illustration, four answers each with its
//    Wave 16 illustration, its line and the engine's predicted numbers. [나중에 정하기] closes it; the event chip reopens it.
//  - The merchants' petition: the Wave 8 petition frame, the petitioners and their demand, three answers with seals.
//  - The chronicle page at the chapter's end, and the chapter 2 preview.

export function FamineDecisionModal({ view, onChoose, onLater }: {
  readonly view: FamineDecisionView; readonly onChoose: (choice: FamineResponseChoice) => void; readonly onLater: () => void;
}) {
  return (
    <div className="story-modal-backdrop story-modal-backdrop--famine" role="presentation" style={{ backgroundImage: `url("${wave8Url("loading_1315_famine")}")` }}>
      <section className="story-modal famine-decision" role="dialog" aria-modal="true" aria-label={DECISION_COPY.famineTitle} data-decision={view.eventId}>
        <div className="story-modal-art" aria-hidden="true" style={wave16ImageStyle("decision_famine_intro", 320)} />
        <h2>{DECISION_COPY.famineTitle}</h2>
        <p>{DECISION_COPY.famineIntro}</p>
        <ol className="famine-options">
          {view.options.map(option => (
            <li key={option.choice}>
              <button type="button" className="famine-option" data-choice={option.choice} aria-label={DECISION_COPY.choose(option.label)} onClick={() => onChoose(option.choice)}>
                <span className="famine-option-art" aria-hidden="true" style={wave16ImageStyle(option.illustration, 132)} />
                <strong>{option.label}</strong>
                <span className="famine-option-line">{option.line}</span>
                <span className="famine-option-predicted">{DECISION_COPY.predictedLine(option.predicted)}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="story-modal-later" onClick={() => onLater()}>{DECISION_COPY.later}</button>
      </section>
    </div>
  );
}

export function PetitionModal({ view, onRespond, onLater }: {
  readonly view: PetitionDecisionView; readonly onRespond: (response: PetitionResponse) => void; readonly onLater: () => void;
}) {
  return (
    <div className="story-modal-backdrop" role="presentation">
      <section className="story-modal petition-card" role="dialog" aria-modal="true" aria-label={DECISION_COPY.petitionTitle} data-petition={view.petitionId}>
        <span className="petition-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_petition")} />
        <div className="petition-body" style={wave8ContentStyle("frame_petition")}>
          <div className="story-modal-art" aria-hidden="true" style={wave16ImageStyle("event_market_petition", 300)} />
          <h2>{DECISION_COPY.petitionTitle}</h2>
          <p className="petition-who"><UiIcon sheet="resource" cell="population" />{DECISION_COPY.petitioners}</p>
          <p>{DECISION_COPY.demand}</p>
          <p>{DECISION_COPY.petitionIntro}</p>
          <ol className="petition-options">
            {view.options.map(option => (
              <li key={option.choice}>
                <button type="button" className="petition-option" data-response={option.choice} aria-label={DECISION_COPY.choose(option.label)} onClick={() => onRespond(option.choice)}>
                  <span className="petition-seal" aria-hidden="true" style={wave8ImageStyle(option.seal, 44)} />
                  <strong>{option.label}</strong>
                  <span>{option.line}</span>
                  <span className="petition-predicted">{DECISION_COPY.predictedLine(option.predicted)}</span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="story-modal-later" onClick={() => onLater()}>{DECISION_COPY.later}</button>
        </div>
      </section>
    </div>
  );
}

export function ChroniclePage({ view, onNextChapter, onKeepPlaying }: {
  readonly view: ChronicleView; readonly onNextChapter: () => void; readonly onKeepPlaying: () => void;
}) {
  return (
    <div className="story-modal-backdrop story-modal-backdrop--chronicle" role="presentation" style={{ backgroundImage: `url("${wave16Url("chapter1_end")}")` }}>
      <section className="chronicle-page" role="dialog" aria-modal="true" aria-label={view.title}>
        <span className="chronicle-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_chronicle_page")} />
        <div className="chronicle-body" style={wave8ContentStyle("frame_chronicle_page")}>
          <h2>{view.title}</h2>
          <div className="chronicle-columns">
          <section><h3>{CHRONICLE_COPY.timelineHeading}</h3>
          <ol className="chronicle-timeline">
            {view.entries.map(entry => (
              <li key={entry.id} className="chronicle-entry">
                <span className="chronicle-entry-art" aria-hidden="true" style={wave16ImageStyle(entry.illustration, 56)} />
                <span className="chronicle-entry-date">{entry.date}</span><span className="chronicle-entry-line">{entry.sentence}</span>
              </li>
            ))}
          </ol></section>
          <section><h3>{CHRONICLE_COPY.decisionsHeading}</h3>
          <ol className="chronicle-decisions">
            {view.decisions.map(decision => (
              <li key={decision.id}><strong>{decision.sentence}</strong>{decision.alternatives === "" ? null : <span>{decision.alternatives}</span>}<span>{decision.outcome}</span></li>
            ))}
          </ol>
          <h3>{CHRONICLE_COPY.statsHeading}</h3>
          <ul className="chronicle-stats">{view.stats.map(line => <li key={line}>{line}</li>)}</ul>
          <div className="chronicle-actions">
            <button type="button" className="chronicle-next" onClick={() => onNextChapter()}><UiIcon sheet="action" cell="open" />{CHRONICLE_COPY.nextChapter}</button>
            <button type="button" className="chronicle-keep" onClick={() => onKeepPlaying()}><UiIcon sheet="time" cell="play" />{CHRONICLE_COPY.keepPlaying}</button>
          </div></section>
          </div>
        </div>
      </section>
    </div>
  );
}

/** The chapter 2 preview (Wave 16 chapter2_intro): chapter 2 is not built yet, so it returns to this town. */
export function ChapterTwoPreview({ onContinue }: { readonly onContinue: () => void }) {
  return (
    <div className="chapter-preview" role="dialog" aria-modal="true" aria-label={CHRONICLE_COPY.chapterTwoTitle} style={{ backgroundImage: `url("${wave16Url("chapter2_intro")}")` }}>
      <p className="chapter-loading-title">{CHRONICLE_COPY.chapterTwoTitle}</p>
      <p className="chapter-loading-line">{CHRONICLE_COPY.chapterTwoLine}</p>
      <button type="button" className="chapter-preview-continue" onClick={() => onContinue()}><UiIcon sheet="time" cell="play" />{CHRONICLE_COPY.chapterTwoContinue}</button>
    </div>
  );
}
