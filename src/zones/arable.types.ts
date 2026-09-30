/**
 * Arable field state (spec `docs/design/arable-fields.md`, save v10). A strip is one run of cultivable cells
 * of an arable zone along the field's axis (AF-2); its crop moves through the stages on the calendar and by the
 * labour of the farmstead that tends it (AF-4, AF-7).
 */
export const ARABLE_STAGES = ["fallow", "ploughed", "sown", "growing", "ripe", "harvested"] as const;
export type ArableStage = (typeof ARABLE_STAGES)[number];

export interface ArableStripRecord {
  /** Same id as the strip layout: `${zoneId}:${axis}${line}:${first cell along the axis}`. */
  readonly id: string;
  /** Cells of the run when the record was laid out; a run of another length is a new strip (AF-3). */
  readonly cells: number;
  /** C4 (AL-2): the crop sown (a strip takes its farmstead's crop at sowing; wheat before). */
  readonly crop: "wheat" | "barley";
  readonly stage: ArableStage;
  /** Tick the strip entered `stage`. */
  readonly stageTick: number;
  /** Tick the strip was sown (sown, growing and ripe strips). */
  readonly sownTick?: number;
  /** Ripe strips: how much of the crop grew, ‰ (late sowing ripens short, AF-4). */
  readonly completionPermille?: number;
  readonly fertilityPermille: number;
  /** Worker-ticks already spent on the strip's current task (AF-7). */
  readonly work: number;
}

export interface ArableField {
  readonly zoneId: string;
  /** Strip direction, fixed when the field is first laid out so later painting does not re-cut it (AF-2). */
  readonly axis: "x" | "y";
  /** In strip layout order. */
  readonly strips: readonly ArableStripRecord[];
  /** Wheat put into barns from this field, all time. */
  readonly harvestedWheat: number;
  /** Ripe wheat still in the field when winter came (AF-4), all time. */
  readonly lostWheat: number;
}

/** What the v9→v10 migration did (spec AF-12); absent in games that never had wheat farms. */
export interface ArableMigrationSummary {
  /** Wheat farms and farm construction sites turned into arable cells. */
  readonly convertedFarms: number;
  readonly farmsteads: number;
  /** Farmsteads that found no free road-side cell near their field (diagnostic). */
  readonly unplacedFarmsteads: number;
  /** Converted cells the wall already enclosed (kept as fields, AF-1; arable cannot be painted there, Z-9). */
  readonly cellsInsideWall: number;
}

/** BOT-4 (GP-1): one year's expected harvest (at its first harvest), the wheat the barns took in and the ripe wheat lost. */
export interface HarvestYear {
  readonly expected: number;
  readonly wheat: number;
  /** Ripe wheat no barn took in before winter (a full barn, too few hands): grown, but not harvested. */
  readonly lost: number;
}

/** BOT-4 (GP-1, save v34): the calendar year being counted (`expected` set at its first harvest) and the last years. */
export interface HarvestRecord {
  /** Absolute calendar year index (`tick ÷ TICKS_PER_YEAR`). */
  readonly year: number;
  readonly expected?: number;
  readonly wheat: number;
  readonly lost: number;
  /** Completed years with an expected harvest, oldest first, at most `HARVEST_RECORD_YEARS`. */
  readonly past: readonly HarvestYear[];
}
