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
