import { useEffect, useRef } from "react";
import type { GameState } from "../../engine/engine.types";
import { platformServices } from "../../platform/platform";
import { PlacementPaletteToggle } from "../../render/PlacementPaletteToggle";
import { presentedState } from "../../render/presentation/presentedState";
import { PresentationToggle } from "../../render/PresentationToggle";
import { useGameApi, useGameUiSelector } from "../../state/gameStore";
import { AudioControls } from "../AudioControls";
import type { BuildCategory } from "../buildMenuPresentation";
import { ChronicleScreen } from "../chronicle/ChronicleScreen";
import { chronicleView } from "../chronicleModel";
import { famineDecisionView, petitionDecisionView } from "../decisionModels";
import { PauseMenu } from "../hud/HudShell";
import { SeasonLedgerCard } from "../hud/SeasonLedgerCard";
import { ChapterTwoPreview, ChroniclePage, FamineDecisionModal, PetitionModal } from "../hud/StoryModals";
import { Button } from "../kit";
import { personCardView, petitionerRows, type personRow } from "../persons/personModels";
import { PersonCardModal } from "../persons/PersonViews";
import { seasonLedgerCardModel } from "../seasonLedgerCard";
import { SEASON_LEDGER_COPY } from "../seasonLedgerCopy.ko";
import { topModal, type UiEvent, type UiState } from "../stateMachine/uiStateMachine";
import { TutorialToggle } from "../tutorial/TutorialShell";
import type { TutorialController } from "../tutorial/useTutorialController";
import { chapterGoals } from "../../engine/politics";
import { CHAPTER_COPY } from "../chapterCopy.ko";
import { latestChapterEnd } from "../chronicleModel";

/**
 * CODE-1c (from App): the modal screens on top of the town — the season card, the famine decision, a petition, the
 * chapter page, a person card, the chronicle, chapter 2's preview and the pause menu. They read the game themselves on
 * the UI channel, and only while one is up (otherwise this keeps its first state and does not re-render on a tick).
 */
export function AppModals({ ui, sendUi, personCardId, chroniclePersonId, onChroniclePerson, steward, onPerson, ledgerAuto, onLedgerAuto,
  onMenuRequest, tutorial }: {
  readonly ui: UiState;
  readonly sendUi: (event: UiEvent) => void;
  readonly personCardId: string | null;
  readonly chroniclePersonId: string | null;
  readonly onChroniclePerson: (id: string | null) => void;
  readonly steward: ReturnType<typeof personRow> | null;
  readonly onPerson: (id: string) => void;
  readonly ledgerAuto: boolean;
  readonly onLedgerAuto: (next: boolean) => void;
  readonly onMenuRequest: (request: { readonly category: BuildCategory; readonly nonce: number }) => void;
  readonly tutorial: Pick<TutorialController, "enabled" | "setEnabled">;
}) {
  const { dispatch } = useGameApi();
  const top = topModal(ui);
  const idleStateRef = useRef<GameState | null>(null);
  const state = useGameUiSelector(top !== null ? presentedState : (current: GameState) => (idleStateRef.current ??= presentedState(current)));
  const seasonCard = top === "season_ledger" ? seasonLedgerCardModel(state) : null;
  const famineView = top === "decision" ? famineDecisionView(state) : null;
  const petitionView = top === "petition" ? petitionDecisionView(state) : null;
  const chronicle = top === "chronicle" ? chronicleView(state) : null;
  const personCard = top === "person_card" && personCardId !== null ? personCardView(state, personCardId) : null;
  // A decision modal whose question went away (answered elsewhere, or the famine moved on) closes itself.
  const famineGone = famineView === null; const petitionGone = petitionView === null;
  const chronicleGone = chronicle === null; const personCardGone = personCard === null;
  useEffect(() => {
    if ((topModal(ui) === "decision" && famineGone) || (topModal(ui) === "petition" && petitionGone) || (topModal(ui) === "chronicle" && chronicleGone)
      || (topModal(ui) === "person_card" && personCardGone)) sendUi({ type: "pop_modal" });
  }, [ui, famineGone, petitionGone, chronicleGone, personCardGone, sendUi]);
  return <>
    {seasonCard === null ? null : <SeasonLedgerCard model={seasonCard} auto={ledgerAuto}
      onAutoChange={onLedgerAuto}
      onResume={() => sendUi({ type: "pop_modal" })}
      onHint={() => { const hint = seasonCard.hint; sendUi({ type: "pop_modal" }); if (hint !== null) onMenuRequest({ category: hint.category, nonce: Date.now() }); }} />}
    {famineView === null ? null : <FamineDecisionModal view={famineView} onLater={() => sendUi({ type: "pop_modal" })} steward={steward} onPerson={onPerson}
      onChoose={choice => { dispatch({ type: "famine_response", choice }); sendUi({ type: "pop_modal" }); }} />}
    {petitionView === null ? null : <PetitionModal view={petitionView} onLater={() => sendUi({ type: "pop_modal" })} onPerson={onPerson}
      petitioners={petitionerRows(state, state.politics?.petitions.find(petition => petition.id === petitionView.petitionId) ?? {})}
      onRespond={response => { dispatch({ type: "petition_response", petitionId: petitionView.petitionId, response }); sendUi({ type: "pop_modal" }); }} />}
    {chronicle === null ? null : <ChroniclePage view={chronicle} onKeepPlaying={() => sendUi({ type: "pop_modal" })}
      onNextChapter={() => { sendUi({ type: "pop_modal" }); sendUi({ type: "push_modal", modal: "chapter_preview" }); }}
      onOpenChronicle={() => sendUi({ type: "push_modal", modal: "history" })} />}
    {top === "person_card" && personCard !== null ? <PersonCardModal view={personCard} onClose={() => sendUi({ type: "pop_modal" })}
      onBiography={id => { onChroniclePerson(id); sendUi({ type: "pop_modal" }); sendUi({ type: "push_modal", modal: "history" }); }} /> : null}
    {top === "history" ? <ChronicleScreen state={state} initialPersonId={chroniclePersonId} onClose={() => { onChroniclePerson(null); sendUi({ type: "pop_modal" }); }}
      onLookAt={tile => { sendUi({ type: "pop_modal" }); platformServices().input.emit({ kind: "lookAt", tile }); }} /> : null}
    {top === "chapter_preview" ? (() => {
      // UI-8: the preview's chapter is always the one after the latest chapter end.
      // Goals shown are those of the next chapter. A built chapter (2, and 3–4 over their Wave 31 paintings) opens
      // with its title, line and goals; one not built yet shows "coming later" with its number.
      const nextChapter = (latestChapterEnd(state)?.chapter ?? 1) + 1;
      return <ChapterTwoPreview onContinue={() => sendUi({ type: "pop_modal" })} chapter={nextChapter}
        goals={chapterGoals(state).filter(goal => goal.chapter === nextChapter).map(goal => CHAPTER_COPY.goals[goal.id] ?? goal.id)} />;
    })() : null}
    {top === "pause_menu" ? <PauseMenu onResume={() => sendUi({ type: "pop_modal" })}
      settings={<><TutorialToggle enabled={tutorial.enabled} onChange={tutorial.setEnabled} /><AudioControls /><PlacementPaletteToggle />
        <PresentationToggle preference="eventPause" /><PresentationToggle preference="weatherFx" /><PresentationToggle preference="rainOverlay" />
        <PresentationToggle preference="developerInfo" />
        <Button type="button" className="autoplay-toggle season-ledger-auto-setting" aria-pressed={ledgerAuto}
          onPress={() => onLedgerAuto(!ledgerAuto)} variant="toggle">{ledgerAuto ? SEASON_LEDGER_COPY.autoOn : SEASON_LEDGER_COPY.autoOff}</Button></>} /> : null}
  </>;
}
