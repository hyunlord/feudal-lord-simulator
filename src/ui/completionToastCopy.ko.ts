// F0-V completion toast (visibility design 2절 완공: 동시 완공 알림 묶기, 4초).
export const COMPLETION_TOAST_COPY = {
  one: (name: string) => `${name} 완공`,
  many: (name: string, others: number) => `${name} 외 ${others}곳 완공`,
  region: "완공 알림",
} as const;
