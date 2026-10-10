import type { HistoryRecord } from '../src/engine/history.types';
import type { RegistryOccurrence } from '../src/engine/registry.types';

export function verifyRegistryAnswerSet(
  raw: { readonly history: readonly HistoryRecord[]; readonly occurrences: readonly RegistryOccurrence[]; readonly endTick: number },
  classification: { readonly rows: readonly { readonly status: string; readonly command: string; readonly historyId: string | null; readonly tick: number; readonly source: string | null }[] },
): number;
