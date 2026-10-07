import type { BuildingKind } from "../../../content/buildingConfig";
import type { GameState } from "../../../engine/engine.types";
import { lordMode } from "../../../engine/townAgency";
import type { StoryBeat, StoryKind } from "../../eventStory";
import { lordAdvice, whoBuilds, type TownNeed } from "./lordAdvice";
import { LORD_ADVICE_COPY as COPY } from "./lordAdviceCopy.ko";

// DEC-CARD A1: the event card's [조언] and the steward's forecast line in lord mode. The sandbox's advice tells the
// player to place wells, fill granaries, widen fields and roads; in lord mode the same need is said as who builds it,
// what the town is doing about it and the lord's lever (lordAdvice). Beats whose advice asks nothing of the builder
// (a petition, the charter, the first winter's warning) keep theirs. Called on the beats of every sampled state, so it
// reads only cheap heads (the agency's kept walk and receipts, the policy weights) — no dry run.

const building = (kind: BuildingKind): TownNeed => ({ kind: "building", building: kind });

/** The need behind a beat whose sandbox advice is to build, by its kind. */
const NEED: Partial<Record<StoryKind, TownNeed>> = {
  fire: building("well"), fire_warning: building("well"), wet_summer: { kind: "arable" }, bad_harvest: building("granary"),
  famine_omen: building("granary"), palisade: { kind: "road" },
};

function adviceFor(state: GameState, need: TownNeed): string {
  const who = need.kind === "building" ? [whoBuilds(need.building)] : [];
  return COPY.join([...who, ...lordAdvice(state, need)]);
}

function beatAdvice(state: GameState, kind: StoryKind): string | null {
  if (kind === "fire_aftermath") return COPY.fireAftermath;
  const need = NEED[kind];
  return need === undefined ? null : adviceFor(state, need);
}

/** The beats with lord mode's [조언] (the same beats outside lord mode). */
export function withLordAdvice(state: GameState, beats: StoryBeat[]): StoryBeat[] {
  if (!lordMode(state)) return beats;
  return beats.map(beat => {
    const advice = beatAdvice(state, beat.kind);
    return advice === null ? beat : { ...beat, advice };
  });
}

/** The steward's line on a forecast's sign in lord mode (a rumour asks nothing yet: null keeps the sandbox's line). */
export function lordForecastLine(state: GameState, kind: "fire" | "dearth" | "famine", sign: boolean): string | null {
  if (!lordMode(state) || !sign) return null;
  return COPY.join([COPY.forecast[kind], adviceFor(state, kind === "fire" ? building("well") : building("granary"))]);
}
