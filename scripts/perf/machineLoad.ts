// CPU used by work outside this process's tree, recorded beside perf runs (the condition of the run, never a wait).
// `ps -A -o pid=,ppid=,time=` gives each process's CPU seconds so far. The share between two samples sums, per process,
// the rise of its time (a process started in between counts all of its time; one that ended in between is lost, so the
// share can only be low, never negative), over the elapsed time × cores.
import { spawnSync } from "node:child_process";
import { cpus } from "node:os";

export type CpuSample = { readonly at: number; readonly seconds: ReadonlyMap<number, number> };

export function otherCpuSample(): CpuSample {
  const rows = spawnSync("ps", ["-A", "-o", "pid=,ppid=,time="], { encoding: "utf8" }).stdout.trim().split("\n").map(line => line.trim().split(/\s+/));
  const parent = new Map<number, number>(); const seconds = new Map<number, number>();
  for (const [pid, ppid, time] of rows) {
    if (pid === undefined || ppid === undefined || time === undefined) continue;
    const [clock, days] = time.includes("-") ? [time.split("-")[1]!, Number(time.split("-")[0])] : [time, 0];
    const parts = clock.split(":").map(Number); const value = parts.reduce((sum, part) => sum * 60 + part, 0) + days * 86_400;
    parent.set(Number(pid), Number(ppid)); seconds.set(Number(pid), value);
  }
  const ours = (pid: number) => { for (let at = pid, hops = 0; at > 1 && hops < 64; at = parent.get(at) ?? 0, hops++) if (at === process.pid) return true; return false; };
  const others = new Map<number, number>(); for (const [pid, value] of seconds) if (!ours(pid)) others.set(pid, value);
  return { at: Date.now(), seconds: others };
}

/** Share of all cores other work took between two samples (0..1). */
export function otherCpuShare(before: CpuSample, after: CpuSample): number {
  let used = 0; for (const [pid, value] of after.seconds) used += Math.max(0, value - (before.seconds.get(pid) ?? 0));
  const elapsed = Math.max(0.001, (after.at - before.at) / 1000);
  return Math.min(1, used / (elapsed * cpus().length));
}
