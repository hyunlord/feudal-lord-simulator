import type { GameState } from '../src/engine/engine.types';
import { marriageDecisionDue } from '../src/engine/marriage';
import { diplomacyOf } from '../src/engine/negotiation';
import { famineStatus, openPetitions } from '../src/engine/politics';
import { openRegistryOffers } from '../src/engine/registry';
import { lordEstatePetitions, pendingAudits } from '../src/engine/stewardship';
import { lordRequests } from '../src/engine/townAgency';

export type PresentationKind = 'petition' | 'famine' | 'counter' | 'will' | 'estate_petition' | 'audit' | 'town_request' | 'registry';
export interface RegistryPresentation {
  readonly key: string;
  readonly kind: PresentationKind;
  readonly identityBasis: 'engine_id' | 'observed_episode';
  readonly firstObservedTick: number;
  readonly lastObservedTick: number;
  readonly currentlyExposed: boolean;
}

/** Arrived decision queue items, not proof of a foreground card or an inferred terminal outcome. */
export function createRegistryPresentationCollector(): {
  observe(state: GameState): void;
  snapshot(): readonly RegistryPresentation[];
} {
  // Runner-owned history. Only the current exposure set is scanned on each observation.
  const records = new Map<string, RegistryPresentation>();
  let active = new Set<string>();
  let townEpisodes = new Map<string, string>();
  let nextEpisode = 1;
  return {
    observe(state) {
      const exposed = new Set<string>();
      const add = (kind: PresentationKind, id: string, identityBasis: RegistryPresentation['identityBasis'] = 'engine_id') => {
        const key = `${kind}:${id}`;
        exposed.add(key);
        const earlier = records.get(key);
        records.set(key, { key, kind, identityBasis, firstObservedTick: earlier?.firstObservedTick ?? state.tick,
          lastObservedTick: state.tick, currentlyExposed: true });
      };
      for (const petition of openPetitions(state)) add('petition', petition.id);
      const famine = famineStatus(state);
      if (famine !== null && famine.choices.length > 0) add('famine', famine.eventId);
      const diplomacy = diplomacyOf(state);
      for (const negotiation of diplomacy.negotiations) {
        if (negotiation.status === 'countered' && negotiation.counter !== undefined && state.tick <= negotiation.deadline) add('counter', negotiation.id);
      }
      if (marriageDecisionDue(state) === 'will_change' && diplomacy.marriage !== undefined) add('will', diplomacy.marriage.negotiationId);
      for (const petition of lordEstatePetitions(state)) add('estate_petition', petition.id);
      for (const audit of pendingAudits(state)) add('audit', audit.id);
      for (const occurrence of openRegistryOffers(state)) add('registry', occurrence.id);
      const nextTownEpisodes = new Map<string, string>();
      for (const request of lordRequests(state)) {
        // Requests have no engine occurrence ID. Normalize only this small action payload.
        const payload = JSON.stringify(Object.entries(request).sort(([a], [b]) => a.localeCompare(b)));
        const episode = nextTownEpisodes.get(payload) ?? townEpisodes.get(payload) ?? String(nextEpisode++);
        nextTownEpisodes.set(payload, episode);
        add('town_request', episode, 'observed_episode');
      }
      for (const key of active) {
        if (exposed.has(key)) continue;
        const earlier = records.get(key);
        if (earlier !== undefined) records.set(key, { ...earlier, currentlyExposed: false });
      }
      active = exposed;
      townEpisodes = nextTownEpisodes;
    },
    snapshot: () => [...records.values()],
  };
}
