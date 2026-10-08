import { HOME_ESTATE_ID } from "../../../content/estateConfig";
import { FACTION_KIND_NAMES, FACTION_SHORT_NAMES, factionDisplayName } from "../../../content/factionCopy.ko";
import { HOME_PETITION_KINDS, PETITION_KINDS } from "../../../content/stewardshipConfig";
import type { GameState } from "../../../engine/engine.types";
import { faction } from "../../../engine/factions";
import type { EstatePetitionKind, HomePetitionKind } from "../../../engine/stewardship.types";
import { HOME_PETITION_COPY } from "../../lordCardsCopy.ko";
import { ESTATES_COPY } from "../estates/estatesCopy.ko";
import { STEWARD_COPY as COPY } from "./stewardCopy.ko";

// DEC-CARD-2: the words the steward's report and the standing-policy screen share — a kind of small matter (a home
// petition's kind, an off-map estate's, an event sender `sender:<faction>`), a faction (its game name), a setting.

export const SENDER_PREFIX = "sender:";
export const isHomeKind = (kind: string): kind is HomePetitionKind => Object.hasOwn(HOME_PETITION_KINDS, kind);
export const isEstateKind = (kind: string): kind is EstatePetitionKind => Object.hasOwn(PETITION_KINDS, kind);

/** A faction by id as the town names it (factionDisplayName); `party` is a home dispute's other side, unnamed in the table. */
export function factionWord(state: GameState, id: string): string {
  if (id === "party") return COPY.party;
  const view = faction(state, id as Parameters<typeof faction>[1]);
  return view === undefined ? FACTION_SHORT_NAMES[id] ?? FACTION_KIND_NAMES[id] ?? id : factionDisplayName(view.id, view.name);
}

/** A kind's name: the home petition's card title, the off-map petition's kind, the sender's matters. */
export function kindTitle(state: GameState, kind: string): string {
  if (isHomeKind(kind)) return HOME_PETITION_COPY[kind].title;
  if (kind.startsWith(SENDER_PREFIX)) return COPY.sender(factionWord(state, kind.slice(SENDER_PREFIX.length)));
  return isEstateKind(kind) ? ESTATES_COPY.petitionKinds[kind] : kind;
}

/** A setting's name (the report also meets `precedent`: a home petition answered before save v52). */
export const settingWord = (policy: string): string => policy === "precedent" ? COPY.precedent
  : Object.hasOwn(COPY.settings, policy) ? COPY.settings[policy as keyof typeof COPY.settings] : policy;

/** The kind's standing-policy family (the policy screen's group). */
export const kindFamily = (kind: string): "manor" | "estate" | "event" =>
  isHomeKind(kind) ? "manor" : kind.startsWith(SENDER_PREFIX) ? "event" : "estate";

export const isHomeEstate = (estateId: string): boolean => estateId === HOME_ESTATE_ID;
