export interface HarnessMetric {
  readonly label: string;
  readonly value: string;
  readonly status: "PASS" | "FAIL";
}

export function harnessMetric(label: string, value: string, passing: boolean): HarnessMetric {
  return { label, value, status: passing ? "PASS" : "FAIL" };
}
