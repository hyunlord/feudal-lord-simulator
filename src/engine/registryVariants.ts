import { stateCalendar } from './scenarioState';
import { lordEstatePetitions } from './stewardship';
import { HOME_PETITION_VARIANTS, REGISTRY_VARIANT_LINKS } from '../content/registry/registryVariantConfig';
import { V4_COPY } from '../content/registry/v4Copy.generated';
import type { GameState } from './engine.types';
import type { RegistryOccurrence } from './registry.types';
import { evaluate, expressionProblem, holds } from './registryDsl';
import { petitionContext } from './registryPetitionContext';
import { bindEntry, itemIdentity, v4EnabledChoices, v4Entry, type V4Entry } from './registryV4';

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

/** ER-13: title/body only. The stored occurrence keeps its own choices, targets, effects and deadline. */
export function registryVariantFor(state: GameState, occurrence: RegistryOccurrence): RegistryVariantView | null {
  const stored = state.registry?.occurrences.find(item => item.id === occurrence.id);
  if (stored === undefined || stored.source !== 'v4' || stored.status !== 'offered' || state.tick > stored.deadline) return null;
  const link = REGISTRY_VARIANT_LINKS[stored.entryId];
  if (link === undefined) return null;
  const original = v4Entry(stored.entryId);
  const variant = v4Entry(link.variantEntryId);
  const copy = V4_COPY[link.variantEntryId];
  if (original === undefined || variant === undefined || copy === undefined || variant.contentClass !== 'existing_petition_variant' || !withinVariantCalendar(state, variant)
    || variant.conditions === undefined || expressionProblem(variant.conditions) !== null) return null;
  const fixed = stored.bound;
  if (fixed === undefined || Object.keys(original.bindings).some(name => fixed[name] === undefined)) return null;
  const source = bindEntry(state, original, fixed);
  if (source === null || v4EnabledChoices(state, original, source).length < original.minimumEnabledConsequentialChoices) return null;
  const mapped: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(link.bindings).map(([name, origin]) => [name, source[origin]]));
  for (const [name, binding] of Object.entries(variant.bindings)) {
    const item = mapped[name];
    if (item === undefined || binding.where === undefined || expressionProblem(binding.from) !== null || expressionProblem(binding.where) !== null) return null;
    const scope = { state, bound: mapped, vars: { item } };
    const from = evaluate(binding.from, scope);
    if (!Array.isArray(from) || !from.some(candidate => itemIdentity(candidate) === itemIdentity(item)) || !holds(binding.where, scope)) return null;
  }
  const context = petitionContext(state, variant.id, mapped);
  if (context === null || !holds(variant.conditions, { state, bound: { ...mapped, authoredContext: context }, vars: {} })) return null;
  return { occurrenceId: stored.id, sourceEntryId: stored.entryId, variantEntryId: variant.id, title: copy.title, body: copy.body };
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
