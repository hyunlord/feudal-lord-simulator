// LS1-12: a folded chip's card lists its held decisions and answers each from there — its [결정하기] asks the decision's
// card for that one (by its chip id). The card views show the asked one while it is open, else the first as before.
let asked: string | null = null;

/** The held decision a folded chip's card asked to open (its chip id), or none. */
export function askDecision(chipId: string | null): void { asked = chipId; }

/** The open decision to show: the one asked for while it is among them, else the first. */
export function askedOrFirst<T>(open: readonly T[], chipIdOf: (item: T) => string): T | undefined {
  return (asked === null ? undefined : open.find(item => chipIdOf(item) === asked)) ?? open[0];
}
