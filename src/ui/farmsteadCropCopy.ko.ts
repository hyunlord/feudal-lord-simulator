// INSTALL-3: the barn card's crop choice (the game command `set_farmstead_crop`, spec AL-2). Crop names are the goods'
// names (resourceCatalog.ko.ts); a strip takes its barn's crop when it is sown, so a change waits for the next sowing.
export const FARMSTEAD_CROP_COPY = {
  heading: "작물",
  label: "헛간 작물",
  current: (crop: string) => `이 헛간이 뿌리는 작물: ${crop}`,
  note: "바꾸면 다음 파종부터 뿌립니다. 이미 뿌린 이랑은 거둘 때까지 그대로입니다",
  /** The field-work window's end (ARABLE_CONFIG.fieldWorkUntil; the first year's, firstYearFieldWorkUntil). */
  until: "여름 중순",
  firstYearUntil: "여름 말",
  sowingNow: (until: string) => `지금이 파종 철입니다 · ${until}까지`,
  /** The next window opens (ARABLE_CONFIG.fieldWorkFrom, a calendar arrival). */
  sowingNext: (when: string, until: string) => `다음 파종: ${when}부터 ${until}까지`,
  /** Strips of this barn still growing the other crop. */
  pending: (old: string, strips: number, next: string) => `아직 ${old} 이랑 ${strips}개 · 거둔 뒤 다음 파종부터 ${next}`,
  /** The barn carts out what it holds of the other crop first. */
  carting: (crop: string, amount: number) => `헛간에 남은 ${crop} ${amount} · 먼저 실어 냅니다`,
} as const;
