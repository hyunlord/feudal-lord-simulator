import { SOURCE_REF_TYPES } from '../contracts/types';
import type { SourceRef } from '../contracts/types';
import { LEDGER_CATEGORIES } from '../ledger/ledger.types';
import type { LedgerCategory, LedgerSources } from '../ledger/ledger.types';
import type { HistoryRecord } from './history.types';

const PAYMENT_KEYS = ['right_income', 'payment_flow', 'suit_rent'] as const;

export interface DecisionLedgerEvidence {
  readonly answerId: string;
  readonly target: string;
  readonly key: (typeof PAYMENT_KEYS)[number];
  readonly entryId: string;
  readonly tick: number;
  readonly account: 'cash';
  readonly category: LedgerCategory;
  readonly amount: number;
  readonly sourceRefs: LedgerSources;
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const identity = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const tick = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const member = <T extends string>(value: unknown, values: readonly T[]): value is T => values.some(candidate => candidate === value);

function source(value: unknown): SourceRef | null {
  if (!object(value) || !member(value.type, SOURCE_REF_TYPES) || !identity(value.id)
    || (value.detail !== undefined && typeof value.detail !== 'string')) return null;
  return { type: value.type, id: value.id, ...(value.detail === undefined ? {} : { detail: value.detail }) };
}

function posting(value: unknown): DecisionLedgerEvidence | null {
  if (!object(value) || !identity(value.answerId) || !identity(value.target) || !member(value.key, PAYMENT_KEYS)
    || !identity(value.entryId) || !tick(value.tick) || value.account !== 'cash'
    || !member(value.category, LEDGER_CATEGORIES) || value.category === 'opening_balance'
    || typeof value.amount !== 'number' || !Number.isSafeInteger(value.amount) || value.amount === 0
    || !Array.isArray(value.sourceRefs) || value.sourceRefs.length === 0) return null;
  const first = source(value.sourceRefs[0]);
  if (first === null) return null;
  const rest: SourceRef[] = [];
  for (const item of value.sourceRefs.slice(1)) {
    const parsed = source(item);
    if (parsed === null) return null;
    rest.push(parsed);
  }
  return { answerId: value.answerId, target: value.target, key: value.key, entryId: value.entryId,
    tick: value.tick, account: value.account, category: value.category, amount: value.amount, sourceRefs: [first, ...rest] };
}

/**
 * Decode retained per-answer postings without substituting another answer's target. An invalid row rejects the
 * whole envelope. This validates recorded evidence, not a replay of posting ownership or answer-time settings.
 * A record lacks agency mode, so bounds accept both actual cadence endpoints ([start,end) or (start,end]).
 */
export function readDecisionLedgerEvidence(record: HistoryRecord, answerId: string): readonly DecisionLedgerEvidence[] {
  const start = record.params?.tracePeriodStart, end = record.params?.tracePeriodEnd;
  const encoded = record.params?.traceLedgerEvidence;
  if (!identity(answerId) || record.kind !== 'ledger' || record.template !== 'ledger.season'
    || !tick(start) || !tick(end) || start >= end || end !== record.tick || typeof encoded !== 'string') return [];
  let decoded: unknown;
  try { decoded = JSON.parse(encoded); }
  catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }
  if (!Array.isArray(decoded)) return [];
  const rows: DecisionLedgerEvidence[] = [], targets = new Set<string>(), entries = new Map<string, string>();
  for (const value of decoded) {
    const row = posting(value);
    if (row === null || row.tick < start || row.tick > end
      || !record.because?.some(cause => cause.decisionId === row.answerId && cause.key === row.key)) return [];
    const target = JSON.stringify([row.answerId, row.target]);
    if (targets.has(target)) return [];
    targets.add(target);
    const entry = JSON.stringify([row.tick, row.account, row.category, row.amount, row.sourceRefs]);
    if (entries.has(row.entryId) && entries.get(row.entryId) !== entry) return [];
    entries.set(row.entryId, entry);
    if (row.answerId === answerId) rows.push(row);
  }
  return rows;
}
