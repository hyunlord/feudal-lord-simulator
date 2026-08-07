import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { spawn } from "node:child_process";

const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseUrl = process.env.PROOF_URL ?? "http://127.0.0.1:3200";
const revision = process.env.PROOF_REVISION ?? "unknown";
const hostLabel = process.env.PROOF_HOST_LABEL ?? "local";
const remoteDebuggingPort = Number.parseInt(process.env.PROOF_CHROME_PORT ?? "9229", 10);
const require = createRequire(import.meta.url);

const userDataDir = await mkdtemp(path.join(tmpdir(), "phase8-task10-chrome-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-dev-shm-usage",
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

async function createCdpClient(webSocketUrl) {
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
      const request = pending.get(message.id);
      if (request === undefined) return;
      pending.delete(message.id);
      if (message.error !== undefined) {
        request.reject(new Error(message.error.message));
      } else {
        request.resolve(message.result);
      }
      return;
    }
    const eventWaiters = waiters.get(message.method);
    if (eventWaiters === undefined || eventWaiters.length === 0) return;
    waiters.set(message.method, []);
    for (const resolve of eventWaiters) resolve(message.params);
  });
  const send = (method, params = {}) => {
    const id = nextId;
    nextId += 1;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  };
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

try {
  await waitForChrome(remoteDebuggingPort);
  const target = await createTarget(remoteDebuggingPort);
  const client = await createCdpClient(target.webSocketDebuggerUrl);
  try {
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: "localStorage.setItem('feudal-lord-simulator:welcome-dismissed:v1', 'true');",
    });
    await navigate(client, baseUrl);
    await waitForCanvas(client);
    const initial = await stableCanvasHash(client);
    const away = await panAwayAndBack(client, {
      fromX: 640,
      fromY: 360,
      toX: 760,
      toY: 430,
    });
    const restored = await stableCanvasHash(client);
    if (initial.hash === away.hash) {
      throw new Error("pan-away canvas hash did not change");
    }
    if (initial.hash !== restored.hash) {
      throw new Error(`pan-back hash mismatch: initial=${initial.hash} restored=${restored.hash}`);
    }
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      hostLabel,
      revision,
      baseUrl,
      userAgent: await userAgent(client),
      viewport: { width: 1280, height: 720 },
      initial,
      away,
      restored,
      identity: initial.hash === restored.hash,
      awayChanged: initial.hash !== away.hash,
    }, null, 2)}\n`);
  } finally {
    client.close();
  }
} finally {
  chrome.kill("SIGTERM");
  await onceExit(chrome);
  await rm(userDataDir, { recursive: true, force: true });
}

async function waitForChrome(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error(`Chrome did not expose CDP on ${port}: ${stderr}`);
}

async function createTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, {
    method: "PUT",
  });
  if (!response.ok) throw new Error(`Unable to create Chrome target: HTTP ${response.status}`);
  return response.json();
}

async function navigate(client, url) {
  const loaded = client.waitFor("Page.loadEventFired");
  await client.send("Page.navigate", { url });
  await loaded;
  await frames(8);
}

async function waitForCanvas(client) {
  await client.evaluate(`(async () => {
    for (let i = 0; i < 120; i += 1) {
      const canvas = document.querySelector("canvas.game-canvas");
      if (canvas !== null && canvas.width > 0 && canvas.height > 0) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("game canvas did not become ready");
  })()`, true);
  await frames(12);
}

async function stableCanvasHash(client) {
  let previous = await canvasHash(client);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await frames(12);
    const next = await canvasHash(client);
    if (next.hash === previous.hash) return next;
    previous = next;
  }
  throw new Error(`canvas hash did not settle; last=${previous.hash}`);
}

async function panAwayAndBack(client, input) {
  return client.evaluate(`(async () => {
    const canvas = document.querySelector("canvas.game-canvas");
    if (canvas === null) throw new Error("game canvas missing");
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("2d context missing");
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const hashCanvas = () => {
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      let hash = 2166136261;
      let visiblePixels = 0;
      for (let index = 0; index < image.data.length; index += 4) {
        hash ^= image.data[index] + (image.data[index + 1] << 8) + (image.data[index + 2] << 16) + (image.data[index + 3] << 24);
        hash = Math.imul(hash, 16777619) >>> 0;
        if (image.data[index + 3] !== 0) visiblePixels += 1;
      }
      return {
        hash: hash.toString(16).padStart(8, "0"),
        width: canvas.width,
        height: canvas.height,
        visiblePixels,
      };
    };
    const keyOptions = { key: " ", code: "Space", bubbles: true, cancelable: true };
    window.dispatchEvent(new KeyboardEvent("keydown", keyOptions));
    canvas.dispatchEvent(new MouseEvent("mousedown", {
      button: 0,
      buttons: 1,
      clientX: ${input.fromX},
      clientY: ${input.fromY},
      bubbles: true,
      cancelable: true,
    }));
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      button: 0,
      buttons: 1,
      clientX: ${input.toX},
      clientY: ${input.toY},
      bubbles: true,
      cancelable: true,
    }));
    await frame();
    await frame();
    const away = hashCanvas();
    canvas.dispatchEvent(new MouseEvent("mousemove", {
      button: 0,
      buttons: 1,
      clientX: ${input.fromX},
      clientY: ${input.fromY},
      bubbles: true,
      cancelable: true,
    }));
    window.dispatchEvent(new MouseEvent("mouseup", {
      button: 0,
      buttons: 0,
      clientX: ${input.fromX},
      clientY: ${input.fromY},
      bubbles: true,
      cancelable: true,
    }));
    window.dispatchEvent(new KeyboardEvent("keyup", keyOptions));
    return away;
  })()`, true);
}

async function canvasHash(client) {
  return client.evaluate(`(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.querySelector("canvas.game-canvas");
    if (canvas === null) throw new Error("game canvas missing");
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("2d context missing");
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    let hash = 2166136261;
    let visiblePixels = 0;
    for (let index = 0; index < image.data.length; index += 4) {
      hash ^= image.data[index] + (image.data[index + 1] << 8) + (image.data[index + 2] << 16) + (image.data[index + 3] << 24);
      hash = Math.imul(hash, 16777619) >>> 0;
      if (image.data[index + 3] !== 0) visiblePixels += 1;
    }
    return {
      hash: hash.toString(16).padStart(8, "0"),
      width: canvas.width,
      height: canvas.height,
      visiblePixels,
    };
  })()`, true);
}

async function userAgent(client) {
  return client.evaluate("navigator.userAgent", false);
}

async function frames(count) {
  await delay(Math.max(50, count * 16));
}

async function onceExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(2_000).then(() => {
      child.kill("SIGKILL");
    }),
  ]);
}
