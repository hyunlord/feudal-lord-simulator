export function readContextSnapshot(serialized: string | undefined): Readonly<Record<string, unknown>> | null {
  if (serialized === undefined) return null;
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value));
}
