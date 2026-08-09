import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { waitForChrome } from "../scripts/phase13Part7BuildMenuProofChrome.js";

type MockChrome = EventEmitter & {
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
};

type FetchStep = number | Error;

function createFetchSequence(steps: readonly FetchStep[]): {
  readonly calls: () => number;
  readonly fetch: typeof fetch;
} {
  let callCount = 0;
  return {
    calls: () => callCount,
    fetch: async () => {
      const step = steps[Math.min(callCount, steps.length - 1)] ?? 503;
      callCount += 1;
      if (step instanceof Error) throw step;
      return new Response("", { status: step });
    },
  };
}

function createMockChrome(): MockChrome {
  const chrome = new EventEmitter() as MockChrome;
  chrome.exitCode = null;
  chrome.signalCode = null;
  return chrome;
}

test("Given Chrome starts slowly When the readiness window is configurable Then waitForChrome resolves on a later poll", async () => {
  const { calls, fetch } = createFetchSequence([
    new Error("connect ECONNREFUSED 127.0.0.1:9222"),
    new Error("connect ECONNREFUSED 127.0.0.1:9222"),
    200,
  ]);

  await waitForChrome(9222, () => "slow-start stderr", {
    fetch,
    maxAttempts: 3,
    pollMs: 1,
  });

  assert.equal(calls(), 3);
});

test("Given Chrome never exposes CDP When the readiness window is short Then waitForChrome fails quickly with stderr", async () => {
  const { calls, fetch } = createFetchSequence([503, 503]);

  await assert.rejects(
    waitForChrome(9223, () => "blocked stderr", {
      fetch,
      maxAttempts: 2,
      pollMs: 1,
    }),
    /Chrome did not expose CDP on 9223: blocked stderr/,
  );

  assert.equal(calls(), 2);
});

test("Given Chrome exits before exposing CDP When waitForChrome watches the child Then it reports the exit code", async () => {
  const chrome = createMockChrome();

  const wait = waitForChrome(9224, () => "exit stderr", {
    chrome,
    fetch: async () => new Response("", { status: 503 }),
    maxAttempts: 10,
    pollMs: 1,
  });

  queueMicrotask(() => {
    chrome.exitCode = 1;
    chrome.emit("exit", 1, null);
  });

  await assert.rejects(wait, /Chrome (?:stopped|exited) before exposing CDP on 9224 \(exit code 1\): exit stderr/);
});

test("Given Chrome fails to spawn When waitForChrome watches the child Then it reports the spawn error", async () => {
  const chrome = createMockChrome();

  const wait = waitForChrome(9225, () => "spawn stderr", {
    chrome,
    fetch: async () => new Response("", { status: 503 }),
    maxAttempts: 10,
    pollMs: 1,
  });

  queueMicrotask(() => {
    chrome.emit("error", new Error("spawn failed"));
  });

  await assert.rejects(wait, /Chrome failed before exposing CDP on 9225: spawn failed: spawn stderr/);
});

test("Given Pages tests run on Node 20 When CDP uses the global WebSocket Then CI enables the Node 20 WebSocket flag", async () => {
  const workflow = await readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");

  assert.match(
    workflow,
    /- name: Test\n\s+run: npm test\n\s+env:\n\s+NODE_OPTIONS: --experimental-websocket/,
  );
});
