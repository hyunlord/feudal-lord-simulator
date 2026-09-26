import type { SettlementProblemKind } from "./settlementGuidanceModel";
import { UiIcon } from "./UiIcon";

/** UX-2: the settlement's first problem as its painted cause-family icon. */
const CELL = { water: "water", bread: "food", labour: "labour", storage: "storage" } as const satisfies Record<SettlementProblemKind, string>;

export function ProblemGlyph({ kind }: { readonly kind: SettlementProblemKind }) {
  return <UiIcon sheet="cause" cell={CELL[kind]} className="problem-symbol" />;
}
