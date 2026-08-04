import type { EconomyStockTotals } from "./ledgerModel";
import type { PlacementTool } from "../render/renderer";
import { BUILD_TOOL_OPTIONS } from "./buildMenuModel";

type CourtLedgerProps = {
  readonly tick: number;
  readonly timber: number;
  readonly selectedTool: PlacementTool;
  readonly population?: number;
  readonly idleWorkers?: number;
  readonly stockTotals?: EconomyStockTotals;
};

export function CourtLedger({
  tick,
  timber,
  selectedTool,
  population,
  idleWorkers,
  stockTotals,
}: CourtLedgerProps) {
  const selectedName = BUILD_TOOL_OPTIONS.find((option) => option.tool === selectedTool)?.label ?? selectedTool;
  const timberTotal = stockTotals?.timber ?? timber;

  return (
    <div className="court-ledger" aria-label="Court ledger">
      <span className="ledger-heading">Royal Ledger</span>
      <dl>
        <dt>Timber</dt><dd>{timberTotal}</dd>
        {population !== undefined ? <><dt>Population</dt><dd>{population}</dd></> : null}
        {idleWorkers !== undefined ? <><dt>Idle</dt><dd>{idleWorkers}</dd></> : null}
        {stockTotals !== undefined ? (
          <>
            <dt>Wheat</dt><dd>{stockTotals.wheat}</dd>
            <dt>Bread</dt><dd>{stockTotals.bread}</dd>
            <dt>Logs</dt><dd>{stockTotals.logs}</dd>
          </>
        ) : null}
        <dt>Tick</dt><dd>{tick}</dd>
        <dt className="ledger-tool">Seal</dt><dd className="ledger-tool">{selectedName}</dd>
      </dl>
    </div>
  );
}
