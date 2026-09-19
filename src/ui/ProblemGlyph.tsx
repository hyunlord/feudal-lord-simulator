import type { SettlementProblemKind } from "./settlementGuidanceModel";

const PATHS = {
  water: "M12 3C10 7 5 11 5 15a7 7 0 0 0 14 0c0-4-5-8-7-12Z",
  bread: "M3 13c0-4 4-7 9-7s9 3 9 7v5H3Zm5-5-2 5m8-7-3 7m8-5-3 5",
  labour: "M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 10v-3a6 6 0 0 1 12 0v3M9 16v4m6-4v4",
  storage: "M4 5h16v15H4Zm0 4h16M8 9v11m8-11v11M8 2v3m8-3v3",
} as const satisfies Record<SettlementProblemKind, string>;

export function ProblemGlyph({ kind }: { readonly kind: SettlementProblemKind }) {
  return (
    <svg className="problem-symbol" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[kind]} />
    </svg>
  );
}
