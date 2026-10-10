import { ANSWER_EFFECT_TARGETS } from '../engine/answerEffects.types';
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const scalar = (v: unknown): boolean => v === null || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v);
/** Validate recorded facts structurally. Do not compare an old answer with today's state. */
export function answerEffectsProblem(value: unknown): string | null {
  if (!Array.isArray(value)) return 'effects must be an array';
  const paths = new Set<string>();
  for (const effect of value) {
    if (!object(effect) || typeof effect.target !== 'string' || !ANSWER_EFFECT_TARGETS.some(target => target === effect.target)) return 'effects target is invalid';
    if (!Array.isArray(effect.path) || effect.path.length === 0 || !effect.path.every((part: unknown) => typeof part === 'string' && part.length > 0)) return 'effects path is invalid';
    const key = JSON.stringify(effect.path);
    if (paths.has(key)) return 'effects path is duplicated';
    paths.add(key);
    if (!scalar(effect.before) || !scalar(effect.after) || typeof effect.beforePresent !== 'boolean' || typeof effect.afterPresent !== 'boolean') return 'effects values are invalid';
    if (!effect.beforePresent && effect.before !== null || !effect.afterPresent && effect.after !== null) return 'effects absent value must be null';
    if (effect.beforePresent === effect.afterPresent && effect.before === effect.after) return 'effects must record a change';
    const difference = typeof effect.before === 'number' && typeof effect.after === 'number' ? effect.after - effect.before : null;
    if (effect.delta !== difference || typeof difference === 'number' && !Number.isFinite(difference)) return 'effects delta is invalid';
  }
  return null;
}
