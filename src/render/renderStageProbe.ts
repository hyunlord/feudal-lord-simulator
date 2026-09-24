// Proof-mode render stage timing and canvas call counting.
//
// Only `installPhase10ProofRuntime` (`?phase10-proof=1`) installs a recorder. Every call site in the render path
// reads `renderStageProbe.current` once and calls it with optional chaining (`probe?.enter("walls")`), so with no
// recorder the arguments are not evaluated and nothing in this file runs. The canvas methods are only wrapped on
// the proof canvas and restored on dispose.
//
// Stages are flat and exclusive: `enter(stage)` closes the running stage at the current time and opens the next
// one, so the stage times of a frame add up to exactly `frameEnd − frameStart` whatever the timer resolution.

export const RENDER_STAGES = [
  "frame.setup", "frame.placementPreview", "frame.clear", "objects.sort",
  "terrain.water", "terrain.fill", "terrain.seams", "terrain.landscape", "terrain.frontage", "roads.ground",
  "terrain.grounding", "farmland", "roads.overlay", "buildings", "nature", "construction", "walls", "bridges",
  "walkers", "effects", "overlay.mode", "overlay.wallDraft", "overlay.placement", "overlay.cause",
  "overlay.onboarding", "overlay.feedback", "overlay.constructionAccess", "frame.publish",
] as const;
export type RenderStage = typeof RENDER_STAGES[number];

/** Report groups used by the benchmark tables (work order B11 §1). */
export const RENDER_STAGE_GROUPS: Readonly<Record<RenderStage, string>> = {
  "frame.setup": "준비", "frame.placementPreview": "준비", "frame.clear": "준비", "frame.publish": "준비",
  "objects.sort": "오브젝트 정렬",
  "terrain.water": "지형", "terrain.fill": "지형", "terrain.seams": "지형", "terrain.landscape": "지형",
  "terrain.grounding": "지형",
  "terrain.frontage": "건물", "buildings": "건물", "construction": "건물",
  "roads.ground": "도로", "roads.overlay": "도로", "bridges": "도로",
  "farmland": "농지", "nature": "나무·풀", "walls": "성벽", "walkers": "주민·수레", "effects": "오버레이",
  "overlay.mode": "오버레이", "overlay.wallDraft": "오버레이", "overlay.placement": "오버레이",
  "overlay.cause": "오버레이", "overlay.onboarding": "오버레이", "overlay.feedback": "오버레이",
  "overlay.constructionAccess": "오버레이",
};

export const COUNTED_CANVAS_METHODS = ["drawImage", "fill", "stroke", "fillRect", "clip", "beginPath"] as const;
type CountedMethod = typeof COUNTED_CANVAS_METHODS[number];

export type RenderStageFrame = {
  readonly totalMs: number;
  /** Milliseconds per stage, indexed like RENDER_STAGES. */
  readonly stageMs: readonly number[];
  /** Calls per stage × method, `calls[stageIndex][methodIndex]`, methods indexed like COUNTED_CANVAS_METHODS. */
  readonly calls: readonly (readonly number[])[];
  readonly visibleTiles: number;
  readonly objects: Readonly<Record<string, number>>;
};

export type RenderStageSnapshot = {
  readonly capacity: number;
  readonly frameCount: number;
  readonly stages: readonly RenderStage[];
  readonly methods: readonly CountedMethod[];
  readonly frames: readonly RenderStageFrame[];
};

export type RenderStageRecorder = {
  readonly frameStart: () => void;
  readonly enter: (stage: RenderStage) => void;
  readonly noteScene: (visibleTiles: number, objects: readonly { readonly kind: string }[]) => void;
  readonly frameEnd: () => void;
};

export const renderStageProbe: { current: RenderStageRecorder | null } = { current: null };

const CAPACITY = 240;
const STAGE_INDEX = new Map<RenderStage, number>(RENDER_STAGES.map((stage, index) => [stage, index]));

export function installRenderStageProbe(
  context: CanvasRenderingContext2D,
  now: () => number = () => performance.now(),
): { readonly snapshot: () => RenderStageSnapshot; readonly dispose: () => void } {
  const frames: RenderStageFrame[] = [];
  let frameCount = 0;
  let open = false;
  let frameStartedAt = 0;
  let stageStartedAt = 0;
  let stage = 0;
  let stageMs: number[] = [];
  let calls: number[][] = [];
  let visibleTiles = 0;
  let objects: Record<string, number> = {};

  const close = (at: number) => {
    stageMs[stage] = (stageMs[stage] ?? 0) + at - stageStartedAt;
    stageStartedAt = at;
  };
  const recorder: RenderStageRecorder = {
    frameStart: () => {
      const at = now();
      open = true; frameStartedAt = at; stageStartedAt = at; stage = 0;
      stageMs = RENDER_STAGES.map(() => 0);
      calls = RENDER_STAGES.map(() => COUNTED_CANVAS_METHODS.map(() => 0));
      visibleTiles = 0; objects = {};
    },
    enter: (next) => {
      if (!open) return;
      close(now());
      stage = STAGE_INDEX.get(next) ?? stage;
    },
    noteScene: (tiles, items) => {
      visibleTiles = tiles;
      for (const item of items) objects[item.kind] = (objects[item.kind] ?? 0) + 1;
    },
    frameEnd: () => {
      if (!open) return;
      const at = now();
      close(at);
      open = false;
      frames.push({ totalMs: at - frameStartedAt, stageMs, calls, visibleTiles, objects });
      if (frames.length > CAPACITY) frames.shift();
      frameCount += 1;
    },
  };

  const target = context as unknown as Record<CountedMethod, (...args: unknown[]) => unknown>;
  const restore: (() => void)[] = [];
  COUNTED_CANVAS_METHODS.forEach((method, methodIndex) => {
    const original = target[method];
    if (typeof original !== "function") return;
    const hadOwn = Object.prototype.hasOwnProperty.call(context, method);
    target[method] = function countedCanvasCall(this: unknown, ...args: unknown[]) {
      if (open) {
        const row = calls[stage];
        if (row !== undefined) row[methodIndex] = (row[methodIndex] ?? 0) + 1;
      }
      return original.apply(this, args);
    };
    restore.push(() => {
      if (hadOwn) target[method] = original;
      else delete (target as Partial<typeof target>)[method];
    });
  });
  renderStageProbe.current = recorder;

  return {
    snapshot: () => ({ capacity: CAPACITY, frameCount, stages: RENDER_STAGES, methods: COUNTED_CANVAS_METHODS, frames: [...frames] }),
    dispose: () => {
      if (renderStageProbe.current === recorder) renderStageProbe.current = null;
      for (const undo of restore) undo();
      frames.length = 0;
    },
  };
}

/** Stage for one object-queue item; only evaluated as an argument of `probe?.enter(...)`. */
export function stageForRenderItem(kind: string): RenderStage {
  switch (kind) {
    case "walker": return "walkers";
    case "construction_site": return "construction";
    case "palisade_segment": return "walls";
    case "bridge_rail": return "bridges";
    case "tree": case "stump": case "groundCover": return "nature";
    default: return "buildings";
  }
}
