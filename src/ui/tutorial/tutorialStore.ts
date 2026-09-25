import { platformServices } from "../../platform/platform";
import { TUTORIAL_STEP_IDS, type TutorialStepId } from "./tutorialModel";

// UX-1 tutorial record, kept in the platform preferences (B9 `PlatformServices.preferences`), never in the save: whether
// the tutorial runs, the steps the player acknowledged, the menu targets that already pulsed (a pulse plays once) and
// the completion log the goal drawer lists. A new game started from the welcome writes a fresh record (the welcome's
// toggle, on by default); with no record at all the tutorial runs only on a fresh new game (tick 0, nothing built), so
// injected cities and older saves stay fully open.

export const TUTORIAL_RECORD_KEY = "feudal-lord-simulator:tutorial:v1";

export type TutorialRecord = {
  readonly enabled: boolean;
  readonly acks: readonly TutorialStepId[];
  readonly pulsed: readonly string[];
  readonly log: readonly { readonly id: string; readonly title: string; readonly already: boolean }[];
};

export const EMPTY_TUTORIAL_RECORD: TutorialRecord = { enabled: true, acks: [], pulsed: [], log: [] };

const STEP_IDS: ReadonlySet<string> = new Set(TUTORIAL_STEP_IDS);

export function readTutorialRecord(): TutorialRecord | null {
  const raw = platformServices().preferences.get(TUTORIAL_RECORD_KEY);
  if (raw === null || raw === undefined) return null;
  try {
    const value = JSON.parse(raw) as Partial<TutorialRecord>;
    return {
      enabled: value.enabled !== false,
      acks: (value.acks ?? []).filter((id): id is TutorialStepId => STEP_IDS.has(id)),
      pulsed: (value.pulsed ?? []).filter(item => typeof item === "string"),
      log: (value.log ?? []).filter(item => typeof item?.id === "string" && typeof item.title === "string")
        .map(item => ({ id: item.id, title: item.title, already: item.already === true })),
    };
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return null;
  }
}

export function writeTutorialRecord(record: TutorialRecord): void {
  platformServices().preferences.set(TUTORIAL_RECORD_KEY, JSON.stringify(record));
}
