import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);

export async function launchChrome({
  chromePath,
  remoteDebuggingPort,
  userDataPrefix,
  extraArgs = [],
}) {
  const userDataDir = await mkdtemp(path.join(tmpdir(), userDataPrefix));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    ...extraArgs,
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let stderr = "";
  chrome.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  return {
    chrome,
    userDataDir,
    stderr: () => stderr,
  };
}

export async function closeChrome({ chrome, userDataDir }) {
  chrome.kill("SIGTERM");
  if (chrome.exitCode === null && chrome.signalCode === null) {
    await Promise.race([
      new Promise((resolve) => chrome.once("exit", resolve)),
      delay(2_000).then(() => {
        chrome.kill("SIGKILL");
      }),
    ]);
  }
  await rm(userDataDir, { recursive: true, force: true });
}

export async function waitForChrome(port, stderr) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error(`Chrome did not expose CDP on ${port}: ${stderr()}`);
}

export async function createTarget(port, url = "about:blank") {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!response.ok) throw new Error(`Unable to create Chrome target: HTTP ${response.status}`);
  return response.json();
}

export async function createCdpClient(webSocketUrl) {
  const WebSocketConstructor = globalThis.WebSocket ?? require(process.env.WS_MODULE_PATH ?? "ws");
  const socket = new WebSocketConstructor(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const waiters = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      settleRequest(pending, message);
      return;
    }
    resolveWaiters(waiters, message);
  });

  function send(method, params = {}) {
    const id = nextId;
    nextId += 1;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  }

  return {
    send,
    evaluate: async (expression, awaitPromise) => {
      const response = await send("Runtime.evaluate", {
        expression,
        awaitPromise,
        returnByValue: true,
      });
      if (response.exceptionDetails !== undefined) {
        throw new Error(response.exceptionDetails.text ?? "Runtime.evaluate failed");
      }
      return response.result.value;
    },
    waitFor: (method) => new Promise((resolve) => {
      const eventWaiters = waiters.get(method) ?? [];
      eventWaiters.push(resolve);
      waiters.set(method, eventWaiters);
    }),
    close: () => socket.close(),
  };
}

export async function frames(count) {
  await delay(Math.max(50, count * 16));
}

function settleRequest(pending, message) {
  const request = pending.get(message.id);
  if (request === undefined) return;
  pending.delete(message.id);
  if (message.error !== undefined) {
    request.reject(new Error(message.error.message));
    return;
  }
  request.resolve(message.result);
}

function resolveWaiters(waiters, message) {
  const eventWaiters = waiters.get(message.method);
  if (eventWaiters === undefined || eventWaiters.length === 0) return;
  waiters.set(message.method, []);
  for (const resolve of eventWaiters) resolve(message.params);
}
