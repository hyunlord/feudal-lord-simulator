import { platformServices } from "../../platform/platform";
import type { ChronicleFilter } from "../chronicle/chronicleScreenModel";

// LM-R1: a receipt's decision ribbon opens the chronicle (the history ledger) on that decision's record. The ribbon
// leaves the record's id here and asks for the chronicle as its C key does (the `panel` intent: it opens over a state
// with no modal up); the chronicle screen reads the id as it opens, picks that record and clears it. Not a cache: one
// pending request (a chronicle opened any other way finds none). Read and cleared apart, as a state initializer may run
// twice (React's strict mode) while the mount effect clears it.
let pending: { readonly recordId: string; readonly tick: number } | null = null;
// PLAY-2: the year card's [연대기에서 보기] asks for the chronicle filtered to that year's range — the same kind of one
// pending request, read by the screen's filter as it opens and cleared with the record.
let years: { readonly from: number; readonly to: number } | null = null;

export function openChronicleRecord(recordId: string, tick: number): void {
  pending = { recordId, tick };
  platformServices().input.emit({ kind: "panel", panel: "chronicle" }, { target: "control" });
}

/** The record a receipt asked the chronicle to open on (null when none was asked). */
export function chronicleFocus(): { readonly recordId: string; readonly tick: number } | null {
  return pending;
}

/** The year card's request: the chronicle opens on these years (the caller then opens the chronicle modal). */
export function focusChronicleYears(from: number, to: number): void {
  years = { from, to };
}

/** The chronicle's first filter: `base` with the years a year card asked for, if any. */
export function chronicleFilterFocus(base: ChronicleFilter): ChronicleFilter {
  return years === null ? base : { ...base, fromYear: years.from, toYear: years.to };
}

export function clearChronicleFocus(): void {
  pending = null;
  years = null;
}
