// Money-flow probe (spec M-8): advances a state and prints each period's ledger totals by category.
// Usage: tsx scripts/moneyFlowProbe.ts <state.json|new> <periods>
import { readFileSync } from 'node:fs';
import { advanceTick } from '../src/engine/tick';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { LEDGER_PERIOD_TICKS, treasuryBalance } from '../src/ledger/ledger';
import type { GameState } from '../src/engine/engine.types';

const [source = 'new', periodsArg = '3'] = process.argv.slice(2);
let state: GameState = source === 'new' ? structuredClone(DEFAULT_GAME_STATE) : JSON.parse(readFileSync(source, 'utf8'));
const periods = Number(periodsArg);
const end = (Math.floor(state.tick / LEDGER_PERIOD_TICKS) + periods) * LEDGER_PERIOD_TICKS;
while (state.tick < end) {
  state = advanceTick(state);
  if (state.tick % LEDGER_PERIOD_TICKS !== 0) continue;
  const byCategory: Record<string, number> = {};
  for (const entry of state.ledger?.entries ?? []) {
    if (entry.tick !== state.tick) continue;
    const key = `${entry.account}:${entry.category}`;
    byCategory[key] = (byCategory[key] ?? 0) + entry.amount;
  }
  process.stdout.write(`${JSON.stringify({ tick: state.tick, cash: treasuryBalance(state), arrears: state.money?.arrears.length ?? 0, byCategory })}\n`);
}
