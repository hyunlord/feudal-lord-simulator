import type { EconomyHarnessReport } from "./economyHarnessReportTypes";

export function formatEconomyHarnessReport(report: EconomyHarnessReport): string {
  const rows = [
    ["Metric", "Value", "Status"],
    ...report.metrics.map((metricRow) => [metricRow.label, metricRow.value, metricRow.status]),
  ];
  const metricWidth = Math.max(...rows.map((row) => row[0]?.length ?? 0)) + 2;
  const valueWidth = Math.max(...rows.map((row) => row[1]?.length ?? 0)) + 2;
  const metricTable = rows
    .map((row) => `${(row[0] ?? "").padEnd(metricWidth)}${(row[1] ?? "").padEnd(valueWidth)}${row[2] ?? ""}`)
    .join("\n");
  if (report.autoplay === undefined) return metricTable;
  const autoplay = report.autoplay;
  const status = autoplay.hashA === autoplay.hashB && autoplay.actionCount > 0 ? "PASS" : "FAIL";
  const provenance = report.advisorProvenance;
  const provenanceLine = provenance === undefined
    ? ""
    : `\nAdvisor provenance  ${provenance.kind}: ${provenance.traces.map((trace) => `${trace.id}/${trace.source} cadence ${trace.cadenceTicks}, ${trace.actionCount} actions, ${trace.snapshotCount} snapshots`).join("; ")}  PASS`;
  return `${metricTable}${provenanceLine}\nAutoplay advisor  ${autoplay.actionCount} actions, ${autoplay.hashA} == ${autoplay.hashB}  ${status}`;
}
