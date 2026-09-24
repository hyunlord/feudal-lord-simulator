/**
 * Shared data contracts for causes, effects and predictions (content design §11).
 *
 * Every later system (events, policies, rights, eras, zones) records *why* something happens as
 * `SourceRef`s, expresses *what* it does as an `EffectSpec`, and shows the player *what will happen*
 * as `PredictionLine`s. All values are plain JSON (string ids, finite numbers, booleans) so that they
 * can enter `GameState` later without a new encoding; today none of them is saved.
 */

/** The ten kinds of origin a cause or effect can point back to. */
export const SOURCE_REF_TYPES = [
  "building", "zone", "policy", "event", "scenario", "trade", "right", "instrument", "actor", "claim",
] as const;
export type SourceRefType = (typeof SOURCE_REF_TYPES)[number];

/** Where a cause or effect comes from. `id` uses the owning system's existing id (e.g. `Building.id`). */
export interface SourceRef {
  readonly type: SourceRefType;
  readonly id: string;
  /** Optional short machine-readable qualifier (e.g. which rule of a policy); never player-facing copy. */
  readonly detail?: string;
}

/**
 * Something an effect can apply to. Ids follow the existing id systems:
 * - `building`: `Building.id` (houses share their building id)
 * - `tile`: `tileRefId(tx, ty)` = `"tx,ty"`, the key already used by road and wall graphs
 * - `construction_site`: `ConstructionSite.id`
 */
export type EntityRef =
  | { readonly kind: "building"; readonly id: string }
  | { readonly kind: "tile"; readonly id: string }
  | { readonly kind: "construction_site"; readonly id: string };

/**
 * An area an effect can apply to. `settlement` is the whole town (id `SETTLEMENT_REGION_ID`).
 * `zone` ids are reserved for the zone system (C1); no zone exists yet.
 */
export type RegionRef =
  | { readonly kind: "settlement"; readonly id: string }
  | { readonly kind: "zone"; readonly id: string };

/** One end of a resource flow: an entity, a region, the town treasury, or an actor (lord, crown, guild). */
export type EndpointRef =
  | EntityRef
  | RegionRef
  | { readonly kind: "treasury"; readonly id: string }
  | { readonly kind: "actor"; readonly id: string };

export type EffectTarget = EntityRef | RegionRef;

/** What an effect does. Interpreting a spec is the job of the rule that reads it (B2–B4); none does yet. */
export type EffectSpec =
  | { readonly kind: "modifier"; readonly stat: string; readonly op: "add" | "mul"; readonly value: number }
  | { readonly kind: "rule"; readonly rule: string; readonly value: string | number | boolean }
  | { readonly kind: "permission"; readonly tag: string; readonly allowed: boolean }
  | { readonly kind: "resource_flow"; readonly category: string; readonly from: EndpointRef; readonly to: EndpointRef }
  | { readonly kind: "event_weight"; readonly eventId: string; readonly multiplier: number };

/** An effect instance: a spec applied by a source to a target from `startedAt` until `expiresAt` (exclusive). */
export interface AppliedEffect {
  readonly id: string;
  readonly source: SourceRef;
  readonly target: EffectTarget;
  readonly spec: EffectSpec;
  /** Tick at which the effect becomes active. */
  readonly startedAt: number;
  /** First tick at which the effect is no longer active; absent = until removed. */
  readonly expiresAt?: number;
}

/** One line of a forecast shown before the player commits an action. */
export interface PredictionLine {
  readonly severity: "info" | "ok" | "warn" | "block";
  readonly text: string;
  readonly sources: readonly SourceRef[];
}

export const SETTLEMENT_REGION_ID = "settlement";
export const TREASURY_ENDPOINT_ID = "treasury";

export function tileRefId(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

export function buildingSource(id: string): SourceRef {
  return { type: "building", id };
}

/** Stable identity of a reference, for grouping and ordering. */
export function refKey(ref: SourceRef | EndpointRef): string {
  return "type" in ref
    ? `${ref.type}:${ref.id}${ref.detail === undefined ? "" : `#${ref.detail}`}`
    : `${ref.kind}:${ref.id}`;
}

export function isSourceRef(value: unknown): value is SourceRef {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (SOURCE_REF_TYPES as readonly unknown[]).includes(candidate.type)
    && typeof candidate.id === "string" && candidate.id.length > 0
    && (candidate.detail === undefined || typeof candidate.detail === "string");
}
