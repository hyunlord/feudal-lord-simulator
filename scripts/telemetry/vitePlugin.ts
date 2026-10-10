// Always-on telemetry of the dev build (user decision 2026-09-30): the dev server (`npm run dev`, whoever runs it — the
// user, Astra QA, render captures) injects scripts/telemetry/client.js before the app and stores each 10 s window it
// posts, with the machine's conditions at that moment, in ~/.fls-telemetry/<date>/<host>-<checkout>.jsonl.
//  - Nothing waits and nothing is locked: each server appends to its own file (one line per window).
//  - The server adds what the page cannot see: other work's CPU since the last window, the Mac's hardware input idle
//    time, the checkout's commit and whether it is dirty.
//  - The dev server only (apply: "serve"): the shipped build never carries it. FLS_TELEMETRY=0 turns it off.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFile, mkdirSync, readFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join, resolve } from "node:path";
import { gitPaths } from "../gitPaths.mjs";
import { otherCpuSample, otherCpuShare, type CpuSample } from "../perf/machineLoad";

const CLIENT_PATH = "/@fls-telemetry/client.js"; const SAMPLE_PATH = "/@fls-telemetry/sample";
export const TELEMETRY_DIR = process.env.FLS_TELEMETRY_DIR ?? join(homedir(), ".fls-telemetry");

function hidIdle(): number | null {
  if (process.platform !== "darwin") return null;
  const match = /"HIDIdleTime" = (\d+)/.exec(spawnSync("ioreg", ["-c", "IOHIDSystem", "-d", "4"], { encoding: "utf8" }).stdout ?? "");
  return match === null ? null : Math.round(Number(match[1]) / 1e8) / 10;
}

export function flsTelemetryPlugin() {
  const root = resolve(".");
  const checkout = createHash("sha1").update(root).digest("hex").slice(0, 8);
  let commit = { at: 0, sha: "", dirty: false };
  const head = () => {
    if (Date.now() - commit.at > 60_000) {
      const sha = spawnSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).stdout.trim();
      const dirty = (() => { try { return gitPaths(["status", "--porcelain", "--untracked-files=no"]).length > 0; } catch { return false; } })();
      commit = { at: Date.now(), sha, dirty };
    }
    return commit;
  };
  let cpu: CpuSample | null = null;
  return {
    name: "fls-telemetry",
    apply: "serve" as const,
    transformIndexHtml() {
      if (process.env.FLS_TELEMETRY === "0") return [];
      return [{ tag: "script", attrs: { type: "module", src: CLIENT_PATH }, injectTo: "head-prepend" as const }];
    },
    configureServer(server: { middlewares: { use: (handler: (req: any, res: any, next: () => void) => void) => void } }) {
      if (process.env.FLS_TELEMETRY === "0") return;
      const client = readFileSync(resolve(root, "scripts/telemetry/client.js"), "utf8");
      server.middlewares.use((req, res, next) => {
        if (req.url === CLIENT_PATH) { res.setHeader("content-type", "text/javascript"); res.end(client); return; }
        if (req.url !== SAMPLE_PATH || req.method !== "POST") { next(); return; }
        let body = "";
        req.on("data", (chunk: Buffer) => { body += chunk; if (body.length > 2_000_000) req.destroy(); });
        req.on("end", () => {
          res.statusCode = 204; res.end();
          try {
            const sample = JSON.parse(body);
            const now = otherCpuSample(); const share = cpu === null ? null : Math.round(otherCpuShare(cpu, now) * 100) / 100; cpu = now;
            const { sha, dirty } = head();
            const line = JSON.stringify({ ...sample, host: hostname(), platform: process.platform, checkout: root, commit: sha, dirty,
              machine: { otherCpu: share, hidIdleSeconds: hidIdle(), received: new Date().toISOString() } });
            const day = new Date().toLocaleDateString("sv-SE"); const dir = join(TELEMETRY_DIR, day);
            mkdirSync(dir, { recursive: true });
            appendFile(join(dir, `${hostname().replace(/[^\w.-]/g, "_")}-${checkout}.jsonl`), `${line}\n`, () => {});
          } catch { /* a bad sample is dropped, never an error in the dev server */ }
        });
      });
    },
  };
}
