import { stateCalendar } from './scenarioState';
import { lordEstatePetitions } from './stewardship';
import { HOME_PETITION_VARIANTS } from '../content/registry/registryVariantConfig';
import { V4_COPY } from '../content/registry/v4Copy.generated';
import type { GameState } from './engine.types';
import { petitionContext } from './registryPetitionContext';
import { bindEntry, v4EnabledChoices, v4Entry, type V4Entry } from './registryV4';

export type RegistryVariantView = {
  readonly occurrenceId: string;
  readonly sourceEntryId: string;
  readonly variantEntryId: string;
  readonly title: string;
  readonly body: string;
};

function withinVariantCalendar(state: GameState, entry: V4Entry): boolean {
  const current = stateCalendar(state);
  const calendar = entry.calendar;
  return current.year >= calendar.yearMinInclusive && current.year <= calendar.yearMaxInclusive
    && calendar.seasonIndices.includes(current.season);
}

/** A title/body variant of an existing home petition; its ID and answer handler remain unchanged. */
export function estatePetitionVariantFor(state: GameState, petitionId: string): RegistryVariantView | null {
  const petition = lordEstatePetitions(state).find(item => item.id === petitionId && item.estateId === 'estate-home' && HOME_PETITION_VARIANTS[item.kind] !== undefined);
  const variantId = petition === undefined ? undefined : HOME_PETITION_VARIANTS[petition.kind];
  const entry = variantId === undefined ? undefined : v4Entry(variantId);
  const copy = variantId === undefined ? undefined : V4_COPY[variantId];
  if (petition === undefined || entry === undefined || copy === undefined || entry.contentClass !== 'existing_petition_variant'
    || !withinVariantCalendar(state, entry)) return null;
  const context = petitionContext(state, entry.id, { estatePetition: petition });
  if (context === null) return null;
  const bound = bindEntry(state, entry, { estatePetition: petition.id, authoredContext: JSON.stringify(context) });
  if (bound === null || v4EnabledChoices(state, entry, bound).length < entry.minimumEnabledConsequentialChoices) return null;
  return { occurrenceId: petition.id, sourceEntryId: `home:${petition.kind}`, variantEntryId: entry.id, title: copy.title, body: copy.body };
}
