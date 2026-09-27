import type { FamineResponseChoice, PetitionResponse } from "../../content/chapterConfig";
import { CHRONICLE_COPY } from "../chronicleCopy.ko";
import type { ChronicleView } from "../chronicleModel";
import { DECISION_COPY } from "../decisionCopy.ko";
import type { FamineDecisionView, PetitionDecisionView } from "../decisionModels";
import { UiIcon } from "../UiIcon";
import { wave8ContentStyle, wave8FrameLayerStyle, wave8ImageStyle, wave8Url } from "../wave8Art";
import { wave16ImageStyle, wave16Url } from "../wave16Art";
import { PersonChip, PersonPortrait } from "../persons/PersonViews";
import type { PersonRow } from "../persons/personModels";
import { PERSONS_COPY } from "../persons/personsCopy.ko";
import { STEWARD_PORTRAIT } from "../portraitArt";
import { Button } from "../kit";
import { EmblemImage } from "../heraldry/EmblemImage";
import { PETITION_COPY } from "../petitionCopy.ko";
import { wave14ImageStyle } from "../wave14Art";
import { wave17ImageStyle, wave17Url } from "../wave17Art";
import { storyArtStyle } from "../storyArt";

// UI-4 story modals (state machine modals: time stops while one is up, and closing it returns to the state under it).
//  - The Great Famine's answer: the 1315 loading keyart behind, the intro illustration, four answers each with its
//    Wave 16 illustration, its line and the engine's predicted numbers. [나중에 정하기] closes it; the event chip reopens it.
//  - The merchants' petition: the Wave 8 petition frame, the petitioners and their demand, three answers with seals.
//  - The chronicle page at the chapter's end, and the chapter 2 preview.

export function FamineDecisionModal({ view, onChoose, onLater, steward = null, onPerson }: {
  readonly view: FamineDecisionView; readonly onChoose: (choice: FamineResponseChoice) => void; readonly onLater: () => void;
  /** UI-5: the lord's steward, who brings the matter (the fixed portrait's look of concern, the name; the chip opens the card). */
  readonly steward?: PersonRow | null; readonly onPerson?: (personId: string) => void;
}) {
  return (
    <div className="story-modal-backdrop story-modal-backdrop--famine" role="presentation" style={{ backgroundImage: `url("${wave8Url("loading_1315_famine")}")` }}>
      <section className="story-modal famine-decision" role="dialog" aria-modal="true" aria-label={DECISION_COPY.famineTitle} data-decision={view.eventId}>
        <div className="story-modal-art" aria-hidden="true" style={wave16ImageStyle("decision_famine_intro", 320)} />
        <h2>{DECISION_COPY.famineTitle}</h2>
        {steward === null ? null : <div className="decision-steward" data-steward={steward.id}>
          {onPerson === undefined ? <PersonPortrait portraitId={STEWARD_PORTRAIT.concern} size={64} />
            : <PersonChip row={{ ...steward, portraitId: STEWARD_PORTRAIT.concern }} size={64} onOpen={id => onPerson(id)} />}
          <p className="decision-steward-advice">{PERSONS_COPY.stewardAdvice}</p>
        </div>}
        <p>{DECISION_COPY.famineIntro}</p>
        <ol className="famine-options">
          {view.options.map(option => (
            <li key={option.choice}>
              <Button type="button" className="famine-option" data-choice={option.choice} aria-label={DECISION_COPY.choose(option.label)} onPress={() => onChoose(option.choice)} variant="primary">
                <span className="famine-option-art" aria-hidden="true" style={wave16ImageStyle(option.illustration, 132)} />
                <strong>{option.label}</strong>
                <span className="famine-option-line">{option.line}</span>
                <span className="famine-option-predicted">{DECISION_COPY.predictedLine(option.predicted)}</span>
              </Button>
            </li>
          ))}
        </ol>
        <Button type="button" className="story-modal-later" onPress={() => onLater()} variant="secondary">{DECISION_COPY.later}</Button>
      </section>
    </div>
  );
}

/** UI-6: the scene of a petition's kind (Wave 16 for chapter 1's, the Wave 17 decision cards for the war's five). */
function PetitionArt({ art }: { readonly art: PetitionDecisionView["presentation"]["art"] }) {
  // The Wave 17 scenes are 4:3 (taller than Wave 16's): a little narrower, so the three answers stay inside the frame.
  return <div className="story-modal-art" aria-hidden="true" style={art.sheet === "wave16" ? wave16ImageStyle(art.id, 300) : wave17ImageStyle(art.id, 208)} />;
}

export function PetitionModal({ view, onRespond, onLater, petitioners = [], onPerson }: {
  readonly view: PetitionDecisionView; readonly onRespond: (response: PetitionResponse) => void; readonly onLater: () => void;
  /** UI-5: the heads who bring the petition (PERSON-0 PS-4: two or three), each a chip that opens their card. */
  readonly petitioners?: readonly PersonRow[]; readonly onPerson?: (personId: string) => void;
}) {
  const { presentation } = view;
  const from = presentation.from;
  // UI-6: who brings it — the faction by its display name and arms; the Crown's writ hangs its seal with those arms;
  // the faction's leader (a person: the king, the earl, the refugees' or townsfolk's head) as a chip beside the town's heads.
  const people = [...(from?.leader === null || from?.leader === undefined ? [] : [from.leader]), ...petitioners.filter(row => row.id !== from?.leader?.id)];
  return (
    <div className="story-modal-backdrop" role="presentation">
      <section className="story-modal petition-card" role="dialog" aria-modal="true" aria-label={presentation.title} data-petition={view.petitionId}
        data-def={presentation.defId}>
        <span className="petition-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_petition")} />
        <div className="petition-body" style={wave8ContentStyle("frame_petition")}>
          <div className="petition-scene">
            <PetitionArt art={presentation.art} />
            {people.length === 0 || onPerson === undefined ? null : (
              <section className="petition-people" aria-label={PERSONS_COPY.petitionersHeading}>
                <h3>{from?.writ === true ? PETITION_COPY.senderHeading : PERSONS_COPY.petitionersHeading}</h3>
                <ul className="person-list">{people.map(row => <li key={row.id}><PersonChip row={row} onOpen={id => onPerson(id)} /></li>)}</ul>
              </section>
            )}
          </div>
          <h2>{presentation.title}</h2>
          {from === null ? null : (
            <p className="petition-who" data-faction={from.factionId}>
              {from.writ ? <span className="petition-writ" role="img" aria-label={PETITION_COPY.writ} style={wave14ImageStyle("wax_seal_hanging", 36)}>
                <span className="petition-writ-arms"><EmblemImage emblem={from.arms} size={22} label={from.name} /></span></span>
                : <EmblemImage emblem={from.arms} size={28} label={from.name} />}
              {PETITION_COPY.from(from.name)}
            </p>
          )}
          <p>{presentation.demand}</p>
          <ol className="petition-options">
            {view.options.map(option => (
              <li key={option.choice}>
                <Button type="button" className="petition-option" data-response={option.choice} aria-label={DECISION_COPY.choose(option.label)} onPress={() => onRespond(option.choice)} variant="primary">
                  <span className="petition-seal" aria-hidden="true" style={wave8ImageStyle(option.seal, 44)} />
                  <strong>{option.label}</strong>
                  <span>{option.line}</span>
                  <span className="petition-predicted">{DECISION_COPY.predictedLine(option.predicted)}</span>
                </Button>
              </li>
            ))}
          </ol>
          <Button type="button" className="story-modal-later" onPress={() => onLater()} variant="secondary">{DECISION_COPY.later}</Button>
        </div>
      </section>
    </div>
  );
}

export function ChroniclePage({ view, onNextChapter, onKeepPlaying, onOpenChronicle }: {
  readonly view: ChronicleView; readonly onNextChapter: () => void; readonly onKeepPlaying: () => void;
  /** CHRON-1: [전체 연대기 보기] opens the chronicle screen over the page (closing it comes back here). */
  readonly onOpenChronicle?: () => void;
}) {
  return (
    <div className="story-modal-backdrop story-modal-backdrop--chronicle" role="presentation"
      style={{ backgroundImage: `url("${view.chapter === 2 ? wave17Url("chapter2_end") : wave16Url("chapter1_end")}")` }}>
      <section className="chronicle-page" role="dialog" aria-modal="true" aria-label={view.title}>
        <span className="chronicle-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_chronicle_page")} />
        <div className="chapter-page-body" style={wave8ContentStyle("frame_chronicle_page")}>
          <h2>{view.title}</h2>
          <div className="chronicle-columns">
          <section><h3>{CHRONICLE_COPY.timelineHeading}</h3>
          <ol className="chronicle-timeline">
            {view.entries.map(entry => (
              <li key={entry.id} className="chronicle-entry">
                <span className="chronicle-entry-art" aria-hidden="true" style={storyArtStyle(entry.illustration, 56)} />
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
            <Button type="button" className="chronicle-next" onPress={() => onNextChapter()} variant="secondary"><UiIcon sheet="action" cell="open" />{CHRONICLE_COPY.nextChapterOf(view.chapter)}</Button>
            <Button type="button" className="chronicle-keep" onPress={() => onKeepPlaying()} variant="secondary"><UiIcon sheet="time" cell="play" />{CHRONICLE_COPY.keepPlaying}</Button>
            {onOpenChronicle === undefined ? null : <Button type="button" className="chronicle-full" onPress={() => onOpenChronicle()} variant="primary">
              <UiIcon sheet="action" cell="log" />{CHRONICLE_COPY.openFull}</Button>}
          </div></section>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * The next chapter's screen after a chapter's page. UI-6: chapter 2 is played in the same town (FAIL-3 FL-8) — its
 * opening (Wave 16 chapter2_intro) names the chapter and lists its goals; a chapter not built yet (3 on) says so.
 */
export function ChapterTwoPreview({ onContinue, chapter = 2, goals = [] }: {
  readonly onContinue: () => void; readonly chapter?: number; readonly goals?: readonly string[];
}) {
  const open = chapter === 2;
  return (
    <div className="chapter-preview" role="dialog" aria-modal="true" aria-label={open ? CHRONICLE_COPY.chapterTwoStartTitle : CHRONICLE_COPY.laterTitle(chapter)}
      data-chapter={chapter} style={{ backgroundImage: `url("${wave16Url("chapter2_intro")}")` }}>
      <p className="chapter-loading-title">{open ? CHRONICLE_COPY.chapterTwoStartTitle : CHRONICLE_COPY.laterTitle(chapter)}</p>
      <p className="chapter-loading-line">{open ? CHRONICLE_COPY.chapterTwoStartLine : CHRONICLE_COPY.laterLine}</p>
      {open && goals.length > 0 ? <section className="chapter-preview-goals" aria-label={CHRONICLE_COPY.chapterTwoGoalsHeading}>
        <h3>{CHRONICLE_COPY.chapterTwoGoalsHeading}</h3><ul>{goals.map(goal => <li key={goal}>{goal}</li>)}</ul></section> : null}
      <Button type="button" className="chapter-preview-continue" onPress={() => onContinue()} variant="primary"><UiIcon sheet="time" cell="play" />
        {open ? CHRONICLE_COPY.chapterTwoStart : CHRONICLE_COPY.chapterTwoContinue}</Button>
    </div>
  );
}
