import type { ReactElement } from "react";

import { Button } from "../kit";
import { SEASON_LEDGER_COPY } from "../seasonLedgerCopy.ko";
import { UiIcon } from "../UiIcon";

// LM-R1 (playtest 2026-10-02 #7): the season card opened by itself only the first time; the seasons that close after it
// (unless the player chose "매번 띄우기") stack here as one chip with their count, and a press opens the last one.
export function SeasonNotice({ count, onOpen }: { readonly count: number; readonly onOpen: () => void }): ReactElement | null {
  if (count <= 0) return null;
  return (
    <Button type="button" className="season-notice" data-season-notices={count} aria-label={SEASON_LEDGER_COPY.noticeLabel(count)}
      onPress={() => onOpen()} variant="secondary">
      <UiIcon sheet="action" cell="log" />{SEASON_LEDGER_COPY.notice(count)}
    </Button>
  );
}
