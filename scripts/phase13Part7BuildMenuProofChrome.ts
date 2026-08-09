import { spawn, type ChildProcess } from "node:child_process";
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

export async function closeChrome(session: ChromeSession): Promise<void> {
  session.chrome.kill("SIGTERM");
  if (session.chrome.exitCode === null && session.chrome.signalCode === null) {
    await Promise.race([
      new Promise((resolve) => session.chrome.once("exit", resolve)),
      delay(2_000).then(() => {
        session.chrome.kill("SIGKILL");
      }),
    ]);
  }
  await rm(session.userDataDir, { recursive: true, force: true });
}

export async function waitForChrome(port: number, stderr: () => string): Promise<void> {
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
