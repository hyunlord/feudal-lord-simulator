import type { FamineResponseChoice, PetitionResponse } from "../../content/chapterConfig";
import { CHRONICLE_COPY } from "../chronicleCopy.ko";
import type { ChronicleView } from "../chronicleModel";
import { DecisionCard } from "../decisionCard/DecisionCard";
import type { FamineCardView } from "../decisionCard/families/famineCard";
import type { PetitionCardView } from "../decisionCard/families/petitionCard";
import type { HeirCandidateView } from "../heirCandidateModel";
import { UiIcon } from "../UiIcon";
import { wave8ContentStyle, wave8FrameLayerStyle } from "../wave8Art";
import { wave16Url } from "../wave16Art";
import { chapterIntro, wave31Url } from "../wave31Art";
import { PersonChip, PersonPortrait } from "../persons/PersonViews";
import type { PersonRow } from "../persons/personModels";
import { PERSONS_COPY } from "../persons/personsCopy.ko";
import { STEWARD_PORTRAIT } from "../portraitArt";
import { Button } from "../kit";
import { EmblemImage } from "../heraldry/EmblemImage";
import { PETITION_COPY } from "../petitionCopy.ko";
import { wave14ImageStyle } from "../wave14Art";
import { wave17Url } from "../wave17Art";
import { wave21Url } from "../wave21Art";
import { storyArtStyle } from "../storyArt";

// UI-4 story modals (state machine modals: time stops while one is up, and closing it returns to the state under it).
//  - DEC-CARD: the Great Famine's answer and every political petition are the heavy decision card (`DecisionCard`): what
//    is happening, what is at stake, until when, and each answer's now / later / who remembers, from the answer run on
//    the state (`decisionCard/families/famineCard.ts`, `petitionCard.ts`). [나중에 정한다] closes it; the chip reopens it.
//  - The chronicle page at the chapter's end, and the chapter 2 preview.

export function FamineDecisionModal({ view, onChoose, onLater, steward = null, onPerson }: {
  readonly view: FamineCardView; readonly onChoose: (choice: FamineResponseChoice) => void; readonly onLater: () => void;
  /** UI-5: the lord's steward, who brings the matter (the fixed portrait's look of concern, the name; the chip opens the card). */
  readonly steward?: PersonRow | null; readonly onPerson?: (personId: string) => void;
}) {
  // DEC-CARD: the famine in the heavy card's layout; the steward who brings it stays beside the stake (the card's `extra`).
  const extra = steward === null ? null : <div className="decision-steward" data-steward={steward.id}>
    {onPerson === undefined ? <PersonPortrait portraitId={STEWARD_PORTRAIT.concern} size={64} />
      : <PersonChip row={{ ...steward, portraitId: STEWARD_PORTRAIT.concern }} size={64} onOpen={id => onPerson(id)} />}
    <p className="decision-steward-advice">{PERSONS_COPY.stewardAdvice}</p>
  </div>;
  return <DecisionCard view={view.card} className="famine-decision" data={{ "data-decision": view.eventId }} extra={extra}
    onLater={onLater} onChoose={choice => onChoose(choice as FamineResponseChoice)} />;
}

/** UI-10 (LG-3): the heir an answer names — the portrait, the name, who they are to the old lord, their likeness and records. */
function HeirCandidate({ heir, answer }: { readonly heir: HeirCandidateView; readonly answer: string }) {
  return (
    <li className="petition-heir" data-person={heir.personId} data-portrait-exact={heir.exact ? "true" : "false"} data-choice={heir.response}>
      <PersonPortrait portraitId={heir.portraitId} size={48} />
      <strong className="petition-heir-name">{heir.name}</strong>
      <span className="petition-heir-who">{heir.who}</span>
      <span className="petition-heir-answer">{answer}</span>
      <span className="petition-heir-line">{heir.lineage}</span>
      <span className="petition-heir-line">{heir.resemblance}</span>
      <span className="petition-heir-line">{heir.records}</span>
    </li>
  );
}

export function PetitionModal({ view, onRespond, onLater, petitioners = [], onPerson }: {
  readonly view: PetitionCardView; readonly onRespond: (response: PetitionResponse) => void; readonly onLater: () => void;
  /** UI-5: the heads who bring the petition (PERSON-0 PS-4: two or three), each a chip that opens their card. */
  readonly petitioners?: readonly PersonRow[]; readonly onPerson?: (personId: string) => void;
}) {
  const from = view.from;
  // UI-6: who brings it — the faction's arms in the roundel; the Crown's writ hangs its seal with those arms; the faction's
  // leader (the king, the earl, the refugees' or townsfolk's head) as a chip beside the town's heads. DEC-CARD: these and
  // the heir candidates are the card's `extra`, between the stake and the answers.
  const people = [...(from?.leader === null || from?.leader === undefined ? [] : [from.leader]), ...petitioners.filter(row => row.id !== from?.leader?.id)];
  const extra = <>
    {people.length === 0 || onPerson === undefined ? null : (
      <section className="petition-people" aria-label={PERSONS_COPY.petitionersHeading}>
        <h3>{from?.writ === true ? <span className="petition-writ" role="img" aria-label={PETITION_COPY.writ} style={wave14ImageStyle("wax_seal_hanging", 36)}>
          <span className="petition-writ-arms"><EmblemImage emblem={from.arms} size={22} label={from.name} /></span></span> : null}
          {from?.writ === true ? PETITION_COPY.senderHeading : PERSONS_COPY.petitionersHeading}</h3>
        <ul className="person-list">{people.map(row => <li key={row.id}><PersonChip row={row} onOpen={id => onPerson(id)} /></li>)}</ul>
      </section>
    )}
    {view.heirs.length === 0 ? null : <section className="petition-heirs" aria-label={PETITION_COPY.heir.heading}>
      <h3>{PETITION_COPY.heir.heading}</h3>
      <ul>{view.heirs.map(entry => <HeirCandidate key={entry.heir.personId} heir={entry.heir} answer={entry.label} />)}</ul>
    </section>}
  </>;
  return <DecisionCard view={view.card} className="petition-decision" extra={extra}
    crest={from === null ? null : { arms: from.arms, label: PETITION_COPY.arms(from.name) }}
    data={{ "data-petition": view.petitionId, "data-def": view.defId, ...(from === null ? {} : { "data-faction": from.factionId }) }}
    onLater={onLater} onChoose={choice => onRespond(choice as PetitionResponse)} />;
}

export function ChroniclePage({ view, onNextChapter, onKeepPlaying, onOpenChronicle, nextLabel }: {
  readonly view: ChronicleView; readonly onNextChapter: () => void; readonly onKeepPlaying: () => void;
  /** CHRON-1: [전체 연대기 보기] opens the chronicle screen over the page (closing it comes back here). */
  readonly onOpenChronicle?: () => void;
  /** UI-10: the next button's words when it leads elsewhere (chapter 5's page: to the legacy verdict). */
  readonly nextLabel?: string;
}) {
  return (
    <div className="story-modal-backdrop story-modal-backdrop--chronicle" role="presentation"
      style={{ backgroundImage: `url("${view.chapter === 3 ? wave21Url("ch3_ending") : view.chapter === 2 ? wave17Url("chapter2_end") : wave16Url("chapter1_end")}")` }}>
      <section className="chronicle-page" data-frame="chapter-page" role="dialog" aria-modal="true" aria-label={view.title}>
        <span className="chronicle-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_chronicle_page")} />
        <div className="chapter-page-body chapter-page-main" style={wave8ContentStyle("frame_chronicle_page")}>
          {/* UI-AUDIT-1: the page's lines scroll in their own region; the footer is the row under it, never over a line. */}
          <div className="chapter-page-scroll">
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
          <ul className="chronicle-stats">{view.stats.map(line => <li key={line}>{line}</li>)}</ul></section>
          </div>
          </div>
          {/* UI-10: the page's footer — the full panel's width, under the lines (a long page — chapter 5's six decisions —
              scrolls above it); its buttons in the right column's place, as before. */}
          <div className="chronicle-page-footer">
          <div className="chronicle-actions">
            <Button type="button" className="chronicle-next" onPress={() => onNextChapter()} variant="secondary"><UiIcon sheet="action" cell="open" />{nextLabel ?? CHRONICLE_COPY.nextChapterOf(view.chapter)}</Button>
            <Button type="button" className="chronicle-keep" onPress={() => onKeepPlaying()} variant="secondary"><UiIcon sheet="time" cell="play" />{CHRONICLE_COPY.keepPlaying}</Button>
            {onOpenChronicle === undefined ? null : <Button type="button" className="chronicle-full" onPress={() => onOpenChronicle()} variant="primary">
              <UiIcon sheet="action" cell="log" />{CHRONICLE_COPY.openFull}</Button>}
          </div></div>
        </div>
      </section>
    </div>
  );
}

/**
 * The next chapter's screen after a chapter's page. UI-6: chapter 2 is played in the same town (FAIL-3 FL-8) — its
 * opening (Wave 16 chapter2_intro) names the chapter and lists its goals; a chapter not built yet (3 on) says so.
 */
export function ChapterTwoPreview({ onContinue, chapter = 2, goals = [], startYear = null, closeLabel = null }: {
  readonly onContinue: () => void; readonly chapter?: number; readonly goals?: readonly string[];
  /** UI-10: the year the chapter began (chronicleModel `chapterStartYear`), its title's first year. */
  readonly startYear?: number | null;
  /** QA-025: opened again from the chapter's card ("목표 보기"): the button only closes (no play, no "제N장 시작"). */
  readonly closeLabel?: string | null;
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
      {open && goals.length > 0 ? <section className="chapter-preview-goals" data-frame="flat" aria-label={CHRONICLE_COPY.chapterTwoGoalsHeading}>
        <h3>{CHRONICLE_COPY.chapterTwoGoalsHeading}</h3><ul>{goals.map(goal => <li key={goal}>{goal}</li>)}</ul></section> : null}
      <Button type="button" className="chapter-preview-continue" onPress={() => onContinue()} variant="primary">
        {closeLabel ?? <><UiIcon sheet="time" cell="play" />{opening?.start ?? CHRONICLE_COPY.chapterTwoContinue}</>}</Button>
    </div>
  );
}
