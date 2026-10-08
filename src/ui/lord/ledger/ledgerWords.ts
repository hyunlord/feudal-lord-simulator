import { factionDisplayName } from "../../../content/factionCopy.ko";
import { GENTRY_NAMES_KO } from "../../../content/gentryNames";
import { SCENARIO_COPY } from "../../../content/scenario/scenarioCopy.ko";
import type { GameState } from "../../../engine/engine.types";
import { estatePerson, estatesOf } from "../../../engine/estates";
import type { Estate } from "../../../engine/estates.types";
import { faction } from "../../../engine/factions";
import { calendar, scenarioOf } from "../../../engine/scenarioState";
import { gameReducer } from "../../../state/gameStore";
import type { GameAction } from "../../../state/gameStore.types";
import { lordPersonRow } from "../screen/lordPortrait";
import { LORD_LEDGER_COPY as COPY } from "./ledgerCopy.ko";

// LM-R2 (ledger area) the words the ledger's rows share — dates, holders, what a claim or suit is on — and the trial a
// shut button reads (`would`). SUIT-THREAD moved them here from ledgerModel.ts so the suit rows (suitsModel.ts) and the
// defence rows (suitDefenceModel.ts) read the same words.

/** Whether the game would take this command now: the reducer's answer on the current state (a refusal is the same object). */
export const would = (state: GameState, action: GameAction): boolean => gameReducer(state, action) !== state;

export type Shut = Readonly<{ enabled: boolean; reason: string | null }>;
/** Open, or shut with a sentence (`reason`; the neutral line when the engine gives none). */
export const shut = (enabled: boolean, reason: string = COPY.keepShut): Shut => ({ enabled, reason: enabled ? null : reason });

export function dateLabel(state: GameState, tick: number): string {
  const date = calendar(tick, scenarioOf(state).startYear);
  return COPY.date(date.year, SCENARIO_COPY.seasons[date.season], date.dayOfYear - date.season * 90);
}

/** A neighbour's name in Korean (the engine keeps the Latin one): "de Heronel" → "드 헤로넬". */
const houseWord = (name: string): string => GENTRY_NAMES_KO[name] ?? name;

function estateWord(estate: Estate | undefined, estateId: string): string {
  if (estate === undefined) return estateId;
  return estate.offMap ? COPY.estateName(houseWord(estate.name)) : COPY.homeEstate;
}

/** A holder's name (ES-1 HolderId): the lord, a faction, a person, a neighbour estate's house. */
export function holderName(state: GameState, holder: string): string {
  if (holder.startsWith("person:")) {
    const person = estatePerson(state, holder.slice("person:".length));
    return person === undefined ? COPY.oldKin : lordPersonRow(state, person).name;
  }
  if (holder.startsWith("estate:")) {
    const estate = estatesOf(state).estates.find(entry => entry.id === holder.slice("estate:".length));
    return COPY.houseOf(houseWord(estate?.house?.name ?? estate?.name ?? holder));
  }
  const known = COPY.holders[holder];
  if (known !== undefined) return known;
  const view = faction(state, holder as Parameters<typeof faction>[1]);
  return view === undefined ? holder : factionDisplayName(view.id, view.name);
}

/** What a claim, suit or forewarned entry is on: the estate, and the piece when it is one. */
export function onWhat(state: GameState, estateId: string, pieceId: string | undefined): string {
  const estate = estatesOf(state).estates.find(entry => entry.id === estateId);
  const piece = pieceId === undefined ? undefined : estate?.pieces.find(entry => entry.id === pieceId);
  const pieceWord = pieceId === undefined ? COPY.wholeEstate : piece === undefined ? pieceId : COPY.pieces[piece.kind];
  return COPY.estatePiece(estateWord(estate, estateId), pieceWord);
}
