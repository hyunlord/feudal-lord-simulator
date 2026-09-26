// UI-3: a house under food pressure names it first in its inspector (FP-3 cause from the engine).
export const HOUSE_PRESSURE_COPY = {
  leaving: (cause: string) => `떠날 채비 — ${cause}`,
  abandoned: (cause: string) => `비워진 집 — ${cause}`,
} as const;
