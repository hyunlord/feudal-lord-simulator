import { BALANCE } from '../content/balanceConfig';
import type { LedgerEntry } from '../ledger/ledger.types';
import type { ConsequenceKey } from './decisionTrace.types';
import type { GameState } from './engine.types';
import type { HistoryBecause } from './history.types';
import { lordMode } from './townAgency';
import { answerContributionsOn } from './decisionTraceAnswers';

type FlowMatcher = (target: string, entry: LedgerEntry) => ConsequenceKey | null;

/** The existing cash season receipt can witness an actual retained posting, even when its matter's first receipt is past. */
export function linkAnswerLedgerReceipts(before: GameState, after: GameState, match: FlowMatcher): GameState {
  if (!after.history || !after.trace?.answers?.length || !after.ledger || after.history.nextOrdinal === before.history?.nextOrdinal) return after;
  const known = new Set(before.history?.records.map(record => record.id));
  const trace = after.trace, ledger = after.ledger;
  let changed = false;
  const records = after.history.records.map(record => {
    if (known.has(record.id) || record.template !== 'ledger.season') return record;
    const season = after.seasons?.history.find(row => row.endTick === record.tick && row.year === record.params?.year && row.season === record.params?.season);
    if (!season || season.startTick >= season.endTick) return record;
    // Match seasonPressure.cashFlow: lord mode [start,end), town mode (start,end].
    const lord = lordMode(after);
    const entries = ledger.entries.filter(entry => entry.account === 'cash' && entry.category !== 'opening_balance' && entry.amount !== 0
      && (lord ? entry.tick >= season.startTick && entry.tick < season.endTick : entry.tick > season.startTick && entry.tick <= season.endTick));
    const evidence: { readonly answerId: string; readonly target: string; readonly key: ConsequenceKey; readonly entryId: string;
      readonly tick: number; readonly account: string; readonly category: string; readonly amount: number; readonly sourceRefs: LedgerEntry['sourceRefs'] }[] = [];
    const owners = new Map<string, ReadonlySet<string>>();
    for (const answer of trace.answers ?? []) {
      if (answer.tick >= record.tick || answer.tick + 3 * BALANCE.TICKS_PER_YEAR < season.startTick) continue;
      for (const target of new Set(answer.targets)) {
        for (const entry of entries) {
          if (entry.tick <= answer.tick || entry.tick - answer.tick > 3 * BALANCE.TICKS_PER_YEAR) continue;
          const key = match(target, entry);
          if (key === null) continue;
          const identity = `${entry.tick}:${target}`;
          if (!owners.has(identity)) owners.set(identity, new Set(answerContributionsOn(trace, target, entry.tick).map(row => row.id)));
          if (!owners.get(identity)?.has(answer.id)) continue;
          evidence.push({ answerId: answer.id, target, key, entryId: entry.id, tick: entry.tick,
            account: entry.account, category: entry.category, amount: entry.amount, sourceRefs: entry.sourceRefs });
          break;
        }
      }
    }
    if (evidence.length === 0) return record;
    const because: HistoryBecause[] = [...(record.because ?? [])];
    for (const row of evidence) if (!because.some(cause => cause.decisionId === row.answerId && cause.key === row.key))
      because.push({ decisionId: row.answerId, key: row.key, part: true });
    changed = true;
    return { ...record, because, params: { ...record.params, traceLedgerEvidence: JSON.stringify(evidence),
      tracePeriodStart: season.startTick, tracePeriodEnd: season.endTick } };
  });
  return changed ? { ...after, history: { ...after.history, records } } : after;
}
