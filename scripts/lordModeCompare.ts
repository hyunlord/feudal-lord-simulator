// LM-E1 gate (TA-9): the same seed under the four estate policies with and without a subsidy — does the town come out
// a different shape? Reads `lordModeRun.ts` outputs and prints a Markdown table: the kinds of buildings, how many house
// plots sit where the growth-policy town's do (and the share that moved), the treasury, the people, the subsidised kind.
//   tsx scripts/lordModeCompare.ts <reference.json> <run.json>... > table.md
import { readFileSync } from "node:fs";

interface Run {
  readonly policy: string;
  readonly subsidy?: { readonly kind: string; readonly amount: number };
  readonly final: { readonly year: number; readonly population: number; readonly treasury: number; readonly l4: number; readonly houses: number;
    readonly kinds: Readonly<Record<string, number>>; readonly housePlots: readonly (readonly [number, number])[] };
  readonly receipts: { readonly count: number; readonly withDecisions: number };
  readonly audit: { readonly audited: number; readonly mismatched: number };
}

const [referencePath, ...paths] = process.argv.slice(2);
const read = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Run;
const reference = read(referencePath!);
const plots = (run: Run) => new Set(run.final.housePlots.map(([tx, ty]) => `${tx},${ty}`));
const referencePlots = plots(reference);
const kinds = [...new Set([reference, ...paths.map(read)].flatMap(run => Object.keys(run.final.kinds)))].filter(kind => kind !== "manor_house").sort();
const kindCell = (run: Run) => kinds.map(kind => run.final.kinds[kind] ?? 0).join("·");
const lines = [
  `| 방침 | 장려금 | 건물 종류(${kinds.join("·")}) | 집 필지(기준과 같은 자리) | 금고 d | 인구 | L4 | 영수증(결정 가리킴) | 대조 불일치 |`,
  "|---|---|---|---|---:|---:|---:|---|---:|",
];
for (const run of [reference, ...paths.map(read)]) {
  const own = plots(run);
  const same = [...own].filter(plot => referencePlots.has(plot)).length;
  lines.push(`| ${run.policy} | ${run.subsidy === undefined ? "없음" : `${run.subsidy.kind} ${run.subsidy.amount}d`} | ${kindCell(run)} | ${own.size}(${same}) | `
    + `${run.final.treasury.toLocaleString("en-US")} | ${run.final.population} | ${run.final.l4} | ${run.receipts.count}(${run.receipts.withDecisions}) | ${run.audit.mismatched}/${run.audit.audited} |`);
}
process.stdout.write(`${lines.join("\n")}\n`);
