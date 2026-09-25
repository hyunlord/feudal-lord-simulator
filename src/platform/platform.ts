import type { PlatformServices } from "./PlatformServices";
import { webPlatformServices } from "./webPlatform";

// The platform services of this run (B9): the web implementation unless a test or another host installed its own.
let current: PlatformServices | null = null;

export function platformServices(): PlatformServices {
  return current ??= webPlatformServices();
}

/** Tests (and future hosts) only; null goes back to the web implementation. */
export function setPlatformServicesForTest(services: PlatformServices | null): void {
  current = services;
}
