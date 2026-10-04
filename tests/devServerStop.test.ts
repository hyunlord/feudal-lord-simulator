import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

// Servers a script starts stop with it, however it ends (2026-10-03: capture scripts left 24 Vite servers on the DGX).
// RR9: every wait here is for a state — the pid file written, the signalled process gone — polled until it holds. The
// cap (5 minutes) only ends a hung test; it is no time budget. The first version waited 10 s for each and failed in
// clean clones at DGX load 20 (pid file after 12 s, a server gone after 47 s) while passing alone.
const repo = resolve(import.meta.dirname, "..");
const CAP_MS = 5 * 60_000;
const pause = (ms: number) => new Promise(done => setTimeout(done, ms));
const alive = (pid: number) => { try { process.kill(pid, 0); } catch { return false; }
  const stat = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" }).stdout.trim(); return stat !== "" && !stat.startsWith("Z"); };
async function gone(pid: number): Promise<boolean> {
  for (const end = Date.now() + CAP_MS; alive(pid) && Date.now() < end;) await pause(100);
  return !alive(pid);
}
/** The child's exit code, whether it has already ended or ends later. */
const ended = (child: ChildProcess) => child.exitCode !== null || child.signalCode !== null ? Promise.resolve(child.exitCode)
  : new Promise<number | null>(done => child.once("exit", code => done(code)));
const readPid = (file: string) => Number(readFileSync(file, "utf8").trim());
/** Waits until the child wrote its pid file, or ended without writing it (then the assertion names that). */
async function written(file: string, child: ChildProcess): Promise<void> {
  for (const end = Date.now() + CAP_MS; !existsSync(file) && child.exitCode === null && child.signalCode === null && Date.now() < end;) await pause(50);
  assert.equal(existsSync(file), true, `${file} was never written (child exit ${child.exitCode ?? child.signalCode})`);
}

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
      // node --import tsx: the process the test signals is the script itself, as when a stopped DGX run's scope sends
      // TERM to every process. Through the tsx CLI the signal has to be relayed to its child, and at DGX load 30 that
      // relay never came (the server was still there after 5 minutes).
      const child = spawn(process.execPath, ["--import", "tsx", script], { cwd: repo, stdio: "ignore" });
      await written(pidFile, child);
      const server = readPid(pidFile);
      if (ending === "term") child.kill("SIGTERM");
      await ended(child);
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
      await written(pidFile, child);
      const server = readPid(pidFile);
      if (ending === "term") child.kill("SIGTERM");
      const code = await ended(child);
      assert.equal(code, { ok: 0, fail: 1, term: 143 }[ending]);
      assert.equal(await gone(server), true, `${ending}: the server ${server} is still running`);
      assert.equal(existsSync(cleaned), true, `${ending}: the cleanup did not run`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
