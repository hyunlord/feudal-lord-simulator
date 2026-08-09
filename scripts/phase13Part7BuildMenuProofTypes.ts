import type { AccessibilityGroup } from "./phase13Part7BuildMenuProofAccessibility.js";

export type BrowserProof = {
  readonly verdict: "PASS" | "FAIL";
  readonly failures: readonly string[];
  readonly measurements: unknown;
};

export type BrowserViewportMeasurement = {
  readonly viewport: Viewport;
  readonly accessibilityGroups: readonly AccessibilityGroup[];
  readonly [key: string]: unknown;
};

export type Viewport = {
  readonly width: number;
  readonly height: number;
};
