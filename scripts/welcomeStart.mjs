// LM-R3: start a new game from the welcome as a player does — the mode button (the goal campaign is the sandbox's
// "목표와 함께" switch, on for `core:campaign_market_town`, off for `core:sandbox`), then the house choice's start
// (de Haverel unless `house` names another of the twenty). Scripts that clicked a `[data-scenario]` button call this.
export async function startFromWelcome(page, scenarioId, { house, root = ".welcome-parchment" } = {}) {
  const goal = page.locator(`${root} [data-sandbox-goal]`);
  if (scenarioId === "core:campaign_market_town" || scenarioId === "core:sandbox") {
    const on = await goal.getAttribute("aria-checked") === "true";
    if (on !== (scenarioId === "core:campaign_market_town")) await goal.click();
  }
  await page.locator(`${root} [data-scenario="${scenarioId}"]`).click();
  await page.locator(`${root} .welcome-house`).waitFor({ timeout: 10_000 });
  if (house !== undefined) await page.locator(`${root} [data-house-name="${house}"]`).click();
  await page.locator(`${root} [data-house-start]`).click();
}
