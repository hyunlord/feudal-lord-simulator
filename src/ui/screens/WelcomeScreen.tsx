import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { DEFAULT_SCENARIO_ID, LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../../content/scenario/coreScenarios";
import { SCENARIO_COPY } from "../../content/scenario/scenarioCopy.ko";
import { KO_UI } from "../../content/locale.ko";
import { SAVE_COPY } from "../../content/saveCopy.ko";
import { platformServices } from "../../platform/platform";
import { GameLogo } from "../brand/GameLogo";
import { Button } from "../kit";
import { TITLE_COPY } from "../titleCopy.ko";
import { TutorialToggle } from "../tutorial/TutorialShell";
import { TUTORIAL_COPY } from "../tutorial/tutorialCopy.ko";
import { DEFAULT_HOUSE_CHOICE, type HouseChoice } from "../houseChoice";
import { initialLandChoice, landPlayable, type LandChoice } from "../landChoice";
import { HouseChoicePanel } from "./HouseChoice";
import { LandPicker } from "./LandPicker";
import { wave8ImageStyle, wave8Url } from "../wave8Art";

// CODE-1c (from App): the title screen — the welcome parchment, the saved city on offer, the mode choice.
// LAND-UI (LU-D7): the land choice above the mode buttons; every start (a mode button, or a click anywhere) takes it.
// NAT-4: it opens on a random map number (landChoice initialLandChoice); while the number cannot start a game neither
// the mode buttons nor a click anywhere start one (the picker says why).
// LM-R3: the game's logo heads it; a mode button opens the house choice (HouseChoicePanel, every mode: MNR-3), whose
// start begins the game with the chosen house (de Haverel by default).
const WELCOME_DISMISSED_KEY = "feudal-lord-simulator:welcome-dismissed:v1";

export function WelcomeParchment({ onDismiss, continueLine, archiveNotice, onContinue, onNewGame, onChooseMode, tutorialEnabled, onTutorialChange, initialLand }: {
  readonly tutorialEnabled: boolean;
  readonly onTutorialChange: (enabled: boolean) => void;
  readonly onDismiss: (land: LandChoice) => void;
  readonly continueLine: string | null;
  readonly archiveNotice: string | null;
  readonly onContinue: () => void;
  readonly onNewGame: (scenarioId: string, land: LandChoice, house: HouseChoice) => void;
  readonly onChooseMode: (scenarioId: string, land: LandChoice, house: HouseChoice) => void;
  /** The first land choice (tests); else the page's (initialLandChoice). */
  readonly initialLand?: LandChoice | undefined;
}) {
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);
  const [land, setLand] = useState(() => initialLand ?? initialLandChoice(typeof window === "undefined" ? "" : window.location.search));
  const playable = landPlayable(land);
  // LM-R3: the mode whose house is being chosen (and whether over a save), the house, the sandbox's goal option.
  const [choosingHouse, setChoosingHouse] = useState<{ readonly scenarioId: string; readonly overSave: boolean } | null>(null);
  const [house, setHouse] = useState<HouseChoice>(DEFAULT_HOUSE_CHOICE);
  const [withGoal, setWithGoal] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const consumeDismissal = (event: MouseEvent | PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // LR1-D7 (user 2026-10-05): a player starts by a mode button only. A scripted run (the proof query, or a pinned map
    // number) still closes the welcome by a click on the layer, keeping its injected scene. With a saved city on offer
    // the choice is always explicit.
    if (continueLine === null && choosingHouse === null && playable && scriptedRun()) onDismiss(land);
  };
  const containKeyboard = (event: ReactKeyboardEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className="welcome-dismiss-layer title-screen"
      data-screen={confirmingNewGame ? "mode" : "title"}
      style={{ backgroundImage: `url("${wave8Url(confirmingNewGame ? "keyart_mode_select" : "keyart_title_bg")}")` }}
      onPointerDown={consumeDismissal}
      onClick={consumeDismissal}
      onKeyDown={containKeyboard}
    >
      {/* UI-3: the title keyart behind the welcome, the emblem above it; choosing a new game over a save shows the mode backdrop. */}
      <span className="title-emblem" aria-hidden="true" style={wave8ImageStyle("keyart_title_emblem", 176)} />
      <section
        ref={dialogRef}
        className={choosingHouse !== null ? "welcome-parchment welcome-parchment--lands welcome-parchment--house"
          : continueLine === null || confirmingNewGame ? "welcome-parchment welcome-parchment--lands" : "welcome-parchment"}
        data-frame="modal"
        role="dialog"
        aria-modal="true"
        aria-label={KO_UI.openingGuidance}
        tabIndex={-1}
      >
        {choosingHouse !== null ? <HouseChoicePanel house={house} onHouse={setHouse} onBack={() => setChoosingHouse(null)}
          onStart={() => (choosingHouse.overSave ? onNewGame : onChooseMode)(choosingHouse.scenarioId, land, house)} /> : <>
          <h2 className="welcome-logo"><GameLogo language="ko" layout="horizontal" tone="on-light" width={LOGO_WIDTH} /></h2>
          <p>{TITLE_COPY.howTo}</p>
          <p>{TITLE_COPY.camera}</p>
          <TutorialToggle enabled={tutorialEnabled} onChange={onTutorialChange} />
          {continueLine === null ? <>
            <LandPicker choice={land} onChange={setLand} />
            <ScenarioModeButtons playable={playable} withGoal={withGoal} onGoalChange={setWithGoal}
              onChoose={scenarioId => setChoosingHouse({ scenarioId, overSave: false })} />
          </> : (
            <div className="welcome-save" role="group" aria-label={SAVE_COPY.welcomeSaveLabel}>
              <p>{continueLine}</p>
              <Button className="autoplay-toggle save-control-button" type="button" isolate onPress={() => onContinue()} variant={confirmingNewGame ? "secondary" : "primary"}>
                {SAVE_COPY.continueGame}
              </Button>
              {confirmingNewGame ? <>
                <p role="status">{archiveNotice}</p>
                <LandPicker choice={land} onChange={setLand} />
                <ScenarioModeButtons playable={playable} withGoal={withGoal} onGoalChange={setWithGoal}
                  onChoose={scenarioId => setChoosingHouse({ scenarioId, overSave: true })} />
                <Button className="autoplay-toggle save-control-button" type="button" isolate onPress={() => setConfirmingNewGame(false)} variant="secondary">
                  {SAVE_COPY.cancel}
                </Button>
              </> : (
                <Button className="autoplay-toggle save-control-button" type="button" isolate onPress={() => setConfirmingNewGame(true)} variant="secondary">
                  {SAVE_COPY.newGame}
                </Button>
              )}
            </div>
          )}
        </>}
      </section>
    </div>
  );
}

/** The logo's width on the welcome (px; the horizontal logo is 1200×280). */
const LOGO_WIDTH = 264;

/**
 * The start screen's modes (LR1-D7, foundation §4; LM-R3, the user 2026-10-08): lord mode first — the one primary,
 * under "처음이라면 이 모드로" — then the sandbox (secondary), whose "목표와 함께" switch starts today's goal campaign
 * (DEFAULT_SCENARIO_ID, its tutorial as before) until the campaign merges with lord mode. The sandbox button carries the
 * scenario it starts. Every press is off while the land cannot start.
 */
function ScenarioModeButtons({ onChoose, playable, withGoal, onGoalChange }: {
  readonly onChoose: (scenarioId: string) => void;
  readonly playable: boolean;
  readonly withGoal: boolean;
  readonly onGoalChange: (withGoal: boolean) => void;
}) {
  const sandbox = withGoal ? DEFAULT_SCENARIO_ID : SANDBOX_SCENARIO_ID;
  const choose = (id: string) => { if (playable) onChoose(id); };
  return <div className="welcome-modes" role="group" aria-label={SCENARIO_COPY.modePrompt}>
    <div data-mode-first="true">
      <p className="welcome-mode-first">{TUTORIAL_COPY.modeFirst}</p>
      <Button className="autoplay-toggle save-control-button" type="button" data-scenario={LORD_SLICE_SCENARIO_ID}
        aria-disabled={playable ? undefined : true} isolate onPress={() => choose(LORD_SLICE_SCENARIO_ID)} variant="primary">
        {SCENARIO_COPY.modeButtons.lord_slice}
      </Button>
      <p className="welcome-mode-line">{TUTORIAL_COPY.modeLines.lord_slice}</p>
    </div>
    <div data-mode="sandbox">
      <Button className="autoplay-toggle save-control-button" type="button" data-scenario={sandbox}
        aria-disabled={playable ? undefined : true} isolate onPress={() => choose(sandbox)} variant="secondary">
        {SCENARIO_COPY.modeButtons.sandbox}
      </Button>
      <p className="welcome-mode-line">{withGoal ? TUTORIAL_COPY.modeLines.campaign_market_town : TUTORIAL_COPY.modeLines.sandbox}</p>
      <Button type="button" role="switch" aria-checked={withGoal} className="tutorial-switch welcome-goal-switch" data-sandbox-goal isolate
        onPress={() => onGoalChange(!withGoal)} variant="toggle">
        {TITLE_COPY.sandboxGoal} {withGoal ? TUTORIAL_COPY.tutorialOn : TUTORIAL_COPY.tutorialOff}
      </Button>
    </div>
  </div>;
}

/** A scripted run: the proof query or a pinned new-game number (scripts and replays; a player never passes either). */
function scriptedRun(): boolean {
  if (typeof window === "undefined") return false;
  const query = new URLSearchParams(window.location.search);
  return query.get("phase10-proof") === "1" || query.has("new-game-seed");
}

export function readWelcomeDismissed(): boolean {
  return platformServices().preferences.get(WELCOME_DISMISSED_KEY) === "1";
}

export function writeWelcomeDismissed(): void {
  platformServices().preferences.set(WELCOME_DISMISSED_KEY, "1");
}
