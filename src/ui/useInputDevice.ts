import { useSyncExternalStore } from "react";
import { lastInputDevice, subscribeInputDevice, type InputDevice } from "../input/inputDevice";

/**
 * INSTALL-23 ⑤: the device the player used last (TOUCH-1 `inputDevice.ts`), re-rendering on a change: a gamepad draws
 * the hints with pad glyphs, the mouse and keyboard with key names. The server snapshot reads the same value (a static
 * render shows the device reported so far).
 */
export function useInputDevice(): InputDevice {
  return useSyncExternalStore(subscribeInputDevice, lastInputDevice, lastInputDevice);
}
