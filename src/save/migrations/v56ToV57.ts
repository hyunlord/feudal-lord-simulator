/** Provisional EB-TLINK answer effect snapshots; final numbering belongs to engine integration.
 * Earlier answers have no before/after snapshots. Leave effects absent rather than infer them from current state.
 */
export function migrateV56ToV57(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) throw new TypeError('Schema v56 save must be an envelope object');
  if (!('state' in input) || typeof input.state !== 'object' || input.state === null) throw new TypeError('Schema v56 save has no state');
  return { ...input, schemaVersion: 57 };
}
