export const STORAGE_OVERFLOW_COPY = {
  glyph: '넘',
  shortLabel: '창고 넘침',
  label: (amount: number): string => `넘침 ${amount} · 귀환 화물을 임시 보관 중`,
} as const;
