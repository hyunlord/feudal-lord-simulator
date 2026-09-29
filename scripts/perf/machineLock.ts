// One perf measurement at a time on this machine (perf:gate, hitchAudit, memoryHolders): two would measure each other,
// and every session on the Mac shares one screen. The lock is a file every session can see (/tmp, not the per-user
// $TMPDIR of one shell), created atomically; it names who holds it. A holder that died leaves it stale and the next one
// takes it over. A child of the holder (perf:gate → hitchAudit) inherits it through FLS_PERF_LOCK_HOLDER.
import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";

export const LOCK_FILE = process.env.FLS_PERF_LOCK ?? "/tmp/fls-perf-measure.lock";
export interface LockHolder { readonly pid: number; readonly label: string; readonly cwd: string; readonly since: string }
export type LockResult = { readonly held: true; readonly release: () => void } | { readonly held: false; readonly holder: LockHolder };

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; } };
const readHolder = (): LockHolder | null => { try { return JSON.parse(readFileSync(LOCK_FILE, "utf8")) as LockHolder; } catch { return null; } };

function tryTake(label: string): LockResult | null {
  try {
    const fd = openSync(LOCK_FILE, "wx");
    writeSync(fd, JSON.stringify({ pid: process.pid, label, cwd: process.cwd(), since: new Date().toISOString() } satisfies LockHolder)); closeSync(fd);
    const release = () => { if (readHolder()?.pid === process.pid) try { unlinkSync(LOCK_FILE); } catch { /* already gone */ } };
    process.once("exit", release);
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.once(signal, () => { release(); process.exit(130); });
    process.env.FLS_PERF_LOCK_HOLDER = String(process.pid);
    return { held: true, release };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const holder = readHolder();
    if (holder === null || !alive(holder.pid)) { try { unlinkSync(LOCK_FILE); } catch { /* raced */ } return null; }   // stale: retry
    return { held: false, holder };
  }
}

/** Takes the machine's perf lock, waiting up to `waitMinutes` (0: do not wait). */
export async function takeMachineLock(label: string, waitMinutes: number, onWait?: (holder: LockHolder) => void): Promise<LockResult> {
  const inherited = process.env.FLS_PERF_LOCK_HOLDER;
  if (inherited !== undefined && readHolder()?.pid === Number(inherited)) return { held: true, release: () => {} };
  const deadline = Date.now() + waitMinutes * 60_000; let lastNotice = 0;
  for (;;) {
    const result = tryTake(label);
    if (result?.held === true) return result;
    if (result !== null) {
      if (Date.now() >= deadline) return result;
      if (Date.now() - lastNotice >= 60_000) { onWait?.(result.holder); lastNotice = Date.now(); }
      await new Promise(resolve => setTimeout(resolve, 5_000));
    }
  }
}

export const holderText = (holder: LockHolder) => `${holder.label} (pid ${holder.pid}, ${holder.cwd}, ${holder.since} 부터)`;
