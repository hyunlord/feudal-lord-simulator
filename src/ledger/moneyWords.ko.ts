// QA (render handoff from UI-AUDIT-1): the engine's own lines (the ledger history, the chronicle export, the money
// rules, the era console's income) write money as the screens do — English money, £1 = 20s = 240d — not as a penny
// count. The same rule as the screens' `src/ui/money.ko.ts` (the short form: pounds and shillings from £1 up, the pence
// dropped toward zero; shillings and pence under £1; "0d" for nothing); the engine cannot import the UI, so the short
// form and its sign are here, and `tests/moneyWords.test.ts` keeps the two the same.

const PENCE_PER_SHILLING = 12;
const PENCE_PER_POUND = 240;
const grouped = (count: number): string => String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** "£160 3s" from £1 up, "3s 4d" / "7d" under it, "−£3 4s" below zero, "—" for no number. */
export function moneyWords(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const whole = Math.trunc(value);
  const size = Math.abs(whole);
  const pounds = Math.floor(size / PENCE_PER_POUND);
  const shillings = Math.floor((size % PENCE_PER_POUND) / PENCE_PER_SHILLING);
  const pence = size % PENCE_PER_SHILLING;
  const words = [...(pounds > 0 ? [`£${grouped(pounds)}`] : []), ...(shillings > 0 ? [`${shillings}s`] : []), ...(pence > 0 && pounds === 0 ? [`${pence}d`] : [])];
  return words.length === 0 ? "0d" : `${whole < 0 ? "−" : ""}${words.join(" ")}`;
}

/** A change with its sign: "+£1 3s", "−7d", "±0d". */
export function moneyWordsDelta(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const whole = Math.trunc(value);
  return whole === 0 ? "±0d" : `${whole > 0 ? "+" : ""}${moneyWords(whole)}`;
}

/** The particle after a printed sum: "…s" (실링) takes the final-consonant form, "£…" (파운드) and "…d" (펜스) the other. */
export function moneyWordsJosa(printed: string, withFinal: string, without: string): string {
  return printed.endsWith("s") ? withFinal : without;
}
