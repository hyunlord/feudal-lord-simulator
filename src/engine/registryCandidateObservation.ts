export type RegistryCandidateGate = 'year' | 'season' | 'once_used' | 'pace' | 'annual_cap' | 'cooldown' | 'draw'
  | 'chapter_preparation' | 'binding' | 'dedup' | 'new_context' | 'enabled_choices' | 'accepted';

/** Mutable only while the real binder traverses one entry; never passed to observers. */
export interface RegistryBindingDiagnostic {
  combinations: number;
  contextFailures: number;
  conditionFailures: number;
  truncated: boolean;
  missingBindings: Record<string, number>;
}
export function createRegistryBindingDiagnostic(): RegistryBindingDiagnostic {
  return { combinations: 0, contextFailures: 0, conditionFailures: 0, truncated: false, missingBindings: {} };
}
export interface RegistryCandidateObservation {
  readonly tick: number;
  readonly entryId: string;
  readonly gate: RegistryCandidateGate;
  readonly combinations: number;
  readonly contextFailures: number;
  readonly conditionFailures: number;
  readonly truncated: boolean;
  readonly missingBindings: string;
  readonly enabledChoices?: number;
}
type Observer = (record: RegistryCandidateObservation) => void;
const observers = new Set<Observer>();
let observerFailures = 0;
export const registryCandidateObserverFailures = (): number => observerFailures;
export const hasRegistryCandidateObserver = (): boolean => observers.size > 0;
export function registerRegistryCandidateObserver(observer: Observer): () => void {
  const scoped: Observer = record => observer(record);
  observers.add(scoped);
  return () => { observers.delete(scoped); };
}
/** Observation failures are counted, never allowed to change candidate selection. */
export function publishRegistryCandidateObservations(records: readonly RegistryCandidateObservation[]): void {
  const recipients = [...observers];
  for (const record of records) {
    const immutable = Object.freeze({ ...record });
    for (const observer of recipients) {
      try { observer(immutable); }
      catch { observerFailures += 1; }
    }
  }
}
