import { refKey, type AppliedEffect, type EffectTarget } from "./types";

/**
 * Effect pipeline skeleton: register, query by target, expire by tick.
 *
 * - Derived and unsaved: a registry is rebuilt from its sources (buildings, policies, events …) and is
 *   never written into `GameState`. `toJSON()` exists so a later stage can store effects without a new
 *   encoding, and so tests can prove the serialized form is stable.
 * - Deterministic: results are always in registration order, so the same registrations in the same
 *   order give the same answers on every platform. No clock, randomness or Map iteration of foreign keys.
 * - No rule reads this yet. B2 (scenarios/eras), B3 (ledger) and B4 (events) are the first consumers.
 *
 * Rights (political research): a right is not a second effect engine. It is a *source layer* that
 * publishes `resource_flow` (rents, tolls, dues) and `permission` (market, mill, fishing) effects into
 * this same pipe, with `source.type === "right"`.
 */
export class EffectRegistry {
  private readonly effects: AppliedEffect[] = [];
  private readonly ids = new Set<string>();

  /** Adds an effect. Ids are unique; re-registering an id is a programming error. */
  register(effect: AppliedEffect): void {
    if (this.ids.has(effect.id)) throw new Error(`Effect already registered: ${effect.id}`);
    if (!Number.isFinite(effect.startedAt) || (effect.expiresAt !== undefined && !Number.isFinite(effect.expiresAt))) {
      throw new Error(`Effect ${effect.id} needs finite ticks`);
    }
    this.ids.add(effect.id);
    this.effects.push(effect);
  }

  /** Effects active at `tick` (startedAt <= tick < expiresAt) for one target, in registration order. */
  forTarget(target: EffectTarget, tick: number): readonly AppliedEffect[] {
    const key = refKey(target);
    return this.effects.filter(effect => refKey(effect.target) === key && isActive(effect, tick));
  }

  /** All effects active at `tick`, in registration order. */
  active(tick: number): readonly AppliedEffect[] {
    return this.effects.filter(effect => isActive(effect, tick));
  }

  /** Removes effects whose `expiresAt <= tick`; returns them in registration order. */
  expire(tick: number): readonly AppliedEffect[] {
    const removed: AppliedEffect[] = [];
    for (let index = 0; index < this.effects.length;) {
      const effect = this.effects[index];
      if (effect !== undefined && effect.expiresAt !== undefined && effect.expiresAt <= tick) {
        removed.push(effect);
        this.ids.delete(effect.id);
        this.effects.splice(index, 1);
      } else index += 1;
    }
    return removed;
  }

  get size(): number {
    return this.effects.length;
  }

  /** Registration-ordered plain copy; `EffectRegistry.fromJSON(JSON.parse(JSON.stringify(r)))` round-trips. */
  toJSON(): readonly AppliedEffect[] {
    return this.effects.map(effect => ({ ...effect }));
  }

  static fromJSON(effects: readonly AppliedEffect[]): EffectRegistry {
    const registry = new EffectRegistry();
    for (const effect of effects) registry.register(effect);
    return registry;
  }
}

function isActive(effect: AppliedEffect, tick: number): boolean {
  return effect.startedAt <= tick && (effect.expiresAt === undefined || tick < effect.expiresAt);
}
