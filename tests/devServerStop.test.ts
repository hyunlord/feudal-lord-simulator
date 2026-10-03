import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

// Servers a script starts stop with it, however it ends (2026-10-03: capture scripts left 24 Vite servers on the DGX).
// The checks wait for a process to be gone by polling (bounded), never judge a duration.
const repo = resolve(import.meta.dirname, "..");
const alive = (pid: number) => { try { process.kill(pid, 0); } catch { return false; }
  const stat = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" }).stdout.trim(); return stat !== "" && !stat.startsWith("Z"); };
async function gone(pid: number): Promise<boolean> {
  for (let i = 0; i < 100 && alive(pid); i++) await new Promise(done => setTimeout(done, 100));
  return !alive(pid);
}
const readPid = (file: string) => Number(readFileSync(file, "utf8").trim());
async function until(file: string): Promise<void> { for (let i = 0; i < 200 && !existsSync(file); i++) await new Promise(done => setTimeout(done, 50)); }

test("spawnServer's server stops on process.exit, an uncaught error and SIGTERM", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fls-server-process-"));
  try {
    for (const ending of ["exit", "throw", "term"] as const) {
      const pidFile = join(dir, `${ending}.pid`);
      const script = join(dir, `${ending}.ts`);
      writeFileSync(script, [
        `import { writeFileSync } from "node:fs";`,
        `import { spawnServer } from ${JSON.stringify(join(repo, "scripts/serverProcess.ts"))};`,
        `const server = spawnServer(process.execPath, ["-e", "setInterval(() => {}, 1e6)"], { stdio: "ignore" });`,
        `writeFileSync(${JSON.stringify(pidFile)}, String(server.pid));`,
        ending === "exit" ? `setTimeout(() => process.exit(3), 200);` : ending === "throw" ? `setTimeout(() => { throw new Error("capture failed"); }, 200);` : `setInterval(() => {}, 1e6);`,
      ].join("\n"));
      const child = spawn(join(repo, "node_modules/.bin/tsx"), [script], { stdio: "ignore" });
      await until(pidFile);
      const server = readPid(pidFile);
      if (ending === "term") child.kill("SIGTERM");
      await new Promise(done => child.once("exit", done));
      assert.equal(await gone(server), true, `${ending}: the server ${server} is still running`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("devServers.sh stops its servers on a normal end, a set -e failure and TERM, then runs the cleanups", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fls-dev-servers-"));
  try {
    mkdirSync(join(dir, "node_modules/.bin"), { recursive: true });
    writeFileSync(join(dir, "node_modules/.bin/vite"), "#!/bin/sh\nexec sleep 300\n"); chmodSync(join(dir, "node_modules/.bin/vite"), 0o755);
    for (const ending of ["ok", "fail", "term"] as const) {
      const pidFile = join(dir, `${ending}.pid`); const cleaned = join(dir, `${ending}.cleaned`);
      const body = `set -euo pipefail; . ${JSON.stringify(join(repo, "scripts/remote/devServers.sh"))}; cd ${JSON.stringify(dir)}
fls_serve vite.log --port 1 --strictPort; echo "$FLS_SERVE_PID" > ${JSON.stringify(pidFile)}
fls_on_exit 'touch ${cleaned}'
${ending === "fail" ? "false" : ending === "term" ? "while :; do sleep 0.2; done" : "true"}`;
      const child = spawn("bash", ["-c", body], { stdio: "ignore" });
      await until(pidFile);
      const server = readPid(pidFile);
      if (ending === "term") child.kill("SIGTERM");
      const code = await new Promise<number | null>(done => child.once("exit", done));
      assert.equal(code, { ok: 0, fail: 1, term: 143 }[ending]);
      assert.equal(await gone(server), true, `${ending}: the server ${server} is still running`);
      assert.equal(existsSync(cleaned), true, `${ending}: the cleanup did not run`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
