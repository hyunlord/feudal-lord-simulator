// UI-AUDIT-1: how a sum of money reads on screen. The engine counts whole pennies (d); the screens write English money,
// £1 = 20s = 240d, as the lord-mode terms do (docs/design/lord-mode.md: a dowry of £200, a minimum income of £40 a year,
// "£5 이상은 나에게"), so a negotiation's £200 and the treasury print through the same functions.
//
// The rule:
// - moneyShort (every screen line: the HUD, cards, forecasts, chronicle): from £1 up, the pounds (thousands with commas)
//   and the shillings — the pence are dropped: 38,447d → "£160 3s", 48,000d → "£200". Under £1 nothing would be left,
//   so the shillings and pence show: 40d → "3s 4d", 7d → "7d", 12d → "1s". Zero parts are left out; nothing is "0d"
//   but zero itself. Dropped pence are cut toward zero (never rounded up), so a screen never shows money that is not
//   there: 239d → "19s 11d", 479d → "£1 19s".
// - moneyFull (the ledger's columns and the treasury a press opens): every part down to the penny, "£160 3s 11d".
// - moneyPence (beside moneyFull where the engine's own number helps): the penny count, "38,447d".
// - moneyDelta: moneyShort with its sign, "+£1 3s", "−7d", "±0d".
// - moneyBoxDelta (a printed box with room for about four characters: the season close's scene boxes, UIAUDIT-R15-D1):
//   the largest part alone with its sign, cut toward zero — "+£12", "−£3", "+5s", "+7d", "±0d"; over £9,999 the pounds
//   in 만, "+£4만". The exact sum is printed beside it elsewhere (the season's money line).
// Negative sums take the minus sign (−, U+2212) in front of every form: "−£3 4s".
// Fractions of a penny (a rate times a count) are cut toward zero first.

export const PENCE_PER_SHILLING = 12;
export const SHILLINGS_PER_POUND = 20;
export const PENCE_PER_POUND = PENCE_PER_SHILLING * SHILLINGS_PER_POUND;

const MARK = { pound: "£", shilling: "s", penny: "d", minus: "−", plus: "+", zero: "±", separator: " ", unknown: "—" } as const;

export type MoneyParts = Readonly<{ negative: boolean; pounds: number; shillings: number; pence: number }>;

/** A penny count split into pounds, shillings and pence (the magnitude; `negative` carries the sign). */
export function moneyParts(value: number): MoneyParts {
  const whole = Math.trunc(value);
  const size = Math.abs(whole);
  return {
    negative: whole < 0,
    pounds: Math.floor(size / PENCE_PER_POUND),
    shillings: Math.floor((size % PENCE_PER_POUND) / PENCE_PER_SHILLING),
    pence: size % PENCE_PER_SHILLING,
  };
}

/** 41666 → "41,666" (commas every three digits, whatever the browser's locale). */
const grouped = (count: number): string => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function written(parts: MoneyParts, dropPence: boolean): string {
  const words = [
    ...(parts.pounds > 0 ? [`${MARK.pound}${grouped(parts.pounds)}`] : []),
    ...(parts.shillings > 0 ? [`${parts.shillings}${MARK.shilling}`] : []),
    ...(parts.pence > 0 && !(dropPence && parts.pounds > 0) ? [`${parts.pence}${MARK.penny}`] : []),
  ];
  if (words.length === 0) return `0${MARK.penny}`;
  return `${parts.negative ? MARK.minus : ""}${words.join(MARK.separator)}`;
}

/** The screen's form: "£160 3s" from £1 up, "3s 4d" / "7d" under it (see the rule above). */
export function moneyShort(value: number): string {
  return Number.isFinite(value) ? written(moneyParts(value), true) : MARK.unknown;
}

/** The ledger's form: every part down to the penny, "£160 3s 11d". */
export function moneyFull(value: number): string {
  return Number.isFinite(value) ? written(moneyParts(value), false) : MARK.unknown;
}

/** The engine's own number: "38,447d". */
export function moneyPence(value: number): string {
  if (!Number.isFinite(value)) return MARK.unknown;
  const whole = Math.trunc(value);
  return `${whole < 0 ? MARK.minus : ""}${grouped(Math.abs(whole))}${MARK.penny}`;
}

/** A change of money in the short form with its sign: "+£1 3s", "−7d", "±0d". */
export function moneyDelta(value: number): string {
  if (!Number.isFinite(value)) return MARK.unknown;
  const whole = Math.trunc(value);
  return whole === 0 ? `${MARK.zero}0${MARK.penny}` : `${whole > 0 ? MARK.plus : ""}${moneyShort(whole)}`;
}

/** Over 9,999 a count reads in 만 (ten thousands), cut toward zero, no decimals: 200,179 → "20만". */
export function manCount(count: number): string {
  const size = Math.trunc(Math.abs(count));
  return size > 9_999 ? `${Math.floor(size / 10_000)}만` : String(size);
}

/** A change of money in a box's room: its largest part alone, with its sign ("+£12", "−5s", "+7d", "±0d", "+£4만"). */
export function moneyBoxDelta(value: number): string {
  if (!Number.isFinite(value)) return MARK.unknown;
  const parts = moneyParts(value);
  if (parts.pounds === 0 && parts.shillings === 0 && parts.pence === 0) return `${MARK.zero}0${MARK.penny}`;
  const sign = parts.negative ? MARK.minus : MARK.plus;
  if (parts.pounds > 0) return `${sign}${MARK.pound}${manCount(parts.pounds)}`;
  return parts.shillings > 0 ? `${sign}${parts.shillings}${MARK.shilling}` : `${sign}${parts.pence}${MARK.penny}`;
}

/**
 * The particle after a printed sum, read aloud: "…s" is 실링 (a final consonant: 을/이/은), "£…" is 파운드 and "…d"
 * is 펜스 (a vowel: 를/가/는).
 */
export function moneyJosa(printed: string, withFinal: string, without: string): string {
  return printed.endsWith(MARK.shilling) ? withFinal : without;
}

/** The short form with its object particle: "£160 3s을", "£200를", "7d를". */
export function moneyObject(value: number): string {
  const printed = moneyShort(value);
  return `${printed}${moneyJosa(printed, "을", "를")}`;
}
