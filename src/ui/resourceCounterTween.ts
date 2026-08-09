export const RESOURCE_COUNTER_TWEEN_MS = 300;

export type ResourceCounterValues = Readonly<Record<string, number>>;

export type ResourceCounterTween = Readonly<{
  from: ResourceCounterValues;
  target: ResourceCounterValues;
  startedAtMs: number;
}>;

export function createResourceCounterTween(
  values: ResourceCounterValues,
  nowMs: number,
): ResourceCounterTween {
  return { from: copyValues(values), target: copyValues(values), startedAtMs: nowMs };
}

export function retargetResourceCounterTween(
  tween: ResourceCounterTween,
  target: ResourceCounterValues,
  nowMs: number,
): ResourceCounterTween {
  if (sameValues(tween.target, target)) return tween;
  return {
    from: resourceCounterValues(tween, nowMs),
    target: copyValues(target),
    startedAtMs: nowMs,
  };
}

export function resourceCounterValues(
  tween: ResourceCounterTween,
  nowMs: number,
): Record<string, number> {
  const elapsedMs = Math.max(0, nowMs - tween.startedAtMs);
  const progress = Math.min(1, elapsedMs / RESOURCE_COUNTER_TWEEN_MS);
  const eased = 1 - (1 - progress) ** 3;
  const values = copyValues(tween.target);
  for (const key of Object.keys(values)) {
    const from = tween.from[key] ?? 0;
    const target = tween.target[key] ?? 0;
    const delta = target - from;
    const interpolated = from + (delta * eased);
    values[key] = progress >= 1
      ? target
      : delta > 0
        ? Math.floor(interpolated)
        : Math.ceil(interpolated);
  }
  return values;
}

function sameValues(left: ResourceCounterValues, right: ResourceCounterValues): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((left[key] ?? 0) !== (right[key] ?? 0)) return false;
  }
  return true;
}

function copyValues(values: ResourceCounterValues): Record<string, number> {
  return { ...values };
}
