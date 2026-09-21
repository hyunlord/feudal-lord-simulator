export interface MaterialEpisode { readonly wallId: string; readonly epoch: number }
export interface MaterialDeterioration { readonly understaffed?: true; readonly routeUnavailable?: true; readonly cancelledTransport?: true }
export interface MaterialCounters { readonly rawArrived: number; readonly produced: number; readonly wallDelivered: number; readonly deterioration?: MaterialDeterioration }
export interface MaterialCycle extends MaterialCounters {
  readonly startedTick: number;
  readonly sourceId: string;
  readonly fetchWalkerId: string;
  readonly rawPath: string;
  readonly rawEdges: number;
  readonly roadRevision: number;
  readonly workingTicks: number;
  readonly haulNoInputTicks: number;
  readonly outputWalkerId?: string;
  readonly deliveredSiteId?: string;
  readonly outputEdges?: number;
  readonly returnedTick?: number;
}
export interface MaterialScore {
  readonly score: number; readonly incumbentScore: number;
  readonly activeEdges: number; readonly incumbentActiveEdges: number;
  readonly sourceId: string; readonly rawEdges: number; readonly admittedRaw: number;
}
export interface MaterialAttempt {
  readonly attemptSiteId: string; readonly placedTick: number;
  readonly baseline: MaterialCycle; readonly score: MaterialScore;
}
export interface MaterialOpportunity {
  readonly sourceId: string; readonly activeSiteId: string; readonly admittedRaw: number;
  readonly rawLegTicks: number; readonly outputLegTicks: number; readonly workTicks: number;
  readonly alignmentTicks: number; readonly opportunityUntilTick: number;
}
export type MaterialOutcome = 'credited_delivery' | 'ineffective' | 'cancelled_or_removed' | 'demand_closed' | 'unobservable_at_completion';
export type AutoplayMaterialRecovery = MaterialEpisode & { readonly version: 1 } & (
  | { readonly status: 'observing'; readonly incumbentId: string; readonly cycle?: MaterialCycle; readonly completedCycle?: MaterialCycle }
  | ({ readonly status: 'placed' } & MaterialAttempt)
  | ({ readonly status: 'observing_result'; readonly completedTick: number; readonly opportunity: MaterialOpportunity } & MaterialAttempt & MaterialCounters)
  | ({ readonly status: 'terminal'; readonly attemptSiteId: string; readonly outcome: MaterialOutcome; readonly terminationTick: number } & MaterialCounters)
);
export interface MaterialPlacementMetadata { readonly materialRecovery?: { readonly episode: MaterialEpisode; readonly baseline: MaterialCycle; readonly score: MaterialScore } }
