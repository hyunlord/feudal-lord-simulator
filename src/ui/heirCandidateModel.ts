import type { PetitionResponse } from "../content/chapterConfig";
import type { GameState } from "../engine/engine.types";
import { heirCandidates, heirRelationWord } from "../engine/legacy";
import { lordHouse } from "../engine/lordshipState";
import { currentYear, manorLord, personById, personDisplayName } from "../engine/persons";
import { PETITION_COPY } from "./petitionCopy.ko";
import { personRow } from "./persons/personModels";
import { PERSON_TRAIT_COPY } from "./persons/personTraitCopy.ko";
import { PERSONS_COPY } from "./persons/personsCopy.ko";

// UI-10 the heir's card (F5-A LG-3, `heirCandidates`): beside each answer the heir it names — the portrait (the pool's,
// as every person on screen), the name, what they are to the old lord and their age, through whom they come, what of the
// old lord they have (the hair, the eyes and the pool face the candidate record gives), and their records (born, left the
// manor, the ledger records they appear in). Pure: the card renders what this returns.

export type HeirCandidateView = Readonly<{
  personId: string; response: PetitionResponse; name: string; portraitId: string; exact: boolean;
  who: string; lineage: string; resemblance: string; records: string;
}>;

/** The candidates as the heir's card shows them, by the answer that names each (only those the engine offered). */
export function heirCandidateViews(state: GameState): ReadonlyMap<PetitionResponse, HeirCandidateView> {
  const year = currentYear(state);
  const lord = manorLord(state.persons?.people ?? [], lordHouse(state).order, year);
  const views = new Map<PetitionResponse, HeirCandidateView>();
  for (const candidate of heirCandidates(state)) {
    const person = personById(state, candidate.personId);
    if (person === undefined) continue;
    const through = candidate.throughId === null ? undefined : personById(state, candidate.throughId);
    const throughName = through === undefined ? "" : personDisplayName(through);
    const copy = PETITION_COPY.heir;
    const lineage = candidate.relation === "son" ? copy.son : candidate.relation === "daughter" ? copy.daughter
      : candidate.relation === "husband" ? copy.husband(throughName)
      : candidate.relation === "nephew" ? copy.nephew(throughName, through?.sex === "female") : copy.kinsman;
    const alike = lord === undefined || lord.id === person.id ? [] : [
      ...(candidate.portraitIdentity === lord.portraitIdentity ? [copy.face] : []),
      ...(candidate.hair === lord.traits.hair ? [PERSON_TRAIT_COPY.trait("hair", candidate.hair)] : []),
      ...(candidate.eye === lord.traits.eye ? [PERSON_TRAIT_COPY.trait("eye", candidate.eye)] : []),
    ];
    const row = personRow(state, person);
    views.set(candidate.response, {
      personId: person.id, response: candidate.response, name: candidate.name, portraitId: row.portraitId, exact: row.exact,
      who: copy.who(heirRelationWord(candidate), PERSONS_COPY.age(candidate.age)), lineage, resemblance: copy.resemblance(alike),
      records: copy.records(candidate.birthYear, person.leftYear ?? null, candidate.records, candidate.created),
    });
  }
  return views;
}
