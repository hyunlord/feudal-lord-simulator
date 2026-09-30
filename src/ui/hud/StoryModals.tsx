import type { FamineResponseChoice, PetitionResponse } from "../../content/chapterConfig";
import { CHRONICLE_COPY } from "../chronicleCopy.ko";
import type { ChronicleView } from "../chronicleModel";
import { DECISION_COPY } from "../decisionCopy.ko";
import type { FamineDecisionView, PetitionDecisionView } from "../decisionModels";
import type { HeirCandidateView } from "../heirCandidateModel";
import { UiIcon } from "../UiIcon";
import { wave8ContentStyle, wave8FrameLayerStyle, wave8ImageStyle, wave8Url } from "../wave8Art";
import { wave16ImageStyle, wave16Url } from "../wave16Art";
import { chapterIntro, wave31Url } from "../wave31Art";
import { PersonChip, PersonPortrait } from "../persons/PersonViews";
import type { PersonRow } from "../persons/personModels";
import { PERSONS_COPY } from "../persons/personsCopy.ko";
import { STEWARD_PORTRAIT } from "../portraitArt";
import { Button } from "../kit";
import { EmblemImage } from "../heraldry/EmblemImage";
import { PETITION_COPY } from "../petitionCopy.ko";
import { wave14ImageStyle } from "../wave14Art";
import { wave17ImageStyle, wave17Url } from "../wave17Art";
import { wave21ImageStyle, wave21Url } from "../wave21Art";
import { wave33ImageStyle } from "../wave33Art";
import { storyArtStyle } from "../storyArt";

// UI-4 story modals (state machine modals: time stops while one is up, and closing it returns to the state under it).
//  - The Great Famine's answer: the 1315 loading keyart behind, the intro illustration, four answers each with its
//    Wave 16 illustration, its line and the engine's predicted numbers. [나중에 정하기] closes it; the event chip reopens it.
//  - The merchants' petition: the Wave 8 petition frame, the petitioners and their demand, three answers with seals.
//  - The chronicle page at the chapter's end, and the chapter 2 preview.

/** NAT-2 (QA-009): an answer's forecast line, none while the engine gives it no numbers (it shows once it does). */
function PredictedLine({ className, numbers }: { readonly className: string; readonly numbers: string }) {
  const line = DECISION_COPY.predictedLine(numbers);
  return line === null ? null : <span className={className}>{line}</span>;
}

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
                <PredictedLine className="famine-option-predicted" numbers={option.predicted} />
              </Button>
            </li>
          ))}
        </ol>
        <Button type="button" className="story-modal-later" onPress={() => onLater()} variant="secondary">{DECISION_COPY.later}</Button>
      </section>
    </div>
  );
}

/** UI-6: the scene of a petition's kind (Wave 16 for chapter 1's, the Wave 17 decision cards for the war's five).
 *  UI-8: extended to accept "wave21" for the chapter 3 plague decisions. UI-10: "wave33" for the interlude's two. */
function PetitionArt({ art }: { readonly art: PetitionDecisionView["presentation"]["art"] }) {
  if (art === null) return null;
  // Wave 17 and Wave 21 decision cards are 4:3 (taller than Wave 16's): narrower so the three answers stay inside the frame.
  if (art.sheet === "wave21") return <div className="story-modal-art" aria-hidden="true" style={wave21ImageStyle(art.id, 208)} />;
  // UI-10: the Wave 33 interlude illustrations are 16:9, as tall at 240 as a 4:3 card at 180.
  if (art.sheet === "wave33") return <div className="story-modal-art" aria-hidden="true" style={wave33ImageStyle(art.id, 240)} />;
  return <div className="story-modal-art" aria-hidden="true" style={art.sheet === "wave16" ? wave16ImageStyle(art.id, 300) : wave17ImageStyle(art.id, 208)} />;
}

/** UI-10 (LG-3): the heir an answer names — the portrait, the name, who they are to the old lord, their likeness and records. */
function HeirCandidate({ heir }: { readonly heir: HeirCandidateView }) {
  return (
    <span className="petition-heir" data-person={heir.personId} data-portrait-exact={heir.exact ? "true" : "false"}>
      <PersonPortrait portraitId={heir.portraitId} size={48} />
      <span className="petition-heir-text">
        <strong>{heir.name}</strong>
        <span>{heir.who} · {heir.lineage}</span>
        <span>{heir.resemblance}</span>
        <span>{heir.records}</span>
      </span>
    </span>
  );
}

export function PetitionModal({ view, onRespond, onLater, petitioners = [], onPerson }: {
  readonly view: PetitionDecisionView; readonly onRespond: (response: PetitionResponse) => void; readonly onLater: () => void;
  /** UI-5: the heads who bring the petition (PERSON-0 PS-4: two or three), each a chip that opens their card. */
  readonly petitioners?: readonly PersonRow[]; readonly onPerson?: (personId: string) => void;
}) {
  const { presentation } = view;
  const from = presentation.from;
  const behalf = PETITION_COPY.onBehalf[presentation.defId];
  // UI-6: who brings it — the faction by its display name and arms; the Crown's writ hangs its seal with those arms;
  // the faction's leader (a person: the king, the earl, the refugees' or townsfolk's head) as a chip beside the town's heads.
  const people = [...(from?.leader === null || from?.leader === undefined ? [] : [from.leader]), ...petitioners.filter(row => row.id !== from?.leader?.id)];
  return (
    <div className="story-modal-backdrop" role="presentation">
      <section className="story-modal petition-card" role="dialog" aria-modal="true" aria-label={presentation.title} data-petition={view.petitionId}
        data-def={presentation.defId} data-answers={view.options.length}>
        <span className="petition-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_petition")} />
        {/* UI-6b: the sender's arms in the frame's empty roundel (its top-left corner). */}
        {from === null ? null : <span className="petition-roundel"><EmblemImage emblem={from.arms} size={38} label={PETITION_COPY.arms(from.name)} /></span>}
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
                <span className="petition-writ-arms"><EmblemImage emblem={from.arms} size={22} label={from.name} /></span></span> : null}
              {behalf === undefined ? PETITION_COPY.from(from.name) : PETITION_COPY.fromOnBehalf(from.name, behalf)}
            </p>
          )}
          <p>{presentation.demand}</p>
          <ol className="petition-options">
            {view.options.map(option => (
              <li key={option.choice}>
                <Button type="button" className="petition-option" data-response={option.choice} aria-label={DECISION_COPY.choose(option.label)} onPress={() => onRespond(option.choice)} variant="primary">
                  <span className="petition-seal" aria-hidden="true" style={wave8ImageStyle(option.seal, 44)} />
                  <strong>{option.label}</strong>
                  {option.heir === undefined ? null : <HeirCandidate heir={option.heir} />}
                  <span>{option.line}</span>
                  <PredictedLine className="petition-predicted" numbers={option.predicted} />
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
      style={{ backgroundImage: `url("${view.chapter === 3 ? wave21Url("ch3_ending") : view.chapter === 2 ? wave17Url("chapter2_end") : wave16Url("chapter1_end")}")` }}>
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
export function ChapterTwoPreview({ onContinue, chapter = 2, goals = [], startYear = null }: {
  readonly onContinue: () => void; readonly chapter?: number; readonly goals?: readonly string[];
  /** UI-10: the year the chapter began (chronicleModel `chapterStartYear`), its title's first year. */
  readonly startYear?: number | null;
}) {
  // PLAGUE-b: chapter 3 on opens the same way over its Wave 31 painting when the game has built it (its copy line).
  const later = CHRONICLE_COPY.chapterOpening[chapter];
  const intro = chapterIntro(chapter);
  const opening = chapter === 2 ? { title: CHRONICLE_COPY.chapterTwoStartTitle, line: CHRONICLE_COPY.chapterTwoStartLine, start: CHRONICLE_COPY.chapterTwoStart }
    : later !== undefined && intro !== null ? { ...later, title: later.title(startYear) } : null;
  const open = opening !== null;
  const art = intro === null ? wave16Url("chapter2_intro") : wave31Url(intro);
  return (
    <div className="chapter-preview" role="dialog" aria-modal="true" aria-label={opening?.title ?? CHRONICLE_COPY.laterTitle(chapter)}
      data-chapter={chapter} style={{ backgroundImage: `url("${art}")` }}>
      <p className="chapter-loading-title">{opening?.title ?? CHRONICLE_COPY.laterTitle(chapter)}</p>
      <p className="chapter-loading-line">{opening?.line ?? CHRONICLE_COPY.laterLine}</p>
      {open && goals.length > 0 ? <section className="chapter-preview-goals" aria-label={CHRONICLE_COPY.chapterTwoGoalsHeading}>
        <h3>{CHRONICLE_COPY.chapterTwoGoalsHeading}</h3><ul>{goals.map(goal => <li key={goal}>{goal}</li>)}</ul></section> : null}
      <Button type="button" className="chapter-preview-continue" onPress={() => onContinue()} variant="primary"><UiIcon sheet="time" cell="play" />
        {opening?.start ?? CHRONICLE_COPY.chapterTwoContinue}</Button>
    </div>
  );
}
