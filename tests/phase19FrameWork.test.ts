import assert from "node:assert/strict";
import test from "node:test";
import { installProofFrameWork, proofFrameWork } from "../src/testing/proofFrameWork";
import { createFixedTickLoop } from "../src/state/fixedTickLoop";
import { installPhase10ProofRuntime } from "../src/testing/phase10ProofRuntime";
import { createEconomyHarnessScenario } from "../scripts/economyHarnessScenario";

function install(search = "?phase10-proof=1"): () => void {
  return installPhase10ProofRuntime({
    canvas: {} as HTMLCanvasElement,
    cameraRef: { current: { zoom: 1, panX: 0, panY: 0 } },
    stateRef: { current: createEconomyHarnessScenario({ seed: 3 }) },
    location: { hostname: "localhost", search },
  });
}

test("Given normal play When the proof runtime is installed Then no proof port is exposed", () => {
  const previous = globalThis.window;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  const dispose = install("");
  try { assert.equal(window.__FEUDAL_PHASE10_PROOF__, undefined); }
  finally { dispose(); Object.defineProperty(globalThis, "window", { configurable: true, value: previous }); }
});

test("Given proof mode When diagnosis is read Then both work channels start empty", () => {
  const previous = globalThis.window;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  const dispose = install();
  try {
    const diagnosis = window.__FEUDAL_PHASE10_PROOF__?.diagnosis();
    assert.ok(diagnosis);
    assert.deepEqual(Reflect.get(diagnosis, "work"), {
      capacity: 240, frameCount: 0, tickCount: 0, frameWorkMs: [], tickWorkMs: [],
    });
  } finally { dispose(); Object.defineProperty(globalThis, "window", { configurable: true, value: previous }); }
});

test("Given more than 240 samples When the collector is read Then each channel retains ordered recent work and total counts", () => {
  const probe = installProofFrameWork();
  try {
    for (let value = 1; value <= 257; value += 1) probe.recordFrame(value);
    probe.recordTick(0.25);
    const snapshot = probe.snapshot();
    assert.equal(snapshot.frameCount, 257);
    assert.equal(snapshot.tickCount, 1);
    assert.deepEqual(snapshot.frameWorkMs, Array.from({ length: 240 }, (_, index) => index + 18));
    assert.deepEqual(snapshot.tickWorkMs, [0.25]);
    probe.recordFrame(258);
    assert.equal(snapshot.frameWorkMs.at(-1), 257);
  } finally { probe.dispose(); }
});

test("Given StrictMode cleanup and replacement When an old owner disposes Then the new session retains its samples", () => {
  const previous = installProofFrameWork();
  previous.recordFrame(2);
  const replacement = installProofFrameWork();
  replacement.recordTick(3);
  previous.dispose();
  try {
    assert.equal(previous.snapshot().frameCount, 0);
    assert.deepEqual(proofFrameWork.current?.snapshot().tickWorkMs, [3]);
  } finally { replacement.dispose(); }
  assert.equal(proofFrameWork.current, null);
  const remounted = installProofFrameWork();
  try { assert.equal(remounted.snapshot().tickCount, 0); }
  finally { remounted.dispose(); }
});

function tickHarness() {
  let callback: ((timestamp: number) => void) | undefined;
  let state = createEconomyHarnessScenario({ seed: 3 });
  let speed: 0 | 1 | 5 = 1;
  const loop = createFixedTickLoop({
    scheduler: { request: (next) => { callback = next; return 1; }, cancel: () => { callback = undefined; } },
    getState: () => state,
    getSpeed: () => speed,
    commit: (_, next) => { state = next; },
  });
  return { loop, run: (timestamp: number) => { assert.ok(callback); callback(timestamp); },
    pause: () => { speed = 0; }, tick: () => state.tick };
}

test("Given an existing loop and later proof install When five engine ticks run Then each actual tick has one duration", (context) => {
  const harness = tickHarness();
  harness.loop.start();
  harness.run(0);
  const probe = installProofFrameWork();
  let clock = 0;
  context.mock.method(performance, "now", () => ++clock);
  try {
    harness.run(1000);
    assert.equal(harness.tick(), 5);
    assert.deepEqual(probe.snapshot().tickWorkMs, [1, 1, 1, 1, 1]);
    harness.pause();
    harness.run(2000);
    assert.equal(probe.snapshot().tickCount, 5);
  } finally { harness.loop.stop(); probe.dispose(); }
});

test("Given normal play When actual ticks run Then instrumentation does not read the clock", (context) => {
  const harness = tickHarness();
  const clock = context.mock.method(performance, "now", () => 0);
  harness.loop.start();
  try {
    harness.run(0);
    harness.run(1000);
    assert.equal(harness.tick(), 5);
    assert.equal(clock.mock.callCount(), 0);
  } finally { harness.loop.stop(); }
});

test("Given an active proof port When a replacement mounts and the old port cleans up Then only the replacement owns collection", () => {
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  const disposeOld = install();
  proofFrameWork.current?.recordTick(4);
  const oldPort = window.__FEUDAL_PHASE10_PROOF__;
  const disposeNew = install();
  const newPort = window.__FEUDAL_PHASE10_PROOF__;
  disposeOld();
  try {
    assert.equal(window.__FEUDAL_PHASE10_PROOF__, newPort);
    assert.equal(oldPort?.diagnosis().work.tickCount, 0);
    proofFrameWork.current?.recordFrame(2);
    assert.deepEqual(newPort?.diagnosis().work.frameWorkMs, [2]);
    assert.equal(newPort?.diagnosis().work.tickCount, 0);
  } finally {
    disposeNew();
    assert.equal(window.__FEUDAL_PHASE10_PROOF__, undefined);
    assert.equal(proofFrameWork.current, null);
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});
