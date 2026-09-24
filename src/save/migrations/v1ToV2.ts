/**
 * The new timber-availability samples are optional. Old saves have no evidence
 * about the last increase: preserve their state and let the first balanced timber-reserve tick
 * initialize both samples from actual availability at that tick. Backdating a
 * value would create a false reserve deadlock. Existing samples remain intact.
 */
export function migrateV1ToV2(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("Schema v1 save must be an envelope object");
  }
  return { ...input, schemaVersion: 2 };
}
