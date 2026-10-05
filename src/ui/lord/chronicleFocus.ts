import { platformServices } from "../../platform/platform";

// LM-R1: a receipt's decision ribbon opens the chronicle (the history ledger) on that decision's record. The ribbon
// leaves the record's id here and asks for the chronicle as its C key does (the `panel` intent: it opens over a state
// with no modal up); the chronicle screen reads the id as it opens, picks that record and clears it. Not a cache: one
// pending request (a chronicle opened any other way finds none). Read and cleared apart, as a state initializer may run
// twice (React's strict mode) while the mount effect clears it.
let pending: { readonly recordId: string; readonly tick: number } | null = null;

export function openChronicleRecord(recordId: string, tick: number): void {
  pending = { recordId, tick };
  platformServices().input.emit({ kind: "panel", panel: "chronicle" }, { target: "control" });
}

/** The record a receipt asked the chronicle to open on (null when none was asked). */
export function chronicleFocus(): { readonly recordId: string; readonly tick: number } | null {
  return pending;
}

export function clearChronicleFocus(): void {
  pending = null;
}
