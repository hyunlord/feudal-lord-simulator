import { createHash } from 'node:crypto';

export const NAVIGATION_HASH_SCOPE = 'JSON state excluding only top-level /seen; raw evidence hashes remain unchanged';
export function navigationStateSha256(value) {
  const state = typeof value === 'string' ? JSON.parse(value) : value;
  if (state === null || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('Expected a state object');
  const { seen: _seen, ...retained } = state;
  return createHash('sha256').update(JSON.stringify(retained)).digest('hex');
}
