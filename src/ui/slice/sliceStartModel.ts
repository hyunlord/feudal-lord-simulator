import { FACTION_KIND_NAMES, factionDisplayName } from "../../content/factionCopy.ko";
import type { GameState } from "../../engine/engine.types";
import type { EmblemSpec } from "../heraldry/EmblemImage";
import { lordSlice, lordSliceEndTick, lordSliceStart } from "../../engine/lordSlice";
import { lordHouse } from "../../engine/lordshipState";
import { relationBand } from "../chronicle/factionTabModel";
import { yearOfTick } from "../chronicle/chronicleScreenModel";
import { estateCards, houseNameKo } from "../lord/estates/estatesModel";
import { moneyFull } from "../money.ko";
import { perState } from "../perState";
import { lordHouseArms } from "../persons/personModels";
import { SLICE_COPY } from "./sliceCopy.ko";

// LM-R3 phase 2a: the lord slice's opening page — from `lordSliceStart(state)` only (docs/design/lord-slice.md LS-1):
// who you are (the house chosen on the welcome, its arms, the home estate and its year's worth), the town as it stands,
// the three neighbour estates and the five factions the slice introduces, and what the slice is (its years, the second
// estate's end, the goal's years). The estates' names and worth are the estates screen's (the engine's portfolio: the
// home estate's worth is its pieces' year, which `lordSliceStart`'s raw estate holds as 0). Once per state.

export type SliceStartView = Readonly<{
  title: string;
  house: string;
  arms: EmblemSpec;
  armsLabel: string;
  home: string;
  town: string;
  neighbours: readonly Readonly<{ id: string; line: string; notes: readonly string[] }>[];
  factions: readonly Readonly<{ id: string; line: string }>[];
  slice: readonly string[];
}>;

export const sliceStartView = perState((state: GameState): SliceStartView | null => {
  if (!lordSlice(state)) return null;
  const copy = SLICE_COPY.start;
  const start = lordSliceStart(state);
  const house = houseNameKo(lordHouse(state).name);
  const cards = new Map(estateCards(state).map(card => [card.estateId, card] as const));
  const home = cards.get(start.home.estateId);
  const factionName = (id: string) => {
    const faction = state.factions?.factions.find(entry => entry.id === id);
    return faction === undefined ? id : factionDisplayName(faction.id, faction.name);
  };
  const neighbours = start.neighbours.map(neighbour => {
    const card = cards.get(neighbour.estateId);
    const notes = [
      neighbour.debt > 0 ? copy.neighbourDebt(moneyFull(neighbour.debt)) : null,
      neighbour.lordAge === null ? null : copy.neighbourLord(neighbour.lordAge),
      neighbour.daughtersOnly ? copy.daughtersOnly : null,
      neighbour.factionId === null ? null : copy.asFaction,
    ].filter((note): note is string => note !== null);
    return { id: neighbour.estateId, line: copy.neighbour(card?.name ?? neighbour.name, card?.manorsLine ?? "", card?.annualValueLine ?? moneyFull(neighbour.annualValue)), notes };
  });
  const factions = start.factions.map(faction => {
    const name = factionName(faction.id);
    const kind = FACTION_KIND_NAMES[faction.kind] ?? faction.kind;
    return { id: faction.id, line: copy.faction(name, kind === name ? null : kind, relationBand(faction.relation)) };
  });
  const endYear = yearOfTick(state, lordSliceEndTick(state));
  return {
    title: copy.title(house), house: copy.house(house), arms: lordHouseArms(state), armsLabel: copy.armsLabel(house),
    home: copy.home(home?.name ?? start.home.name, home?.annualValueLine ?? moneyFull(start.home.annualValue)),
    town: copy.townLine(start.town.population, start.town.houses, moneyFull(start.town.treasury)),
    neighbours, factions,
    slice: [copy.years(start.end.years, start.startYear, endYear), copy.second(start.end.afterSecondEstateYears), copy.goal(start.goalYears.min, start.goalYears.max)],
  };
});
