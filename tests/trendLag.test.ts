import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkTrendLag, formatTrendLag, logTrendLag, TREND_FILE } from "../scripts/checks/trendLag.mjs";
import { writeKoreanFile } from "./helpers/tempRepo";

// A throwaway repository: trunk heads h1..h13, the page measures h1 (committed at h2).
function repo() {
  const dir = mkdtempSync(join(tmpdir(), "fls-trend-lag-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  writeKoreanFile(dir);
  git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
  const heads: string[] = [];
  for (let i = 1; i <= 13; i++) {
    if (i === 2) { mkdirSync(join(dir, "docs/verification/perf-trend"), { recursive: true }); writeFileSync(join(dir, TREND_FILE), JSON.stringify([{ commit: heads[0] }])); }
    writeFileSync(join(dir, "f.txt"), String(i)); git("add", "-A");
    git("commit", "-qm", `h${i}`); git("commit", "-q", "--allow-empty", "-m", `side${i}`); heads.push(git("rev-parse", "HEAD"));
  }
  return { dir, git, heads };
}

test("the lag counts unmeasured trunk heads, and every commit without a reflog", () => {
  const { dir, heads } = repo();
  try {
    const near = checkTrendLag({ head: heads[10]!, cwd: dir, trunkHeads: heads.slice(0, 10) });
    assert.equal(near.newest, heads[0]); assert.equal(near.lag, 10); assert.equal(near.unit, "trunk heads");
    assert.match(formatTrendLag(near), /10 trunk heads behind \(limit 10\)/);
    assert.equal(logTrendLag(near, heads[10]!, dir), false);
    const far = checkTrendLag({ head: heads[11]!, cwd: dir, trunkHeads: heads.slice(0, 11) });
    assert.equal(far.lag, 11); assert.match(formatTrendLag(far), /WARNING .* 11 trunk heads behind/);
    assert.equal(logTrendLag(far, heads[11]!, dir), true);
    assert.match(readFileSync(join(dir, ".git/fls-trend-lag.log"), "utf8"), /lag=11/);
    const fresh = checkTrendLag({ head: heads[2]!, cwd: dir, trunkHeads: [] });
    assert.equal(fresh.unit, "commits"); assert.equal(fresh.lag, 4);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a head without the page is a warning, not an error", () => {
  const { dir, heads } = repo();
  try {
    const result = checkTrendLag({ head: heads[0]!, cwd: dir, trunkHeads: [] });
    assert.equal(result.lag, null); assert.match(formatTrendLag(result), /WARNING .* missing/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
