// Gate ③ of C2 (spec M-8): in the stable interval of a growth run, the last ten period closes must each
// change the treasury by at most ±10% of the balance they started from, never go negative, and leave no
// arrears. Also reports the income/upkeep ratio (target 1.2–1.5) and how steady the net flow is.
// Usage: tsx scripts/moneyConvergence.ts <growthRunOutputDirectory>...
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MoneyPeriodSample } from './moneyPeriodRecord';

type Period = MoneyPeriodSample & { readonly stableSince: number | null };

const WINDOW = 10;
const LIMIT = 0.1;

export function moneyConvergence(periods: readonly Period[]) {
  const stable = periods.filter(period => period.stableSince !== null && period.tick - period.stableSince >= 0);
  const window = stable.slice(-WINDOW);
  const rows = window.map(period => {
    const index = periods.indexOf(period);
    const start = index > 0 ? periods[index - 1]!.cash : 0;
    const net = period.income - period.spending;
    return { tick: period.tick, startBalance: start, income: period.income, spending: period.spending, net,
      netOfBalance: start > 0 ? Number((net / start).toFixed(4)) : null,
      netOfIncome: period.income > 0 ? Number((net / period.income).toFixed(4)) : null,
      incomeToUpkeep: period.spending > 0 ? Number((period.income / period.spending).toFixed(3)) : null,
      arrearsOwed: period.arrearsOwed, byCategory: period.byCategory };
  });
  const meanNet = rows.reduce((sum, row) => sum + row.net, 0) / Math.max(1, rows.length);
  const checks = {
    tenPeriods: rows.length === WINDOW,
    withinTenPercentOfBalance: rows.every(row => row.netOfBalance !== null && Math.abs(row.netOfBalance) <= LIMIT),
    notRunningOut: rows.every(row => row.net >= 0 && row.startBalance + row.net > 0),
    noArrears: rows.every(row => row.arrearsOwed === 0),
  };
  return {
    passed: Object.values(checks).every(Boolean), checks, rows,
    recorded: {
      incomeToUpkeep: [Math.min(...rows.map(row => row.incomeToUpkeep ?? Infinity)), Math.max(...rows.map(row => row.incomeToUpkeep ?? 0))],
      netSpreadOfMean: meanNet === 0 ? null : Number((Math.max(...rows.map(row => Math.abs(row.net - meanNet))) / Math.abs(meanNet)).toFixed(4)),
      meanNet: Number(meanNet.toFixed(1)),
    },
    definition: 'Last 10 period closes of the uninterrupted stability interval; |net| <= 10% of the balance at the period start, net >= 0, no arrears',
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = process.argv.slice(2).map(directory => {
    const periods = readFileSync(resolve(directory, 'money-periods.jsonl'), 'utf8').split('\n').filter(line => line.trim() !== '')
      .map(line => JSON.parse(line) as Period);
    return { directory, ...moneyConvergence(periods) };
  });
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
