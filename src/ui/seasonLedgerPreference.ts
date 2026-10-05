// UI-3: the season ledger card opens by itself at each season's end unless the player turned it off (kept per browser
// in the platform preferences). LM-R1 (playtest 2026-10-02 #7): it opens by itself only the first time; the player
// chooses there whether it keeps doing so, and until they choose "always" later seasons stack as a notice.
import { platformServices } from "../platform/platform";

export const SEASON_LEDGER_AUTO_KEY = "feudal.seasonLedgerAuto";

/** "unset": no season card has opened yet (the next one opens and asks); "auto": every season; "notice": a notice. */
export type SeasonLedgerChoice = "unset" | "auto" | "notice";

export function seasonLedgerChoice(): SeasonLedgerChoice {
  try {
    const stored = platformServices().preferences.get(SEASON_LEDGER_AUTO_KEY);
    return stored === "1" ? "auto" : stored === "0" ? "notice" : "unset";
  } catch { return "unset"; }
}

/** The card opens by itself every season (the player chose it). */
export function seasonLedgerAuto(): boolean {
  return seasonLedgerChoice() === "auto";
}

export function setSeasonLedgerAuto(value: boolean): void {
  platformServices().preferences.set(SEASON_LEDGER_AUTO_KEY, value ? "1" : "0");
}
