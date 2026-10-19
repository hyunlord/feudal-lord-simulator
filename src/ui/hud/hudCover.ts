// LS1-16 (render-VIS-checkup-d7f391e: the wall works' tag "성벽 21" under the rail's chip): the HUD's rail areas over the
// map — the event chips and the crisis icons — for the canvas's tags to keep out of. Elements register by a callback
// ref; their boxes (in the app shell's, i.e. the canvas's, coordinates) are read at most every REFRESH_MS.

export type CoverBox = Readonly<{ x: number; y: number; w: number; h: number }>;

const REFRESH_MS = 250;
const elements = new Map<string, HTMLElement>();
const refs = new Map<string, (element: HTMLElement | null) => void>();
let cache: readonly CoverBox[] = [];
let readAt = -Infinity;

/** A stable callback ref that registers the element under `key` while it is mounted. */
export function hudCoverRef(key: string): (element: HTMLElement | null) => void {
  let ref = refs.get(key);
  if (ref === undefined) {
    ref = element => { if (element === null) elements.delete(key); else elements.set(key, element); readAt = -Infinity; };
    refs.set(key, ref);
  }
  return ref;
}

/** The registered areas now (re-read when older than REFRESH_MS). */
export function hudCovers(now: number = typeof performance === "undefined" ? 0 : performance.now()): readonly CoverBox[] {
  if (now - readAt <= REFRESH_MS) return cache;
  readAt = now;
  cache = [...elements.values()].flatMap(element => {
    const box = element.getBoundingClientRect();
    const shell = element.closest(".app-shell")?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return box.width * box.height > 0 ? [{ x: box.left - shell.left, y: box.top - shell.top, w: box.width, h: box.height }] : [];
  });
  return cache;
}

/** Whether a box meets any of the areas. */
export function coversBox(box: CoverBox, covers: readonly CoverBox[]): boolean {
  return covers.some(cover => box.x < cover.x + cover.w && box.x + box.w > cover.x && box.y < cover.y + cover.h && box.y + box.h > cover.y);
}
