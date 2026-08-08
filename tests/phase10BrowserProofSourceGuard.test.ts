import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { installPhase10ProofRuntime } from "../src/testing/phase10ProofRuntime";

const PROOF_RUNTIME = new URL("../src/testing/phase10ProofRuntime.ts", import.meta.url);
const PROOF_RUNNER = new URL("../scripts/phase10BrowserProofRunner.mjs", import.meta.url);
const PROOF_CDP = new URL("../scripts/phase10BrowserProofCdp.mjs", import.meta.url);

test("Given browser evidence runs When inspecting the local proof port Then no direct tick bypass is exposed", () => {
  assert.doesNotMatch(readFileSync(PROOF_RUNTIME, "utf8"), /advanceTicks|advanceTick|commit_simulation_state/);
});

test("Given the frame budget probe When inspecting browser instrumentation Then callback work is measured instead of refresh interval", () => {
  const source = readFileSync(PROOF_RUNNER, "utf8");
  assert.doesNotMatch(source, /time - previous/);
  assert.match(source, /performance\.now\(\) - startedAt/);
  assert.doesNotMatch(source, /Math\.max\(pendingFrames/);
  assert.match(source, /pendingFrames\.get\(time\).*\+ duration/);
});

test("Given proof navigation When dismissing welcome Then the application-recognized value is stored", () => {
  const source = readFileSync(PROOF_CDP, "utf8");
  assert.match(source, /welcome-dismissed:v1', '1'/);
  assert.doesNotMatch(source, /welcome-dismissed:v1', 'true'/);
});

test("Given a proof tile When resolving its client point Then the canonical diamond center is used", () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  try {
    const dispose = installPhase10ProofRuntime({
      canvas: { getBoundingClientRect: () => ({ left: 11, top: 17 }) } as HTMLCanvasElement,
      cameraRef: { current: { zoom: 2, panX: 5, panY: 7 } },
      stateRef: { current: {} } as never,
      location: { hostname: "localhost", search: "?phase10-proof=1" },
    });
    assert.deepEqual(window.__FEUDAL_PHASE10_PROOF__?.tileClientPoint({ tx: 2, ty: 3 }), {
      clientX: -48,
      clientY: 184,
    });
    dispose();
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});

test("Given timber-chain placement When entering the live loop Then the runner performs its preflight first", () => {
  const source = readFileSync(PROOF_RUNNER, "utf8");
  const placement = source.indexOf("await placeTimberChain");
  const preflight = source.indexOf("assertPlaythroughPreflight", placement);
  const liveLoop = source.indexOf('clickByAria(client, "1배속")', placement);
  assert.ok(placement >= 0 && preflight > placement && liveLoop > preflight);
});

test("Given a carrying walker checkpoint When proving movement Then the same carter must move", () => {
  const source = readFileSync(PROOF_CDP, "utf8");
  assert.match(source, /startHashes\.get\(carter\.id\)/);
  assert.match(source, /startHashes\.set\(carter\.id, hash\)/);
});
