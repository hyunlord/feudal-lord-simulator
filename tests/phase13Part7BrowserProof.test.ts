import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const PROOF_SCRIPT = new URL("../scripts/phase13Part7BuildMenuBrowserProof.ts", import.meta.url);

test("Given 1280px and 920px Part7 browser proof When Chrome measures the stone-town build menu Then labels and rows fit without scroll", () => {
  // Given
  const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const chromePort = String(9_400 + (process.pid % 1_000));

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
      },
      encoding: "utf8",
      timeout: 45_000,
    },
  );

  // Then
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  const proof: unknown = JSON.parse(result.stdout);
  assert.ok(isProofVerdict(proof));
  assert.equal(proof.verdict, "PASS");
});

function isProofVerdict(value: unknown): value is { readonly verdict: unknown } {
  return typeof value === "object" && value !== null && "verdict" in value;
}
