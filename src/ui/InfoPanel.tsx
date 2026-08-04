import type { PlacementTool } from "../render/renderer";
import { BUILD_TOOL_OPTIONS } from "./buildMenuModel";

type CourtLedgerProps = {
  readonly tick: number;
  readonly timber: number;
  readonly selectedTool: PlacementTool;
};

export function CourtLedger({ tick, timber, selectedTool }: CourtLedgerProps) {
  const selectedName = BUILD_TOOL_OPTIONS.find((option) => option.tool === selectedTool)?.label ?? selectedTool;

  return (
    <div className="court-ledger" aria-label="Court ledger">
      <span className="ledger-heading">Royal Ledger</span>
      <dl>
        <dt>Timber</dt><dd>{timber}</dd>
        <dt>Tick</dt><dd>{tick}</dd>
        <dt className="ledger-tool">Seal</dt><dd className="ledger-tool">{selectedName}</dd>
      </dl>
    </div>
  );
}
