import { useEffect, useRef } from "react";
import { CHAPTER_FIVE } from "../../content/chapterConfig";
import type { GameState } from "../../engine/engine.types";
import { platformServices } from "../../platform/platform";
import { PlacementPaletteToggle } from "../../render/PlacementPaletteToggle";
import { presentedState } from "../../render/presentation/presentedState";
import { PresentationToggle } from "../../render/PresentationToggle";
import { useGameUiSelector } from "../../state/gameStore";
import { AudioControls } from "../AudioControls";
import type { BuildCategory } from "../buildMenuPresentation";
import { ChronicleScreen } from "../chronicle/ChronicleScreen";
import { chronicleView } from "../chronicleModel";
import { PauseMenu } from "../hud/HudShell";
import { SeasonLedgerCard } from "../hud/SeasonLedgerCard";
import { ChapterTwoPreview, ChroniclePage, FamineDecisionModal, PetitionModal } from "../hud/StoryModals";
import { LordRequestModal } from "../hud/LordCards";
import { DecisionCard } from "../decisionCard/DecisionCard";
import { AnswerReceipt } from "../decisionCard/AnswerReceipt";
import { answerMeta } from "../decisionCard/answerReceiptModel";
import type { DecisionCardView } from "../decisionCard/decisionCardTypes";
import { useAnswerReceipt } from "../decisionCard/useAnswerReceipt";
import type { GameAction } from "../../state/gameStore.types";
import { famineCard } from "../decisionCard/families/famineCard";
import { homePetitionCard } from "../decisionCard/families/homePetitionCard";
import { lordRequestCard } from "../decisionCard/families/lordRequestCard";
import { petitionCard } from "../decisionCard/families/petitionCard";
import { homePetitionView, lordRequestView } from "../lordCardsModel";
import { RegistryOfferModal } from "../hud/RegistryCard";
import { registryOfferView } from "../registryCardModel";
import { AuditDecisionModal, MarriageDecisionModal, OffMapPetitionModal } from "../lord/decisions/DecisionCards";
import { auditDecisionView, marriageDecisionView, offMapPetitionView } from "../lord/decisions/decisionCardsModel";
import { focusChronicleRecord, focusChronicleYears } from "../lord/chronicleFocus";
import { SliceEndPage, SliceStartPage } from "../slice/SlicePages";
import { SLICE_COPY } from "../slice/sliceCopy.ko";
import { sliceEnded } from "../slice/sliceDue";
import { sliceEndView, sliceYearCard } from "../slice/sliceEndModel";
import { sliceStartView } from "../slice/sliceStartModel";
import type { LordScreenId } from "../lord/screen/lordScreenTypes";
import { houseChangeView } from "../results/houseChange";
import { HouseChangeCard, YearReviewCard } from "../results/ResultCards";
import { yearCard } from "../results/lordYearReview";
import { Button } from "../kit";
import { ChronicleBook } from "../legacy/ChronicleBook";
import { LegacyEndingScreen } from "../legacy/LegacyEndingScreen";
import { LEGACY_SCREEN_COPY } from "../legacy/legacyScreenCopy.ko";
import { legacyVerdictView } from "../legacy/legacyScreenModel";
import { personCardView, petitionerRows, type personRow } from "../persons/personModels";
import { PersonCardModal } from "../persons/PersonViews";
import { seasonLedgerCardModel } from "../seasonLedgerCard";
import { SEASON_LEDGER_COPY } from "../seasonLedgerCopy.ko";
import { topModal, type UiEvent, type UiModal, type UiState } from "../stateMachine/uiStateMachine";
import { TutorialToggle } from "../tutorial/TutorialShell";
import { UiIcon } from "../UiIcon";
import type { TutorialController } from "../tutorial/useTutorialController";
import { chapterGoals } from "../../engine/politics";
import { CHAPTER_COPY } from "../chapterCopy.ko";
import { chapterStartYear, latestChapterEnd } from "../chronicleModel";

/**
 * CODE-1c (from App): the modal screens on top of the town — the season card, the famine decision, a petition, the
 * chapter page, a person card, the chronicle, chapter 2's preview and the pause menu. They read the game themselves on
 * the UI channel, and only while one is up (otherwise this keeps its first state and does not re-render on a tick).
 * UI-10 (LG-8, LG-9): chapter 5's page leads to the legacy verdict and the campaign's ending (not a chapter-6
 * preview); the ending opens the chronicle book. The book (so far) opens from the chronicle screen and the pause menu at
 * any time, and the ending again from the chronicle screen once it is written.
 */
export function AppModals({ ui, sendUi, personCardId, chroniclePersonId, onChroniclePerson, steward, onPerson, ledgerAuto, onLedgerAuto,
  ledgerFirst = false, onMenuRequest, tutorial, chapterGoalsView = false, onOpenLord }: {
  readonly ui: UiState;
  readonly sendUi: (event: UiEvent) => void;
  readonly personCardId: string | null;
  readonly chroniclePersonId: string | null;
  readonly onChroniclePerson: (id: string | null) => void;
  readonly steward: ReturnType<typeof personRow> | null;
  readonly onPerson: (id: string) => void;
  readonly ledgerAuto: boolean;
  readonly onLedgerAuto: (next: boolean) => void;
  /** LM-R1: the season card up is the first that opened by itself (it asks how later seasons come). */
  readonly ledgerFirst?: boolean;
  readonly onMenuRequest: (request: { readonly category: BuildCategory; readonly nonce: number }) => void;
  readonly tutorial: Pick<TutorialController, "enabled" | "setEnabled">;
  /** QA-025: the preview was opened from the chapter's card ("목표 보기"): the current chapter's goals, a close button. */
  readonly chapterGoalsView?: boolean;
  /** LM-R2 (lord mode): open the lord screen host on a screen and an engine id (the contested inheritance's suit). */
  readonly onOpenLord?: (screen: LordScreenId, focus: string) => void;
}) {
  const top = topModal(ui);
  // RECEIPTS: an answered card turns over to its receipt in the same modal; while it is up no card is shown under it.
  const receipts = useAnswerReceipt();
  const receipt = receipts.receipt !== null && receipts.receipt.modal === top ? receipts.receipt : null;
  const shown = receipt === null ? top : null;
  const idleStateRef = useRef<GameState | null>(null);
  const state = useGameUiSelector(top !== null ? presentedState : (current: GameState) => (idleStateRef.current ??= presentedState(current)));
  const seasonCard = top === "season_ledger" ? seasonLedgerCardModel(state) : null;
  // DEC-CARD: the famine and every political petition in the heavy card's layout (each answer run on the state).
  const famineView = shown === "decision" ? famineCard(state) : null;
  const petitionView = shown === "petition" ? petitionCard(state) : null;
  const chronicle = top === "chronicle" ? chronicleView(state) : null;
  const personCard = top === "person_card" && personCardId !== null ? personCardView(state, personCardId) : null;
  const legacyView = top === "legacy_ending" ? legacyVerdictView(state) : null;
  // LM-R1 (lord mode): the home estate's petition, the town's request.
  const homeView = shown === "estate_petition" ? homePetitionView(state) : null;
  // DEC-CARD: the home petition in the heavy card's layout (the situation, the stake, each answer now / later / who remembers).
  const homeCard = shown === "estate_petition" ? homePetitionCard(state) : null;
  const asked = shown === "lord_request" ? lordRequestView(state) : null;
  const request = asked?.command === null ? null : asked;
  // DEC-CARD: the town's request in the heavy card's layout (its grant run on the state: what it opens, the actual to come).
  const requestCard = request === null ? null : lordRequestCard(state);
  // EVENT-ART: the registry's event card; it goes when its offer is answered, lapsed or invalid (no open offer left).
  const offer = shown === "registry_offer" ? registryOfferView(state) : null;
  // LM-R2: the father's will or the contested inheritance, an audit's finding, an off-map estate's petition.
  const marriage = shown === "marriage_decision" ? marriageDecisionView(state) : null;
  const audit = shown === "audit_decision" ? auditDecisionView(state) : null;
  const offMap = shown === "estate_petition_offmap" ? offMapPetitionView(state) : null;
  // DEC-CARD: the year just ended ("올해 당신의 결정이 바꾼 것"; DEC-CARD-2: the engine's yearReview in lord mode); (lord
  // mode, A3) the season's change in the lord's house.
  // LM-R3: opened from the slice's end page, the year card is the slice's last year's (the page took its place).
  const yearView = top === "year_review" ? ui.modals.at(-2)?.modal === "slice_end" ? sliceYearCard(state) : yearCard(state) : null;
  const house = top === "house_change" ? houseChangeView(state) : null;
  // LM-R3: the lord slice's opening page and its end (reopened from the chronicle and the pause menu once it has ended).
  const sliceStart = top === "slice_start" ? sliceStartView(state) : null;
  const sliceEnd = top === "slice_end" ? sliceEndView(state) : null;
  const sliceOver = (top === "history" || top === "pause_menu") && sliceEnded(state);
  const lordGone = (shown === "estate_petition" && homeView === null) || (shown === "lord_request" && request === null)
    || (shown === "registry_offer" && offer === null) || (shown === "marriage_decision" && marriage === null) || (shown === "audit_decision" && audit === null)
    || (shown === "estate_petition_offmap" && offMap === null) || (top === "house_change" && house === null)
    || (top === "slice_start" && sliceStart === null) || (top === "slice_end" && sliceEnd === null);
  const endingWritten = top === "history" && state.legacy?.ending !== undefined;
  // A decision modal whose question went away (answered elsewhere, or the famine moved on) closes itself.
  const famineGone = famineView === null; const petitionGone = petitionView === null;
  const chronicleGone = chronicle === null; const personCardGone = personCard === null; const legacyGone = legacyView === null;
  useEffect(() => {
    if ((shown === "decision" && famineGone) || (shown === "petition" && petitionGone) || (topModal(ui) === "chronicle" && chronicleGone)
      || (topModal(ui) === "person_card" && personCardGone) || (topModal(ui) === "legacy_ending" && legacyGone) || lordGone) sendUi({ type: "pop_modal" });
  }, [ui, shown, famineGone, petitionGone, chronicleGone, personCardGone, legacyGone, lordGone, sendUi]);
  // A receipt goes with its modal (Esc closes it as it would the card).
  const { receipt: held, close: closeReceipt } = receipts;
  useEffect(() => { if (held !== null && held.modal !== top) closeReceipt(); }, [held, top, closeReceipt]);
  /** RECEIPTS: an answer on a card — the card turns over to its receipt, or (the engine refused it) closes as before. */
  const answered = (modal: UiModal, command: GameAction, card: DecisionCardView, choiceId: string) => {
    if (!receipts.answer(modal, command, answerMeta(card, choiceId))) sendUi({ type: "pop_modal" });
  };
  return <>
    {seasonCard === null ? null : <SeasonLedgerCard model={seasonCard} auto={ledgerAuto} first={ledgerFirst}
      onAutoChange={onLedgerAuto}
      onPolicy={onOpenLord === undefined ? undefined : kind => { sendUi({ type: "pop_modal" }); onOpenLord("petitions", kind); }}
      onResume={() => sendUi({ type: "pop_modal" })}
      onHint={() => { const hint = seasonCard.hint; sendUi({ type: "pop_modal" }); if (hint !== null) onMenuRequest({ category: hint.category, nonce: Date.now() }); }} />}
    {famineView === null ? null : <FamineDecisionModal view={famineView} onLater={() => sendUi({ type: "pop_modal" })} steward={steward} onPerson={onPerson}
      onChoose={choice => answered("decision", { type: "famine_response", choice }, famineView.card, choice)} />}
    {petitionView === null ? null : <PetitionModal view={petitionView} onLater={() => sendUi({ type: "pop_modal" })} onPerson={onPerson}
      petitioners={petitionerRows(state, state.politics?.petitions.find(petition => petition.id === petitionView.petitionId) ?? {})}
      onRespond={response => answered("petition", { type: "petition_response", petitionId: petitionView.petitionId, response }, petitionView.card, response)} />}
    {homeView === null || homeCard === null ? null : <DecisionCard view={homeCard} className="lord-card" crest={{ arms: homeView.arms, label: homeView.armsLabel }}
      data={{ "data-home-petition": homeView.kind, "data-petition": homeView.petitionId }}
      onLater={() => sendUi({ type: "pop_modal" })}
      onChoose={choice => answered("estate_petition", { type: "answer_estate_petition", petitionId: homeView.petitionId, grant: choice === "grant" }, homeCard, choice)} />}
    {request === null || requestCard === null ? null : <LordRequestModal view={request} card={requestCard} onLater={() => sendUi({ type: "pop_modal" })}
      onGrant={() => { if (request.command !== null) answered("lord_request", request.command, requestCard, "grant"); }} />}
    {offer === null ? null : <RegistryOfferModal view={offer} onLater={() => sendUi({ type: "pop_modal" })}
      onAnswer={choiceId => answered("registry_offer", { type: "answer_registry_offer", occurrenceId: offer.occurrenceId, choiceId }, offer.card, choiceId)} />}
    {marriage === null ? null : <MarriageDecisionModal view={marriage} onLater={() => sendUi({ type: "pop_modal" })}
      onAnswer={choice => answered("marriage_decision", { type: "answer_will_change", choice }, marriage.card, choice)}
      onOpenSuit={focus => { sendUi({ type: "pop_modal" }); onOpenLord?.("ledger", focus); }} />}
    {audit === null ? null : <AuditDecisionModal view={audit} onLater={() => sendUi({ type: "pop_modal" })}
      onAnswer={choice => answered("audit_decision", { type: "answer_audit", auditId: audit.auditId, choice }, audit.card, choice)} />}
    {offMap === null ? null : <OffMapPetitionModal view={offMap} onLater={() => sendUi({ type: "pop_modal" })}
      onAnswer={grant => answered("estate_petition_offmap", { type: "answer_estate_petition", petitionId: offMap.petitionId, grant }, offMap.card, grant ? "grant" : "refuse")} />}
    {receipt === null ? null : <AnswerReceipt view={receipt} onClose={() => { closeReceipt(); sendUi({ type: "pop_modal" }); }} />}
    {yearView === null ? null : <YearReviewCard view={yearView} onContinue={() => sendUi({ type: "pop_modal" })}
      onChronicle={() => { focusChronicleYears(yearView.year, yearView.year); sendUi({ type: "push_modal", modal: "history" }); }} />}
    {sliceStart === null ? null : <SliceStartPage view={sliceStart} onBegin={() => sendUi({ type: "pop_modal" })} />}
    {sliceEnd === null ? null : <SliceEndPage state={state} view={sliceEnd} onContinue={() => sendUi({ type: "pop_modal" })}
      onChronicle={() => { focusChronicleYears(sliceEnd.fromYear, sliceEnd.toYear); sendUi({ type: "push_modal", modal: "history" }); }}
      onRecord={(recordId, tick) => { focusChronicleRecord(recordId, tick); sendUi({ type: "push_modal", modal: "history" }); }}
      onYearCard={() => sendUi({ type: "push_modal", modal: "year_review" })} onSeasonCard={() => sendUi({ type: "push_modal", modal: "season_ledger" })} />}
    {house === null ? null : <HouseChangeCard view={house} onContinue={() => sendUi({ type: "pop_modal" })}
      onNext={next => { sendUi({ type: "pop_modal" }); if (next.kind === "screen") onOpenLord?.(next.screen, next.focus); else onPerson(next.personId); }} />}
    {chronicle === null ? null : <ChroniclePage view={chronicle} onKeepPlaying={() => sendUi({ type: "pop_modal" })}
      // UI-10 (LG-8): chapter 5's end is the campaign's — its page leads to the legacy verdict, not to a chapter 6.
      {...(chronicle.chapter === CHAPTER_FIVE.chapter ? { nextLabel: LEGACY_SCREEN_COPY.toVerdict } : {})}
      onNextChapter={() => { sendUi({ type: "pop_modal" }); sendUi({ type: "push_modal", modal: chronicle.chapter === CHAPTER_FIVE.chapter ? "legacy_ending" : "chapter_preview" }); }}
      onOpenChronicle={() => sendUi({ type: "push_modal", modal: "history" })} />}
    {legacyView === null ? null : <LegacyEndingScreen state={state} view={legacyView} onKeepPlaying={() => sendUi({ type: "pop_modal" })}
      onBook={() => sendUi({ type: "push_modal", modal: "chronicle_book" })} />}
    {top === "chronicle_book" ? <ChronicleBook state={state} onClose={() => sendUi({ type: "pop_modal" })} /> : null}
    {top === "person_card" && personCard !== null ? <PersonCardModal view={personCard} onClose={() => sendUi({ type: "pop_modal" })}
      onBiography={id => { onChroniclePerson(id); sendUi({ type: "pop_modal" }); sendUi({ type: "push_modal", modal: "history" }); }} /> : null}
    {top === "history" ? <ChronicleScreen state={state} initialPersonId={chroniclePersonId} onClose={() => { onChroniclePerson(null); sendUi({ type: "pop_modal" }); }}
      onBook={() => sendUi({ type: "push_modal", modal: "chronicle_book" })}
      onEnding={endingWritten ? () => sendUi({ type: "push_modal", modal: "legacy_ending" }) : sliceOver ? () => sendUi({ type: "push_modal", modal: "slice_end" }) : null}
      {...(sliceOver && !endingWritten ? { endingLabel: SLICE_COPY.end.reopen } : {})}
      onLookAt={tile => { sendUi({ type: "pop_modal" }); platformServices().input.emit({ kind: "lookAt", tile }); }} /> : null}
    {top === "chapter_preview" ? (() => {
      // UI-8: the preview's chapter is always the one after the latest chapter end.
      // Goals shown are those of the next chapter. A built chapter (2, and 3–4 over their Wave 31 paintings) opens
      // with its title, line and goals; one not built yet shows "coming later" with its number.
      // QA-025: from the chapter's card, the chapter the town is in (after chapter 5's end that is still 5, not "6").
      const nextChapter = chapterGoalsView ? state.politics?.chapter.number ?? 1 : (latestChapterEnd(state)?.chapter ?? 1) + 1;
      return <ChapterTwoPreview onContinue={() => sendUi({ type: "pop_modal" })} chapter={nextChapter} startYear={chapterStartYear(state, nextChapter)}
        goals={chapterGoals(state).filter(goal => goal.chapter === nextChapter).map(goal => CHAPTER_COPY.goals[goal.id] ?? goal.id)}
        closeLabel={chapterGoalsView ? CHAPTER_COPY.goalsClose : null} />;
    })() : null}
    {top === "pause_menu" ? <PauseMenu onResume={() => sendUi({ type: "pop_modal" })}
      settings={<><Button type="button" className="pause-menu-book" onPress={() => sendUi({ type: "push_modal", modal: "chronicle_book" })}
        variant="secondary"><UiIcon sheet="action" cell="log" />{LEGACY_SCREEN_COPY.book.open}</Button>
        {sliceOver ? <Button type="button" className="pause-menu-slice-end" onPress={() => sendUi({ type: "push_modal", modal: "slice_end" })}
          variant="secondary"><UiIcon sheet="action" cell="open" />{SLICE_COPY.end.reopen}</Button> : null}<TutorialToggle enabled={tutorial.enabled} onChange={tutorial.setEnabled} /><AudioControls /><PlacementPaletteToggle />
        <PresentationToggle preference="eventPause" /><PresentationToggle preference="lordAutoPause" /><PresentationToggle preference="weatherFx" /><PresentationToggle preference="rainOverlay" />
        <PresentationToggle preference="developerInfo" /><PresentationToggle preference="qaOverlay" />
        <Button type="button" className="autoplay-toggle season-ledger-auto-setting" aria-pressed={ledgerAuto}
          onPress={() => onLedgerAuto(!ledgerAuto)} variant="toggle">{ledgerAuto ? SEASON_LEDGER_COPY.autoOn : SEASON_LEDGER_COPY.autoOff}</Button></>} /> : null}
  </>;
}
