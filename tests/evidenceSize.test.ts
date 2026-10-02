import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { checkEvidenceSize, evidenceFolder, EVIDENCE_LIMIT_BYTES, formatEvidenceResult, isExempt, loadEvidenceBaseline } from "../scripts/checks/evidenceSize.mjs";

test("a task folder is docs/verification/<task>; replay captures and the geometry results are not counted", () => {
  assert.equal(evidenceFolder("docs/verification/nat4/world/a.jpg"), "docs/verification/nat4");
  assert.equal(evidenceFolder("docs/verification/README.md"), null);
  assert.equal(evidenceFolder("docs/qa/round17/a.jpg"), null);
  assert.equal(isExempt("docs/verification/uiaudit1/geometry/render-x/geometry.json"), true);
  assert.equal(isExempt("docs/verification/nat4/ui6/gates/replay/replay.json"), true);
  assert.equal(isExempt("docs/verification/perf-trend/data/abc.json"), true);
  assert.equal(isExempt("docs/verification/nat4/world/run03-forest.jpg"), false);
  assert.equal(EVIDENCE_LIMIT_BYTES, 3 * 1024 * 1024);
  assert.ok(Object.keys(loadEvidenceBaseline()).every(folder => evidenceFolder(`${folder}/x`) === folder));
});

// A throwaway repository; the limit is scaled down to 1,000 bytes so the files stay small.
function repo() {
  const dir = mkdtempSync(join(tmpdir(), "fls-evidence-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  const put = (path: string, bytes: number | string) => { mkdirSync(join(dir, dirname(path)), { recursive: true }); writeFileSync(join(dir, path), typeof bytes === "number" ? "x".repeat(bytes) : bytes); };
  git("init", "-q"); git("config", "user.email", "t@t"); git("config", "user.name", "t");
  put("docs/verification/old/a.jpg", 1500); put("docs/verification/big/a.jpg", 1800); put("README.md", 1);
  git("add", "-A"); git("commit", "-qm", "base");
  return { dir, git, put, base: git("rev-parse", "HEAD") };
}
const commit = (git: (...args: string[]) => string) => { git("add", "-A"); git("commit", "-qm", "c"); return git("rev-parse", "HEAD"); };

test("only folders the range touches are judged, each against the limit or its baseline size", () => {
  const { dir, git, put, base } = repo();
  try {
    const opts = { base, cwd: dir, limit: 1000, baseline: { "docs/verification/big": 1800 } };
    put("docs/verification/new/a.jpg", 600); put("docs/verification/new/b.json", 300);
    const small = checkEvidenceSize({ ...opts, head: commit(git) });
    assert.deepEqual(small.folders.map(row => [row.folder, row.bytes]), [["docs/verification/new", 900]]);
    assert.equal(small.over.length, 0);
    assert.match(formatEvidenceResult(small), /1 folder\(s\) changed, each within its limit/);

    put("docs/verification/new/c.jpg", 200);
    put("docs/verification/new/replay/frames.json", 5000); put("docs/verification/uiaudit1/geometry/run/geometry.json", 5000);
    const over = checkEvidenceSize({ ...opts, head: commit(git) });
    assert.deepEqual(over.over.map(row => [row.folder, row.bytes]), [["docs/verification/new", 1100]]);
    assert.equal(over.folders.find(row => row.folder === "docs/verification/uiaudit1"), undefined);
    assert.match(formatEvidenceResult(over), /FAILED — 1 evidence folder\(s\) over 3 MB[\s\S]*docs\/verification\/new\/b\.json/);

    put("docs/verification/big/b.jpg", 100);
    const grew = checkEvidenceSize({ ...opts, base: git("rev-parse", "HEAD"), head: commit(git) });
    assert.deepEqual(grew.over.map(row => [row.folder, row.bytes, row.allowed]), [["docs/verification/big", 1900, 1800]]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a Git LFS pointer counts at the size it points to", () => {
  const { dir, git, put, base } = repo();
  try {
    put("docs/verification/lfs/a.jpg", "version https://git-lfs.github.com/spec/v1\noid sha256:" + "0".repeat(64) + "\nsize 4000\n");
    const result = checkEvidenceSize({ base, head: commit(git), cwd: dir, limit: 1000, baseline: {} });
    assert.deepEqual(result.over.map(row => [row.folder, row.bytes]), [["docs/verification/lfs", 4000]]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
