import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { refreshPlan } from "../scripts/perf/trendAutoCommit.mjs";
import { pickTrendSide } from "../scripts/perf/trendMergeDriver.mjs";

const TRUNK = "codex/phase15-organic-ground";
const PAGE = "docs/verification/perf-trend";

test("a merge refreshes the page only on a work branch that took the trunk in and lags past the limit", () => {
  const base = { branch: "claude/x", squash: false, trunkInHead: true, lag: 11, dirty: false };
  assert.equal(refreshPlan(base).refresh, true);
  assert.equal(refreshPlan({ ...base, lag: 10 }).refresh, false);
  assert.equal(refreshPlan({ ...base, lag: null }).refresh, false);
  assert.equal(refreshPlan({ ...base, branch: TRUNK }).refresh, false);
  assert.equal(refreshPlan({ ...base, branch: "main" }).refresh, false);
  assert.equal(refreshPlan({ ...base, branch: null }).refresh, false);
  assert.equal(refreshPlan({ ...base, squash: true }).refresh, false);
  assert.equal(refreshPlan({ ...base, trunkInHead: false }).refresh, false);
  assert.match(refreshPlan({ ...base, dirty: true }).reason, /uncommitted/);
});

test("the merge driver keeps the page with more measured commits, ours on a tie", () => {
  const rows = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ commit: String(i) })));
  assert.equal(pickTrendSide(`${PAGE}/trend.json`, rows(3), rows(5)), "theirs");
  assert.equal(pickTrendSide(`${PAGE}/trend.json`, rows(5), rows(3)), "ours");
  assert.equal(pickTrendSide(`${PAGE}/trend.json`, rows(4), rows(4)), "ours");
  assert.equal(pickTrendSide(`${PAGE}/trend.json`, "{", rows(4)), null);
  const readme = (n: number) => ["# page", "| 커밋 | x |", ...Array.from({ length: n }, (_, i) => `| \`${String(i).padStart(8, "a")}\` | 1 |`)].join("\n");
  assert.equal(pickTrendSide(`${PAGE}/README.md`, readme(2), readme(6)), "theirs");
  assert.equal(pickTrendSide(`${PAGE}/README.md`, readme(6), readme(2)), "ours");
});

// A throwaway clone with the repository's hooks installed by its own install.sh: trunk heads t1..t12 (the page measures
// t0), a work branch from t0. FLS_TREND_AUTO_CMD stands in for perf:trend and writes a longer page and a data file.
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "fls-trend-auto-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  for (const file of ["scripts/git-hooks/install.sh", "scripts/git-hooks/pre-push", "scripts/git-hooks/post-merge", "scripts/perf/trendAutoCommit.mjs",
    "scripts/perf/trendMergeDriver.mjs", "scripts/checks/gitRange.mjs", "scripts/checks/trendLag.mjs"]) {
    mkdirSync(join(dir, dirname(file)), { recursive: true }); copyFileSync(file, join(dir, file));
  }
  git("init", "-q", "-b", "start"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
  writeFileSync(join(dir, ".gitattributes"), `${PAGE}/README.md merge=fls-trend\n${PAGE}/trend.json merge=fls-trend\n`);
  mkdirSync(join(dir, PAGE), { recursive: true });
  writeFileSync(join(dir, PAGE, "README.md"), "# page\n");
  writeFileSync(join(dir, PAGE, "trend.json"), "[]");
  git("add", "-A"); git("commit", "-qm", "t0");
  const t0 = git("rev-parse", "HEAD");
  writeFileSync(join(dir, PAGE, "trend.json"), JSON.stringify([{ commit: t0 }])); git("commit", "-qam", "page measures t0");
  execFileSync("sh", ["scripts/git-hooks/install.sh"], { cwd: dir, stdio: "ignore" });
  git("switch", "-qc", "work"); writeFileSync(join(dir, "work.txt"), "w"); git("add", "-A"); git("commit", "-qm", "work");
  git("switch", "-q", "start");
  for (let i = 1; i <= 12; i++) {
    writeFileSync(join(dir, "trunk.txt"), String(i)); git("add", "-A"); git("commit", "-qm", `t${i}`);
    git("update-ref", `refs/remotes/origin/${TRUNK}`, "HEAD");
  }
  git("switch", "-q", "work");
  return { dir, git, t0 };
}

const refresh = `node -e "require('fs').writeFileSync('${PAGE}/trend.json', JSON.stringify([1,2,3]));require('fs').mkdirSync('${PAGE}/data',{recursive:true});require('fs').writeFileSync('${PAGE}/data/x.json','{}')"`;

test("merging the trunk into a lagging work branch commits the refreshed page and nothing else", () => {
  const { dir, git } = sandbox();
  try {
    execFileSync("git", ["merge", "-q", "--no-edit", `origin/${TRUNK}`], { cwd: dir, stdio: "ignore", env: { ...process.env, FLS_TREND_AUTO_CMD: refresh } });
    assert.match(git("log", "-1", "--format=%s"), /^perf-trend: refreshed after a merge \(the page was 13 trunk heads behind/);
    assert.deepEqual(git("show", "--name-only", "--format=", "HEAD").split("\n").sort(), [`${PAGE}/data/x.json`, `${PAGE}/trend.json`]);
    assert.equal(git("status", "--porcelain"), "");
    assert.match(git("log", "-2", "--format=%s").split("\n")[1]!, /^Merge/);
    assert.throws(() => git("rev-parse", "-q", "--verify", "MERGE_HEAD"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("FLS_TREND_AUTO=0 and a failed refresh leave only the merge, with the folder put back", () => {
  const { dir, git } = sandbox();
  try {
    execFileSync("git", ["merge", "-q", "--no-edit", `origin/${TRUNK}`], { cwd: dir, stdio: "ignore", env: { ...process.env, FLS_TREND_AUTO: "0", FLS_TREND_AUTO_CMD: refresh } });
    assert.match(git("log", "-1", "--format=%s"), /^Merge/);
    git("reset", "-q", "--hard", "HEAD~1");
    execFileSync("git", ["merge", "-q", "--no-edit", `origin/${TRUNK}`], { cwd: dir, stdio: "ignore", env: { ...process.env, FLS_TREND_AUTO_CMD: `${refresh} && exit 3` } });
    assert.match(git("log", "-1", "--format=%s"), /^Merge/);
    assert.equal(git("status", "--porcelain"), "");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("two refreshed pages merge without a conflict and the longer one stays", () => {
  const { dir, git } = sandbox();
  try {
    const page = join(dir, PAGE, "trend.json");
    writeFileSync(page, JSON.stringify([1, 2])); git("commit", "-qam", "work page 2");
    git("switch", "-qc", "other", "HEAD~1"); writeFileSync(page, JSON.stringify([1, 2, 3, 4])); git("commit", "-qam", "other page 4");
    git("switch", "-q", "work");
    execFileSync("git", ["merge", "-q", "--no-edit", "other"], { cwd: dir, stdio: "ignore", env: { ...process.env, FLS_TREND_AUTO: "0" } });
    assert.deepEqual(JSON.parse(readFileSync(page, "utf8")), [1, 2, 3, 4]);
    assert.equal(git("status", "--porcelain"), "");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
