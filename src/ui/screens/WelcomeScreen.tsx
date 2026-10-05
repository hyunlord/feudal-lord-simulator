import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { CORE_SCENARIOS, DEFAULT_SCENARIO_ID, LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../../content/scenario/coreScenarios";
import { SCENARIO_COPY } from "../../content/scenario/scenarioCopy.ko";
import { KO_UI } from "../../content/locale.ko";
import { SAVE_COPY } from "../../content/saveCopy.ko";
import { platformServices } from "../../platform/platform";
import { Button } from "../kit";
import { TITLE_COPY } from "../titleCopy.ko";
import { TutorialToggle } from "../tutorial/TutorialShell";
import { TUTORIAL_COPY } from "../tutorial/tutorialCopy.ko";
import { initialLandChoice, landPlayable, type LandChoice } from "../landChoice";
import { LandPicker } from "./LandPicker";
import { wave8ImageStyle, wave8Url } from "../wave8Art";

// CODE-1c (from App): the title screen — the welcome parchment, the saved city on offer, the mode choice.
// LAND-UI (LU-D7): the land choice above the mode buttons; every start (a mode button, or a click anywhere) takes it.
// NAT-4: it opens on a random map number (landChoice initialLandChoice); while the number cannot start a game neither
// the mode buttons nor a click anywhere start one (the picker says why).
const WELCOME_DISMISSED_KEY = "feudal-lord-simulator:welcome-dismissed:v1";

export function WelcomeParchment({ onDismiss, continueLine, archiveNotice, onContinue, onNewGame, onChooseMode, tutorialEnabled, onTutorialChange, initialLand }: {
  readonly tutorialEnabled: boolean;
  readonly onTutorialChange: (enabled: boolean) => void;
  readonly onDismiss: (land: LandChoice) => void;
  readonly continueLine: string | null;
  readonly archiveNotice: string | null;
  readonly onContinue: () => void;
  readonly onNewGame: (scenarioId: string, land: LandChoice) => void;
  readonly onChooseMode: (scenarioId: string, land: LandChoice) => void;
  /** The first land choice (tests); else the page's (initialLandChoice). */
  readonly initialLand?: LandChoice | undefined;
}) {
  const [confirmingNewGame, setConfirmingNewGame] = useState(false);
  const [land, setLand] = useState(() => initialLand ?? initialLandChoice(typeof window === "undefined" ? "" : window.location.search));
  const playable = landPlayable(land);
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
    if (continueLine === null && playable && scriptedRun()) onDismiss(land);
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
        className={continueLine === null || confirmingNewGame ? "welcome-parchment welcome-parchment--lands" : "welcome-parchment"}
        data-frame="modal"
        role="dialog"
        aria-modal="true"
        aria-label={KO_UI.openingGuidance}
        tabIndex={-1}
      >
        <h2>{TITLE_COPY.heading}</h2>
        <p>{TITLE_COPY.howTo}</p>
        <p>{TITLE_COPY.camera}</p>
        <TutorialToggle enabled={tutorialEnabled} onChange={onTutorialChange} />
        {continueLine === null ? <>
          <LandPicker choice={land} onChange={setLand} />
          <ScenarioModeButtons playable={playable} onChoose={scenarioId => onChooseMode(scenarioId, land)} />
        </> : (
          <div className="welcome-save" role="group" aria-label={SAVE_COPY.welcomeSaveLabel}>
            <p>{continueLine}</p>
            <Button className="autoplay-toggle save-control-button" type="button" isolate onPress={() => onContinue()} variant="primary">
              {SAVE_COPY.continueGame}
            </Button>
            {confirmingNewGame ? <>
              <p role="status">{archiveNotice}</p>
              <LandPicker choice={land} onChange={setLand} />
              <ScenarioModeButtons playable={playable} onChoose={scenarioId => onNewGame(scenarioId, land)} />
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
      </section>
    </div>
  );
}

/** The start screen's modes (LR1-D7, foundation §4): lord mode first — the default, the one primary button with "처음이라면
 * 이 모드로" — then the core scenarios in registration order. */
const START_MODES: readonly string[] = [LORD_SLICE_SCENARIO_ID, ...CORE_SCENARIOS.map(scenario => scenario.id)];
const MODE_KEY: Readonly<Record<string, "campaign_market_town" | "sandbox" | "lord_slice">> =
  { [DEFAULT_SCENARIO_ID]: "campaign_market_town", [SANDBOX_SCENARIO_ID]: "sandbox", [LORD_SLICE_SCENARIO_ID]: "lord_slice" };

/** New-game mode choice (B2): one button per mode; off while the land cannot start. */
function ScenarioModeButtons({ onChoose, playable }: {
  readonly onChoose: (scenarioId: string) => void;
  readonly playable: boolean;
}) {
  return <div className="welcome-modes" role="group" aria-label={SCENARIO_COPY.modePrompt}>
    {START_MODES.map(id => {
      const key = MODE_KEY[id] ?? "sandbox";
      const first = id === LORD_SLICE_SCENARIO_ID;
      return <div key={id} data-mode-first={first ? "true" : undefined}>
        {first ? <p className="welcome-mode-first">{TUTORIAL_COPY.modeFirst}</p> : null}
        <Button className="autoplay-toggle save-control-button" type="button"
          data-scenario={id} aria-disabled={playable ? undefined : true} isolate onPress={() => { if (playable) onChoose(id); }} variant={first ? "primary" : "secondary"}>
          {SCENARIO_COPY.modeButtons[key]}
        </Button>
        <p className="welcome-mode-line">{TUTORIAL_COPY.modeLines[key]}</p>
      </div>;
    })}
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
