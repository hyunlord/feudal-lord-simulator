import type { StandingSetting } from "../../../content/stewardPolicyConfig";
import { standingPolicies, standingSettings, type SettingAnswer, type StandingPolicyView } from "../../../engine/decisionReads";
import type { GameState } from "../../../engine/engine.types";
import { calendarLabel } from "../../../engine/scenarioState";
import { stewardshipOf } from "../../../engine/stewardship";
import { lordMode } from "../../../engine/townAgency";
import type { GameAction } from "../../../state/gameStore.types";
import { HOME_PETITION_COPY } from "../../lordCardsCopy.ko";
import { parties } from "../../lordCardsModel";
import { perState } from "../../perState";
import { STEWARD_COPY as COPY } from "./stewardCopy.ko";
import { factionWord, isHomeKind, kindTitle, SENDER_PREFIX, settingWord } from "./stewardWords";

// DEC-CARD-2 (the user's order 2026-10-08): the lord screen's standing policies — per kind of small matter (the home
// estate's twelve petitions, the off-map estates' six, the events by their sender), its setting and what each of the
// four would do, from the engine's `standingPolicies` (`answers`: granted, the treasury's sign, the factions' signs — no
// number is shown that the engine does not give as a sign), how many the steward handled this year and the last one.
// A setting is the engine's command `set_standing_policy`. The old switch `rules.recurring` ("모든 장원 청원을 영주에게")
// lives here now: it brings every home petition to the lord whatever the settings (stewardship.ts homePetitionSeason).

export type PolicyOption = Readonly<{ setting: StandingSetting; label: string; current: boolean; does: readonly string[]; command: GameAction }>;
export type PolicyKindRow = Readonly<{
  kind: string; title: string; family: StandingPolicyView["family"]; current: string; row: string;
  options: readonly PolicyOption[]; handled: string; last: string | null;
}>;
export type PolicyFamily = Readonly<{ family: StandingPolicyView["family"]; heading: string; line: string; kinds: readonly PolicyKindRow[] }>;
export type StandingPolicyScreen = Readonly<{ families: readonly PolicyFamily[]; allToLord: boolean; allToLordCommand: GameAction }>;

const FAMILIES: readonly StandingPolicyView["family"][] = ["manor", "estate", "event"];

/** The factions' moves as signs (the engine's numbers stay in its tables: the screen says which way, DTR-16 aside). */
const factionSigns = (state: GameState, factions: SettingAnswer["factions"]): string[] =>
  Object.entries(factions).filter(([, delta]) => delta !== 0).map(([id, delta]) => delta > 0 ? COPY.rises(factionWord(state, id)) : COPY.falls(factionWord(state, id)));

const treasuryWord = (sign: SettingAnswer["treasury"]): string[] =>
  sign === null ? [] : [sign > 0 ? COPY.treasuryIn : sign < 0 ? COPY.treasuryOut : COPY.treasuryNone];

/** What one setting does for one kind, in the steward's words. */
function does(state: GameState, view: StandingPolicyView, setting: StandingSetting): readonly string[] {
  if (setting === "lord") return [COPY.toLord];
  const answer = view.answers[setting];
  const sender = view.kind.startsWith(SENDER_PREFIX) ? factionWord(state, view.kind.slice(SENDER_PREFIX.length)) : null;
  let first: string;
  if (sender !== null) first = setting === "customary" ? COPY.eventCustom : setting === "lenient" ? COPY.eventLenient(sender) : COPY.eventStrict;
  else if (answer.granted === null) first = COPY.estateCustom;
  else if (isHomeKind(view.kind)) {
    // The answer as the home card words it; the dispute's other side unnamed (it is drawn per petition).
    const named = parties(state, {});
    first = COPY.answerLine(answer.granted ? HOME_PETITION_COPY[view.kind].grant(named) : HOME_PETITION_COPY[view.kind].refuse(named));
  } else first = COPY.answerLine(answer.granted ? COPY.grants : COPY.refuses);
  const custom = setting === "customary" && view.family === "manor" ? [COPY.customaryShare] : [];
  return [first, ...treasuryWord(answer.treasury), ...factionSigns(state, answer.factions), ...custom];
}

function kindRow(state: GameState, view: StandingPolicyView): PolicyKindRow {
  const title = kindTitle(state, view.kind);
  const current = settingWord(view.setting);
  return {
    kind: view.kind, title, family: view.family, current, row: COPY.kindRow(current, view.handledThisYear),
    options: standingSettings().map(setting => ({ setting, label: settingWord(setting), current: setting === view.setting, does: does(state, view, setting),
      command: { type: "set_standing_policy", kind: view.kind, setting } as GameAction })),
    handled: view.handledThisYear === 0 ? COPY.noneThisYear : COPY.handledThisYear(view.handledThisYear),
    last: view.last === null ? null : COPY.last(calendarLabel({ ...state, tick: view.last.tick }), view.last.granted === null ? null : view.last.granted ? COPY.granted : COPY.refused),
  };
}

/** The screen (lord mode only, else null). Once per state (perState): the screen reads it on every render. */
export const standingPolicyScreen = perState((state: GameState): StandingPolicyScreen | null => {
  if (!lordMode(state)) return null;
  const views = standingPolicies(state);
  const rules = stewardshipOf(state).rules;
  const allToLord = rules.recurring === true;
  return {
    families: FAMILIES.map(family => ({ family, heading: COPY.families[family], line: COPY.familyLines[family],
      kinds: views.filter(view => view.family === family).map(view => kindRow(state, view)) })).filter(family => family.kinds.length > 0),
    allToLord,
    allToLordCommand: { type: "set_exception_rules", rules: { amountAtLeast: rules.amountAtLeast, rights: rules.rights, marriage: rules.marriage, recurring: !allToLord } },
  };
});
