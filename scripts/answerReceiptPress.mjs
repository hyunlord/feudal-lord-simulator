// RECEIPTS (user 2026-10-10): an answered heavy card (a home or off-map petition, an audit, a registry offer, the will,
// the town's request, the famine, a political petition) turns over to the answer's receipt in the same modal
// (src/ui/decisionCard/AnswerReceipt.tsx); time stays stopped until its one primary [확인] closes it. Capture scripts that
// press an answer and go on press it here, as a player does.

export const RECEIPT = '.story-modal.petition-card.decision-card.answer-receipt';

/** Waits for the receipt and presses its [확인]; true once it is up and gone again, false when no receipt came. */
export async function closeAnswerReceipt(page, timeout = 10_000) {
  const close = page.locator(`${RECEIPT} .answer-receipt-close >> visible=true`).first();
  if (!await close.waitFor({ timeout }).then(() => true, () => false)) return false;
  await close.click();
  await page.waitForTimeout(400);
  return await page.locator(`${RECEIPT} >> visible=true`).count() === 0;
}
