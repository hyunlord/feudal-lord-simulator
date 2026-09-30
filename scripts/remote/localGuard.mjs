// Heavy verification runs on the DGX, not on this Mac (AGENTS.md "원격 실행"): the whole test suite, the guardrail and
// the browser capture scripts refuse to start on a Mac and name the `npm run remote:*` / `scripts/remote/run.sh` command
// to use instead. Allowed on the Mac as before: single test files and small tests, typecheck, lint, the dev server,
// `npm run perf:gate` (the smoothness gate needs the Mac's real window) and Astra QA (its own tools in its own clone).
//
// The Mac is known by macOS itself and its local host name (`scutil --get LocalHostName`): `os.hostname()` on a Mac is
// whatever the network hands out (e.g. "172.25.nate.com"), so it cannot tell the Mac apart. The DGX and CI are Linux.
// In a hurry, FLS_ALLOW_LOCAL=1 lets the run through: it prints a line the report must carry, and appends it to
// .remote-runs/local-heavy.log (ignored by git) with the time, the command and the commit.
//
//   import { refuseHeavyOnMac } from "./remote/localGuard.mjs"; refuseHeavyOnMac("...", { remote: "npm run remote:browser", entry: import.meta.url });
//   node scripts/remote/localGuard.mjs "<what>" "<remote command>" && <heavy command>     (npm scripts)
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { hostname } from "node:os";
import { pathToFileURL } from "node:url";

export function macHostName() {
  if (process.platform !== "darwin") return null;
  try { return execFileSync("scutil", ["--get", "LocalHostName"], { encoding: "utf8" }).trim() || hostname(); } catch { return hostname(); }
}

/**
 * Stops a heavy run on a Mac (exit 3) unless FLS_ALLOW_LOCAL=1. `entry`: the calling module's import.meta.url — the
 * guard acts only when that module is the program itself, never when a test or another script imports it.
 */
export function refuseHeavyOnMac(what, { remote, entry } = {}) {
  if (entry !== undefined && process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href !== entry) return;
  const mac = macHostName(); if (mac === null) return;
  const command = [process.argv[0]?.split("/").pop(), ...process.argv.slice(1)].join(" ");
  if (process.env.FLS_ALLOW_LOCAL === "1") {
    let commit = ""; try { commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a checkout */ }
    const line = `${new Date().toISOString()}\t${mac}\t${commit}\t${what}\t${command}`;
    try { mkdirSync(".remote-runs", { recursive: true }); appendFileSync(".remote-runs/local-heavy.log", `${line}\n`); } catch { /* read-only tree */ }
    console.error(`\n[FLS_ALLOW_LOCAL=1] ${what}을(를) Mac(${mac})에서 돈다. 보고서에 반드시 적는다: "무거운 검증을 Mac에서 돌렸다(${what}, ${commit}, FLS_ALLOW_LOCAL=1)". 기록: .remote-runs/local-heavy.log\n`);
    return;
  }
  console.error([
    ``, `거부: ${what}은(는) 무거운 검증이라 이 Mac(${mac})에서 돌리지 않는다(AGENTS.md "원격 실행").`,
    `  DGX에서: ${remote ?? "scripts/remote/run.sh <세션>-<작업ID> -- <같은 명령>"}`,
    `  Mac에서 되는 것: 단일 파일·소규모 시험(npx tsx --test tests/<파일>.test.ts), npm run typecheck, npm run lint, npm run dev, npm run perf:gate, Astra QA.`,
    `  급할 때만: FLS_ALLOW_LOCAL=1 <같은 명령> — 그 경우 보고서에 반드시 적는다.`, ``,
  ].join("\n"));
  process.exit(3);
}

if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [what = "무거운 검증", remote] = process.argv.slice(2);
  refuseHeavyOnMac(what, remote === undefined ? {} : { remote });
}
