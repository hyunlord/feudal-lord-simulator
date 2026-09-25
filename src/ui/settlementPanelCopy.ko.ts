// Settlement panel wording (UX-1 time units: game time as time at 1x speed, never raw ticks).
export const SETTLEMENT_PANEL_COPY = {
  hold: (held: string, required: string) => `연속 유지 ${held} / ${required}`,
} as const;
