// CPU used by work outside this process's tree (perf:gate and its queue judge whether the Mac is otherwise busy).
import { spawnSync } from "node:child_process";

// CPU seconds used so far by every process outside this gate's own tree (the gate, its build server, the audit and
// its Chrome): `ps -A -o pid=,ppid=,time=`. Between two samples, over the elapsed time × cores, it is the share of the
// machine that other work took (another session's tests, an inference run, a build).
export function otherCpuSeconds(): number {
  const rows = spawnSync("ps", ["-A", "-o", "pid=,ppid=,time="], { encoding: "utf8" }).stdout.trim().split("\n").map(line => line.trim().split(/\s+/));
  const parent = new Map<number, number>(); const seconds = new Map<number, number>();
  for (const [pid, ppid, time] of rows) {
    if (pid === undefined || ppid === undefined || time === undefined) continue;
    const [clock, days] = time.includes("-") ? [time.split("-")[1]!, Number(time.split("-")[0])] : [time, 0];
    const parts = clock.split(":").map(Number); const value = parts.reduce((sum, part) => sum * 60 + part, 0) + days * 86_400;
    parent.set(Number(pid), Number(ppid)); seconds.set(Number(pid), value);
  }
  const ours = (pid: number) => { for (let at = pid, hops = 0; at > 1 && hops < 64; at = parent.get(at) ?? 0, hops++) if (at === process.pid) return true; return false; };
  let total = 0; for (const [pid, value] of seconds) if (!ours(pid)) total += value;
  return total;
}
