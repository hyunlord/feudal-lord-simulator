export type WorldSpriteDrawReason = "meta_missing" | "image_missing" | "culled" | "drawn";

export type WorldSpriteDrawEvent = {
  readonly key: string;
  readonly drawn: boolean;
  readonly reason: WorldSpriteDrawReason;
};

export type WorldSpriteDrawProbe = {
  readonly snapshot: () => { readonly recent: readonly WorldSpriteDrawEvent[] };
  readonly dispose: () => void;
};

const MAX_RECENT_DRAWS = 128;
let activeEvents: WorldSpriteDrawEvent[] | null = null;

export function installWorldSpriteDrawProbe(): WorldSpriteDrawProbe {
  const events: WorldSpriteDrawEvent[] = [];
  activeEvents = events;
  return {
    snapshot: () => ({ recent: [...events] }),
    dispose: () => {
      if (activeEvents === events) activeEvents = null;
    },
  };
}

export function recordWorldSpriteDraw(event: WorldSpriteDrawEvent): void {
  if (activeEvents === null || activeEvents.length >= MAX_RECENT_DRAWS) return;
  activeEvents.push(event);
}
