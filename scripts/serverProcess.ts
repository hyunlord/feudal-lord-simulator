// Servers a script starts (Vite dev or preview) that stop with the script, however it ends: spawnServer is spawn()
// plus a hook that kills every server still running when the process exits — a normal end, process.exit() (which
// skips the callers' finally), an uncaught error, or SIGINT/SIGTERM/SIGHUP (a stopped DGX run, Ctrl-C). Where process
// groups exist the server leads its own (detached), so its children go with it.
// Why (2026-10-03): capture scripts left Vite servers behind on the DGX (24 at once); the callers' finally { kill() }
// does not run when the script is killed or calls process.exit.
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";

const running = new Set<ChildProcess>();
let hooked = false;

function stopAll(): void {
  for (const child of running) {
    if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) continue;
    try { process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGTERM"); } catch { try { child.kill("SIGTERM"); } catch { /* already gone */ } }
  }
  running.clear();
}

function hook(): void {
  if (hooked) return;
  hooked = true;
  process.on("exit", stopAll);
  for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129]] as const) {
    process.once(signal, () => { stopAll(); process.exit(code); });
  }
}

export function spawnServer(command: string, args: readonly string[], options: SpawnOptions = {}): ChildProcess {
  hook();
  const child = spawn(command, args, { ...options, detached: process.platform !== "win32" });
  running.add(child);
  child.once("exit", () => running.delete(child));
  return child;
}
