// UI-3: the season ledger card opens by itself at each season's end unless the player turned it off (kept per browser
// in the platform preferences; on by default).
import { platformServices } from "../platform/platform";

export const SEASON_LEDGER_AUTO_KEY = "feudal.seasonLedgerAuto";

export function seasonLedgerAuto(): boolean {
  try { return platformServices().preferences.get(SEASON_LEDGER_AUTO_KEY) !== "0"; } catch { return true; }
}

export function setSeasonLedgerAuto(value: boolean): void {
  platformServices().preferences.set(SEASON_LEDGER_AUTO_KEY, value ? "1" : "0");
}
