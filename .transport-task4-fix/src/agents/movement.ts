import type { Walker } from "./walker.types";

export function stepWalker(walker: Walker, distance: number): Walker {
  if (distance <= 0 || walker.path === null || walker.path.length === 0) {
    return walker;
  }

  const steps = Math.min(Math.max(1, Math.floor(distance)), walker.path.length);
  const nextPosition = walker.path[steps - 1];
  if (nextPosition === undefined) {
    return walker;
  }
  const remainingPath = walker.path.slice(steps);

  return {
    ...walker,
    tx: nextPosition.tx,
    ty: nextPosition.ty,
    path: remainingPath.length > 0 ? remainingPath : null,
  };
}
