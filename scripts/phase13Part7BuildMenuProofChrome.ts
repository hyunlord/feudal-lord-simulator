import { spawn, type ChildProcess } from "node:child_process";
import type { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export type ChromeSession = {
  readonly chrome: ChildProcess;
  readonly userDataDir: string;
  readonly stderr: () => string;
};

export type CdpClient = {
  readonly send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  readonly evaluate: (expression: string, awaitPromise: boolean) => Promise<unknown>;
  readonly close: () => void;
};

type ChromeStartupWatch = Pick<EventEmitter, "once" | "removeListener"> & {
  readonly exitCode: number | null;
  readonly signalCode: NodeJS.Signals | null;
};

type ChromeStartupEvent =
  | {
      readonly kind: "error";
      readonly error: Error;
    }
  | {
      readonly kind: "exit";
      readonly code: number | null;
      readonly signal: NodeJS.Signals | null;
    };

export function defaultChromePath(platform: NodeJS.Platform = process.platform): string {
  if (platform === "darwin") return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (platform === "linux") return "/usr/bin/google-chrome";
  throw new Error(`CHROME_PATH is required on ${platform}`);
}

type CdpPendingRequest = {
  readonly resolve: (value: Record<string, unknown>) => void;
  readonly reject: (reason: Error) => void;
};

export async function launchChrome(input: {
  readonly chromePath: string;
  readonly remoteDebuggingPort: number;
  readonly userDataPrefix: string;
  readonly extraArgs?: readonly string[];
}): Promise<ChromeSession> {
  const userDataDir = await mkdtemp(path.join(tmpdir(), input.userDataPrefix));
  const chrome = spawn(input.chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    ...(input.extraArgs ?? []),
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${input.remoteDebuggingPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  chrome.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  return { chrome, userDataDir, stderr: () => stderr };
}

export async function closeChrome(
  session: ChromeSession,
  options: { readonly killAfterMs?: number; readonly remove?: typeof rm } = {},
): Promise<void> {
  if (session.chrome.exitCode === null && session.chrome.signalCode === null) {
    const exitPromise = new Promise<void>((resolve) => session.chrome.once("exit", resolve));
    session.chrome.kill("SIGTERM");
    await Promise.race([
      exitPromise,
      delay(options.killAfterMs ?? 2_000).then(async () => {
        if (session.chrome.exitCode === null && session.chrome.signalCode === null) {
          session.chrome.kill("SIGKILL");
        }
        await exitPromise;
      }),
    ]);
  }
  await removeChromeProfile(session.userDataDir, options.remove ?? rm);
}

export async function removeChromeProfile(userDataDir: string, remove: typeof rm = rm): Promise<void> {
  await remove(userDataDir, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}

export async function waitForChrome(
  port: number,
  stderr: () => string,
  options: {
    readonly chrome?: ChromeStartupWatch;
    readonly fetch?: typeof fetch;
    readonly maxAttempts?: number;
    readonly pollMs?: number;
  } = {},
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 180;
  const pollMs = options.pollMs ?? 100;
  const fetchImpl = options.fetch ?? fetch;
  const startupWatch = options.chrome === undefined ? null : createChromeStartupWatch(options.chrome);

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (options.chrome !== undefined && (options.chrome.exitCode !== null || options.chrome.signalCode !== null)) {
        throw chromeStoppedError(port, options.chrome, stderr());
      }

      const responseOrEvent = startupWatch === null
        ? await fetchImpl(`http://127.0.0.1:${port}/json/version`).catch(() => null)
        : await Promise.race([
            fetchImpl(`http://127.0.0.1:${port}/json/version`).catch(() => null),
            startupWatch.promise,
          ]);
      if (responseOrEvent !== null && isChromeStartupEvent(responseOrEvent)) {
        throw chromeStartupError(port, responseOrEvent, stderr());
      }
      if (responseOrEvent !== null && responseOrEvent.ok) return;

      if (options.chrome !== undefined && (options.chrome.exitCode !== null || options.chrome.signalCode !== null)) {
        throw chromeStoppedError(port, options.chrome, stderr());
      }

      const sleepOrEvent = startupWatch === null
        ? await delay(pollMs).then(() => null)
        : await Promise.race([
            delay(pollMs).then(() => null),
            startupWatch.promise,
          ]);
      if (isChromeStartupEvent(sleepOrEvent)) {
        throw chromeStartupError(port, sleepOrEvent, stderr());
      }
    }
  } finally {
    startupWatch?.cleanup();
  }

  throw new Error(`Chrome did not expose CDP on ${port}: ${stderr()}`);
}

function createChromeStartupWatch(chrome: ChromeStartupWatch): {
  readonly cleanup: () => void;
  readonly promise: Promise<ChromeStartupEvent>;
} {
  let cleanup = () => {};
  const promise = new Promise<ChromeStartupEvent>((resolve) => {
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      resolve({ kind: "exit", code, signal });
    };
    const onError = (error: Error) => {
      cleanup();
      resolve({ kind: "error", error });
    };
    cleanup = () => {
      chrome.removeListener("exit", onExit);
      chrome.removeListener("error", onError);
    };
    chrome.once("exit", onExit);
    chrome.once("error", onError);
  });
  return { cleanup, promise };
}

function chromeStoppedError(port: number, chrome: ChromeStartupWatch, stderr: string): Error {
  const event: ChromeStartupEvent = chrome.exitCode !== null
    ? { kind: "exit", code: chrome.exitCode, signal: null }
    : { kind: "exit", code: null, signal: chrome.signalCode };
  return chromeStartupError(port, event, stderr);
}

function chromeStartupError(port: number, event: ChromeStartupEvent, stderr: string): Error {
  if (event.kind === "error") {
    return new Error(`Chrome failed before exposing CDP on ${port}: ${event.error.message}: ${stderr}`);
  }
  const exitState = event.code !== null
    ? `exit code ${event.code}`
    : event.signal !== null
      ? `signal ${event.signal}`
      : "unknown exit state";
  return new Error(`Chrome exited before exposing CDP on ${port} (${exitState}): ${stderr}`);
}

function isChromeStartupEvent(value: unknown): value is ChromeStartupEvent {
  return isRecord(value) && (value.kind === "error" || value.kind === "exit");
}

export async function createTarget(port: number, url: string): Promise<{ readonly webSocketDebuggerUrl: string }> {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!response.ok) throw new Error(`Unable to create Chrome target: HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.webSocketDebuggerUrl !== "string") {
    throw new Error("Chrome target response did not include webSocketDebuggerUrl");
  }
  return { webSocketDebuggerUrl: body.webSocketDebuggerUrl };
}

export async function createCdpClient(webSocketUrl: string): Promise<CdpClient> {
  if (globalThis.WebSocket === undefined) {
    throw new Error("global WebSocket is unavailable in this Node runtime");
  }
  const socket = new WebSocket(webSocketUrl);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error("CDP WebSocket failed to open")), { once: true });
  });

  let nextId = 1;
  const pending = new Map<number, CdpPendingRequest>();
  socket.addEventListener("message", (event) => {
    const message = cdpMessageFromEventData(event.data);
    const id = typeof message.id === "number" ? message.id : null;
    if (id === null) return;
    const request = pending.get(id);
    if (request === undefined) return;
    pending.delete(id);
    if (isRecord(message.error) && typeof message.error.message === "string") {
      request.reject(new Error(message.error.message));
      return;
    }
    request.resolve(message);
  });

  const send = (method: string, params: Record<string, unknown> = {}) => {
    const id = nextId;
    nextId += 1;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise<Record<string, unknown>>((resolve, reject) => {
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
        throw new Error("Runtime.evaluate failed");
      }
      const result = response.result;
      if (!isRecord(result) || !isRecord(result.result)) return undefined;
      return result.result.value;
    },
    close: () => socket.close(),
  };
}

function cdpMessageFromEventData(data: MessageEvent["data"]): Record<string, unknown> {
  if (typeof data !== "string") throw new Error("CDP message was not a string");
  const parsed: unknown = JSON.parse(data);
  if (!isRecord(parsed)) throw new Error("CDP message was not an object");
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
