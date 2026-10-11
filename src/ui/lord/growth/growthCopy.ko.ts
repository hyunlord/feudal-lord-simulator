// LS1-3 (lord-screen-v1.md): the status pill's growth mark — a stop of the town's growth that lasted past two seasons.
export const GROWTH_COPY = {
  stalled: (years: number) => `정체 ${years}년`,
  stalledLabel: (years: number) => `마을이 ${years}년째 자라지 않습니다`,
} as const;
