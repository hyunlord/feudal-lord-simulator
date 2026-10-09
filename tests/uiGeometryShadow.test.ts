import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { gitIn, tempDir } from "./helpers/tempRepo";
import { checkUiGeometry } from "../scripts/checks/uiGeometry.mjs";
import { environmentReasons, formatShadow, measuredRange, remoteShadow, shadowJudgement, shadowStep, type Fingerprint } from "../scripts/checks/uiGeometryMeasured.mjs";
import { cachedFolderHash, environmentFingerprint, folderHash, STATE_SETS, SYSTEM_FILES, writeShadowRecord } from "../scripts/uiGeometryFingerprint.mjs";
import { packInputs } from "../scripts/checks/testInputs/testInputs.mjs";

// RR26 shadow (user rulings 2026-10-10): the gate judges by RR26's safe list; a′ is computed beside it against the
// shared result the push found (at <base>) and the DGX's values now (the fingerprint), and only recorded. These cases
// hold both directions of a disagreement, "판정 불가" without a fingerprint, the fallback without measured inputs, and
// that the gate's verdict is RR26's whatever the shadow says.
const REPO = resolve(import.meta.dirname, "..");
const SHARED = "docs/verification/uiaudit1/geometry.json";
const RUNS = "docs/verification/uiaudit1/geometry";
const READ = ["index.html", "src/main.tsx", "src/ui/Panel.tsx", "scripts/uiGeometryAudit.mjs"];
const DECLARED = { states: { ui5: "ui5-a" }, chromium: "151.0.7922.34", playwright: "1.62.1", node: "v24.21.0", system: { "/proc/version": "k1" }, nodeModules: { key: "abc", inode: "7" } };
const SAME: Fingerprint = { node: "v24.21.0", chromium: "151.0.7922.34", playwright: "1.62.1", system: { "/proc/version": "k1" }, states: { ui5: "ui5-a", ui6: "ui6-x" }, nodeModules: { key: "abc", inode: "7" } };

function writeFull(write: (path: string, text: string) => void, { run, commit, lists = [] as string[], measured = true }: { run: string; commit: string; lists?: string[]; measured?: boolean }) {
  const file = `${RUNS}/${run}/inputs.json`;
  const body = `${JSON.stringify({ schema: 1, kind: "ui-geometry-inputs", run, commit, declared: DECLARED, inputs: packInputs(new Map([["audit", { files: READ, dirs: [], lists, missing: [], untraceable: [] }]])) })}\n`;
  if (measured) write(file, body);
  const link = measured ? { measuredInputs: { file, sha256: createHash("sha256").update(body).digest("hex"), files: READ.length, untraceable: [], declared: DECLARED } } : {};
  const rows = { "hud.panel": { scene: "ui5", conditions: { "1280x800/normal/normal": { status: "measured", keys: [] } } } };
  write(`${RUNS}/${run}/geometry.json`, JSON.stringify({ run, commit, full: true, axesNarrowed: false, dirty: false, totals: { unopened: 0 }, unregisteredFramed: [], rows, ...link }));
  write(SHARED, JSON.stringify({ run, full: true, commit, dirty: false, failureKeys: [], unopened: 0, unregisteredFramed: 0, rows: 1, conditions: 1, report: `${RUNS}/${run}/geometry.json`, ...link }));
}

function story(options: { lists?: string[]; measured?: boolean } = {}) {
  const dir = tempDir("fls-shadow-");
  const git = gitIn(dir);
  const write = (path: string, text: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  for (const path of READ) write(path, `${path}\n`);
  write("src/unused.ts", "export const u = 1;\n");
  write("docs/verification/uiaudit1/geometry-baseline.json", '{"entries":[]}'); write("docs/verification/uiaudit1/geometry-exceptions.json", '{"exceptions":[]}');
  git("init", "-q", "-b", "trunk"); git("add", "-A"); git("commit", "-qm", "trunk");
  writeFull(write, { run: "full-1", commit: git("rev-parse", "HEAD"), ...options });
  git("add", "-A"); git("commit", "-qm", "the full audit");
  const base = git("rev-parse", "HEAD");
  git("checkout", "-qb", "branch");
  const commit = (message: string) => { git("add", "-A"); git("commit", "-qm", message); };
  const head = () => git("rev-parse", "HEAD");
  const gate = () => checkUiGeometry({ base, head: head(), cwd: dir, mode: "enforce", env: {} });
  const judge = (fingerprint: Fingerprint | null) => shadowJudgement({ gate: gate(), range: measuredRange({ base, head: head(), cwd: dir }), fingerprint });
  return { dir, git, write, commit, base, head, gate, judge, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test("RR26 needs an audit, a′ does not: a src file no page loads — an audit a′ would have skipped, and the gate still refuses (RR26)", () => {
  const s = story();
  try {
    s.write("src/unused.ts", "changed\n"); s.commit("branch: a file no page loads");
    assert.equal(s.gate().ok, false, "the gate is RR26's: a src file off the safe list needs an audit");
    const judgement = s.judge(SAME);
    assert.deepEqual([judgement.rr26, judgement.aprime, judgement.direction], ["needed", "not needed", "saved"]);
    assert.match(formatShadow(judgement), /^ui-geometry shadow \(recorded only, the gate judged by RR26\): RR26: 감사 필요 \/ a′: 불필요 — nothing the audit read changed \(1 file\(s\); measured inputs of full-1\), the environment the same\n  disagreement: an audit a′ would have skipped/);
  } finally { s.done(); }
});

test("without a fingerprint a′ cannot judge (판정 불가), whatever the files say", () => {
  const s = story();
  try {
    s.write("src/unused.ts", "changed\n"); s.commit("branch: a file no page loads");
    const judgement = s.judge(null);
    assert.deepEqual([judgement.rr26, judgement.aprime, judgement.direction], ["needed", "undecidable", null]);
    assert.match(formatShadow(judgement), /RR26: 감사 필요 \/ a′: 판정 불가 — no fingerprint of the DGX/);
    s.write("src/ui/Panel.tsx", "changed\n"); s.commit("branch: the panel");
    assert.match(s.judge(null).why, /by the files alone: 1 it read changed/);
  } finally { s.done(); }
});

test("both need an audit: a file the audit read, or the environment (another Chromium) — no disagreement", () => {
  const s = story();
  try {
    s.write("src/ui/Panel.tsx", "changed\n"); s.commit("branch: the panel");
    assert.deepEqual([s.judge(SAME).aprime, s.judge(SAME).direction], ["needed", null]);
    assert.match(s.judge(SAME).why, /1 file\(s\) the audit read changed: src\/ui\/Panel\.tsx/);
  } finally { s.done(); }
  const t = story();
  try {
    t.write("src/unused.ts", "changed\n"); t.commit("branch: a file no page loads");
    const judgement = t.judge({ ...SAME, chromium: "152.0.1.1" });
    assert.deepEqual([judgement.rr26, judgement.aprime, judgement.direction], ["needed", "needed", null]);
    assert.match(judgement.why, /the environment: Chromium 151\.0\.7922\.34 → 152\.0\.1\.1/);
  } finally { t.done(); }
});

test("RR26 needs no audit, a′ does: a state folder changed on the DGX, or an entry added to a folder the audit listed — the other direction, flagged", () => {
  const s = story();
  try {
    s.write("docs/notes.md", "x\n"); s.commit("branch: a document");
    assert.equal(s.gate().ok, true, "the gate is RR26's: a document needs no audit");
    const judgement = s.judge({ ...SAME, states: { ui5: "ui5-b" } });
    assert.deepEqual([judgement.rr26, judgement.aprime, judgement.direction], ["not needed", "needed", "aprime-only"]);
    assert.match(formatShadow(judgement), /RR26: 불필요 \/ a′: 감사 필요 — the environment: the state folder ui5 changed\n  disagreement: a′ alone wants an audit/);
  } finally { s.done(); }
  const t = story({ lists: [""] });
  try {
    t.write("NEW.md", "x\n"); t.commit("branch: a document at the root (the dependency scanner lists the root)");
    assert.deepEqual([t.judge(SAME).rr26, t.judge(SAME).aprime, t.judge(SAME).direction], ["not needed", "needed", "aprime-only"]);
  } finally { t.done(); }
});

test("the environment, compared value by value: a value the DGX cannot read counts as changed; a set the audit did not read is not compared", () => {
  assert.deepEqual(environmentReasons(DECLARED, SAME), []);
  assert.deepEqual(environmentReasons(DECLARED, { ...SAME, states: { ui6: "ui6-y" } }), ["the state folder ui5 is not on the DGX"]);
  assert.deepEqual(environmentReasons(DECLARED, { ...SAME, playwright: null, node: "v24.22.0" }), ["Playwright 1.62.1 → unknown", "node v24.21.0 → v24.22.0"]);
  assert.deepEqual(environmentReasons(DECLARED, { ...SAME, system: { "/proc/version": "k2" } }), ["the system file /proc/version changed"]);
  assert.deepEqual(environmentReasons(DECLARED, { ...SAME, nodeModules: { key: "abc", inode: "8" } }), ["node_modules installed again (abc)"]);
  assert.deepEqual(environmentReasons(DECLARED, { ...SAME, nodeModules: null }), ["node_modules installed again (abc)"]);
});

test("no usable measured inputs at the base: a′ falls back to the safe list — the same verdict as RR26, no disagreement", () => {
  const s = story({ measured: false });
  try {
    s.write("src/unused.ts", "changed\n"); s.commit("branch: a file no page loads");
    const judgement = s.judge(SAME);
    assert.deepEqual([judgement.rr26, judgement.aprime, judgement.direction], ["needed", "fallback", null]);
    assert.match(formatShadow(judgement), /RR26: 감사 필요 \/ a′: 안전 목록 대체 — no measured inputs/);
  } finally { s.done(); }
});

test("a′ judges the push against the shared result it found (at the base), not the new full audit the push brings", () => {
  const s = story();
  try {
    s.write("src/unused.ts", "changed\n"); s.commit("branch: a file no page loads");
    writeFull(s.write, { run: "full-2", commit: s.head() }); s.commit("branch: a new full audit");
    const range = measuredRange({ base: s.base, head: s.head(), cwd: s.dir });
    assert.equal(range.status, "ok"); assert.equal(range.shared?.run, "full-1");
    assert.deepEqual(range.files, [], "the audit's own records are no input; the file no page loads is not read");
    assert.deepEqual([s.judge(SAME).rr26, s.judge(SAME).aprime], ["needed", "not needed"]);
  } finally { s.done(); }
});

test("what the shared result read changed before the base (accepted through a changed-rows run): a′ falls back (its set may miss a newer import)", () => {
  const s = story();
  try {
    s.git("checkout", "-q", "trunk"); s.write("src/ui/Panel.tsx", "changed on trunk\n"); s.commit("trunk: the panel (its rows audited)");
    const base = s.head(); s.git("checkout", "-qb", "later"); s.write("src/unused.ts", "changed\n"); s.commit("later: a file no page loads");
    const range = measuredRange({ base, head: s.head(), cwd: s.dir });
    assert.equal(range.status, "stale"); assert.match(String(range.why), /what the shared result read changed before the base: src\/ui\/Panel\.tsx/);
  } finally { s.done(); }
});

test("the step: one call to the DGX (fingerprint and record), a local record, and never a throw — the gate's verdict is untouched", () => {
  const s = story();
  try {
    s.write("src/unused.ts", "changed\n"); s.commit("branch: a file no page loads");
    const gate = s.gate(); const before = JSON.stringify(gate);
    const calls: object[] = [];
    const step = shadowStep({ base: s.base, head: s.head(), gate, cwd: s.dir, env: { FLS_SESSION: "infra" }, now: new Date("2026-10-10T05:00:00.000Z"),
      remote: options => { calls.push(options); return { fingerprint: SAME, name: "x.json" }; } });
    assert.equal(calls.length, 1, "one call per check:merge");
    assert.equal((calls[0] as { nodeModulesKey: string }).nodeModulesKey, "abc", "the install the shared result's audit ran with");
    assert.equal(JSON.stringify(gate), before, "the gate's result is not touched");
    assert.match(step.text, /RR26: 감사 필요 \/ a′: 불필요/);
    const local = readdirSync(join(s.dir, ".remote-runs/_shadow"));
    assert.deepEqual(local, [`${s.head().slice(0, 12)}-20261010T050000Z-infra.json`]);
    const record = JSON.parse(readFileSync(join(s.dir, ".remote-runs/_shadow", local[0]!), "utf8"));
    assert.equal(record.head, s.head()); assert.equal(record.base, s.base); assert.deepEqual(record.fingerprint, SAME); assert.equal(record.judgement.direction, "saved");
    assert.equal(record.shared.run, "full-1"); assert.deepEqual(record.shared.declared, DECLARED);
    const failed = shadowStep({ base: s.base, head: s.head(), gate, cwd: s.dir, env: {}, remote: () => ({ error: "the DGX did not answer in 5 s" }) });
    assert.match(failed.text, /a′: 판정 불가 — no fingerprint of the DGX[\s\S]*\(no fingerprint: the DGX did not answer in 5 s\)/);
    const thrown = shadowStep({ base: s.base, head: s.head(), gate, cwd: s.dir, env: {}, remote: () => { throw new Error("boom"); } });
    assert.match(thrown.text, /^ui-geometry shadow: not recorded \(boom\) — the gate judged by RR26 as always/);
  } finally { s.done(); }
});

test("the DGX call: switched off, or a host that does not answer, fails within the 5 s cap", () => {
  assert.equal(remoteShadow({ record: {}, nodeModulesKey: null, env: { FLS_SHADOW_REMOTE: "off" }, cwd: REPO }).error, "FLS_SHADOW_REMOTE=off");
  const started = Date.now();
  const result = remoteShadow({ record: {}, nodeModulesKey: null, env: { FLS_REMOTE_HOST: "nobody@192.0.2.1" }, cwd: REPO });
  assert.ok(result.error !== undefined && result.fingerprint === undefined, JSON.stringify(result));
  assert.ok(Date.now() - started < 6_000, `${Date.now() - started} ms`);
});

test("the fingerprint on a DGX-like home: the runs' Chromium, Playwright, node, state folders by content (reused while unchanged), the install", () => {
  const home = tempDir("fls-shadow-home-");
  try {
    const tools = join(home, "fls-runs/_tools");
    mkdirSync(join(tools, "node_modules/playwright-core"), { recursive: true }); writeFileSync(join(tools, "node_modules/playwright-core/package.json"), '{"version":"1.62.1"}');
    const chromium = join(tools, "chrome"); writeFileSync(chromium, "#!/bin/sh\necho 'Chromium 151.0.7922.34 '\n"); chmodSync(chromium, 0o755); writeFileSync(join(tools, "chromium-path"), `${chromium}\n`);
    const ui5 = join(home, STATE_SETS.ui5!); mkdirSync(ui5, { recursive: true }); writeFileSync(join(ui5, "a.json"), "{}");
    mkdirSync(join(home, "fls-runs/_cache/nm-abc/node_modules"), { recursive: true }); writeFileSync(join(home, "fls-runs/_cache/nm-abc/node_modules/.package-lock.json"), "{}");
    const fingerprint = environmentFingerprint({ home, nodeModulesKey: "abc" });
    assert.equal(fingerprint.chromium, "151.0.7922.34"); assert.equal(fingerprint.playwright, "1.62.1"); assert.equal(fingerprint.node, process.version);
    assert.equal(fingerprint.states.ui5, folderHash(ui5), "the audit's own folder hash (scripts/uiGeometryInputs.mjs uses the same function)");
    assert.equal(fingerprint.states.ui6, null, "a set not on this machine");
    assert.match(String(fingerprint.nodeModules?.inode), /^\d+$/);
    assert.deepEqual(Object.keys(fingerprint.system), [...SYSTEM_FILES]);
    const cache = join(home, "fls-runs/_shadow/_folders.json");
    assert.ok(existsSync(cache), "the folder hashes are kept for the next check:merge");
    writeFileSync(join(ui5, "a.json"), '{"x":1}');
    assert.notEqual(cachedFolderHash(ui5, cache), fingerprint.states.ui5, "a file changed: hashed again");
    assert.equal(cachedFolderHash(ui5, cache), folderHash(ui5));
    const first = writeShadowRecord({ head: "a".repeat(40), time: "2026-10-10T05:00:00.123Z", session: "claude/row-inputs" }, { home });
    const second = writeShadowRecord({ head: "a".repeat(40), time: "2026-10-10T05:00:00.123Z", session: "engine" }, { home });
    assert.deepEqual([first, second], ["aaaaaaaaaaaa-20261010T050000Z-claude_row-inputs.json", "aaaaaaaaaaaa-20261010T050000Z-engine.json"], "a file per run: sessions never share one");
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test("scripts/remote/tasks.sh and the fingerprint name the same state folders and system files", () => {
  const tasks = readFileSync(join(REPO, "scripts/remote/tasks.sh"), "utf8");
  const block = tasks.slice(tasks.indexOf("ui-geometry)"), tasks.indexOf(";;", tasks.indexOf("ui-geometry)")));
  const folders = new Map<string, string>();
  for (const [, name, folder] of block.matchAll(/\b(\w+)=\$\{\w+:-\$HOME\/([^}]+)\}/g)) folders.set(name!, folder!);
  for (const [, name, parent, sub] of block.matchAll(/\b(\w+)=\$(\w+)\/(\w+)\b/g)) if (folders.has(parent!)) folders.set(name!, `${folders.get(parent!)}/${sub}`);
  const sets = Object.fromEntries([...block.matchAll(/--state ([\w-]+)="\$(\w+)"/g)].map(([, set, name]) => [set!, folders.get(name!)]));
  assert.deepEqual(sets, { ...STATE_SETS });
  assert.deepEqual([...block.matchAll(/--system (\S+)/g)].map(([, path]) => path), [...SYSTEM_FILES]);
});
