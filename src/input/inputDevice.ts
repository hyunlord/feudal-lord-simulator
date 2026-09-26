// The last input device (TOUCH-1): the one the player touched last, for the bottom hint line and the map cursor.
// Translators report it; the UI subscribes. Mouse and keyboard count as one device.

export type InputDevice = "mouse" | "touch" | "gamepad";

type Listener = (device: InputDevice) => void;

let current: InputDevice = "mouse";
const listeners = new Set<Listener>();

export function lastInputDevice(): InputDevice { return current; }

export function reportInputDevice(device: InputDevice): void {
  if (device === current) return;
  current = device;
  for (const listener of [...listeners]) listener(device);
}

export function subscribeInputDevice(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// UX-0b: when the player last pressed anything (the map or a control), so a modal that opens on its own (the season
// ledger card) waits for a press in flight instead of swallowing it. Only the time is kept; nothing reaches the game.
let lastPress = Number.NEGATIVE_INFINITY;
export function lastPressAt(): number { return lastPress; }

/** Records every pointer press on the page (capture phase). Returns the unbind. */
export function bindPressClock(target: Pick<Window, "addEventListener" | "removeEventListener"> = window, now: () => number = () => performance.now()): () => void {
  const note = () => { lastPress = now(); };
  target.addEventListener("pointerdown", note, true);
  return () => target.removeEventListener("pointerdown", note, true);
}
