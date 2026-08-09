import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const PROOF_SCRIPT = new URL("../scripts/phase13Part7BuildMenuBrowserProof.ts", import.meta.url);

const PROOF_ERAS = ["hamlet", "stone_town"] as const;

test("Given desktop tablet and mobile Part7 browser proof When Chrome measures each era build menu Then labels semantics and rows fit without scroll", () => {
  // Given
  const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

  for (const proofEra of PROOF_ERAS) {
    const chromePort = String(9_400 + (process.pid % 1_000) + PROOF_ERAS.indexOf(proofEra));

    // When
    const result = spawnSync(
      "npx",
      ["tsx", PROOF_SCRIPT.pathname],
      {
        cwd: new URL("..", import.meta.url).pathname,
        env: {
          ...process.env,
          CHROME_PATH: chromePath,
          PART7_PROOF_CHROME_PORT: chromePort,
          PART7_PROOF_ERA: proofEra,
        },
        encoding: "utf8",
        timeout: 45_000,
      },
    );

    // Then
    assert.equal(result.status, 0, `${proofEra}\n${result.stderr}\n${result.stdout}`);
    const proof: unknown = JSON.parse(result.stdout);
    assert.ok(isProofVerdict(proof));
    assert.equal(proof.verdict, "PASS", proofEra);
    assertCompactAccessibilityGroups(proof, proofEra);
  }
});

function isProofVerdict(value: unknown): value is { readonly verdict: unknown } {
  return typeof value === "object" && value !== null && "verdict" in value;
}

function assertCompactAccessibilityGroups(proof: { readonly verdict: unknown }, proofEra: string): void {
  const entries = collectMeasurements(proof);
  const compactEntries = entries.filter((entry) => entry.viewport.width === 768 || entry.viewport.width === 375);
  assert.equal(compactEntries.length, 2, `${proofEra} compact AX viewport count`);

  for (const entry of compactEntries) {
    assert.deepEqual(
      entry.accessibilityGroups.map((group) => group.name),
      expectedGroupNames(proofEra),
      `${proofEra} ${entry.viewport.width}px AX group names`,
    );
    assert.ok(
      entry.accessibilityGroups.every((group) => group.role === "group"),
      `${proofEra} ${entry.viewport.width}px AX roles`,
    );
  }
}

function collectMeasurements(value: unknown): readonly BrowserMeasurement[] {
  if (Array.isArray(value)) return value.flatMap((entry) => collectMeasurements(entry));
  if (isBrowserMeasurement(value)) return [value];
  if (!isRecord(value) || !Array.isArray(value.measurements)) return [];
  return value.measurements.flatMap((measurement) => collectMeasurements(measurement));
}

function isBrowserMeasurement(value: unknown): value is BrowserMeasurement {
  if (!isRecord(value) || !isViewport(value.viewport) || !Array.isArray(value.accessibilityGroups)) return false;
  return value.accessibilityGroups.every(isAccessibilityGroup);
}

function isViewport(value: unknown): value is { readonly width: number } {
  return isRecord(value) && typeof value.width === "number";
}

function isAccessibilityGroup(value: unknown): value is { readonly role: "group"; readonly name: string } {
  return isRecord(value) && value.role === "group" && typeof value.name === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function expectedGroupNames(proofEra: string): readonly string[] {
  if (proofEra === "hamlet" || proofEra === "stone_town") {
    return ["건설 도장", "주거 도구", "생산 도구", "저장 도구", "서비스 도구", "길 도구"];
  }
  throw new Error(`unexpected proof era: ${proofEra}`);
}

type BrowserMeasurement = {
  readonly viewport: { readonly width: number };
  readonly accessibilityGroups: readonly { readonly role: "group"; readonly name: string }[];
};
