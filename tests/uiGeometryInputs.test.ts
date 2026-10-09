import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { tempDir } from "./helpers/tempRepo";
import { auditInputs, declaredInputs, folderHash } from "../scripts/uiGeometryInputs.mjs";

// RR26 measured (a′, user ruling 2026-10-10): the recorder's role mode for the geometry audit's two long-lived processes
// (the dev server, the audit) and what scripts/uiGeometryInputs.mjs makes of their records. Each case runs a real node
// process under the recorder (as scripts/remote/tasks.sh does) and is made to break the rule on purpose (RR22).
const REPO = resolve(import.meta.dirname, "..");
const TRACER = pathToFileURL(join(REPO, "scripts/checks/testInputs/traceReads.mjs")).href;

/** A throwaway repository, a trace folder, and `run(role, code, env)`: node -e <code> in it under the recorder. */
function setup() {
  const dir = tempDir("fls-roles-");
  const trace = join(dir, ".trace"); mkdirSync(trace);
  const outside = tempDir("fls-roles-out-");   // under .tmp/: inside the outer checkout, outside this repository
  const write = (path: string, text: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  write("src/a.ts", "a\n"); write("src/b.ts", "b\n"); write("scripts/remote/viteNoWatch.config.ts", "config\n");
  const run = (role: string, code: string, extra: Record<string, string> = {}) => {
    const { NODE_TEST_CONTEXT: _runner, ...outer } = process.env;
    const env = { ...outer, FLS_TRACE_DIR: trace, FLS_TRACE_ROLE: role, NODE_OPTIONS: `--import=${TRACER}`, ...extra };
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: dir, env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  return { dir, trace, outside, write, run, done: () => { rmSync(dir, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); } };
}
const READ = 'import { readFileSync as readA } from "node:fs"; readA("src/a.ts");';
/** Both roles with the config file read, so only what a case adds can make the result untraceable. */
const bothRoles = (s: ReturnType<typeof setup>, viteCode = "", auditCode = "", extra: Record<string, string> = {}) => {
  s.run("vite", `import { readFileSync as readConfig } from "node:fs"; readConfig("scripts/remote/viteNoWatch.config.ts"); ${viteCode}`, extra);
  s.run("audit", `${READ} ${auditCode}`, extra);
};

test("both roles recorded: their reads join, nothing untraceable; a role missing, or the server's config files unrecorded, is untraceable", () => {
  const s = setup();
  try {
    bothRoles(s, 'import { readFileSync } from "node:fs"; readFileSync("src/b.ts");');
    const { inputs, roles } = auditInputs({ root: s.dir, traceDir: s.trace });
    assert.deepEqual(inputs.files, ["scripts/remote/viteNoWatch.config.ts", "src/a.ts", "src/b.ts"]);
    assert.deepEqual(inputs.untraceable, []);
    assert.ok(roles.vite && roles.audit);
  } finally { s.done(); }
  const t = setup();
  try {
    t.run("audit", READ);
    assert.deepEqual(auditInputs({ root: t.dir, traceDir: t.trace }).inputs.untraceable, ["no record of the dev server"]);
    t.run("vite", READ);
    assert.match(auditInputs({ root: t.dir, traceDir: t.trace }).inputs.untraceable.join(), /dev server: the files its config was bundled from were not recorded/);
  } finally { t.done(); }
});

test("the files a bundled config was made from (<pid>.config, Vite's configFileDependencies) are read", () => {
  const s = setup();
  try {
    s.write("plugins/p.ts", "p\n");
    // As viteNoWatch.config.ts's plugin does: the config's own files, read by Rolldown out of the recorder's sight.
    s.run("vite", 'import { appendFileSync, readFileSync } from "node:fs"; readFileSync("src/b.ts"); appendFileSync(`${process.env.FLS_TRACE_DIR}/${process.pid}.config`, `${process.cwd()}/scripts/remote/viteNoWatch.config.ts\\n${process.cwd()}/plugins/p.ts\\n`);');
    s.run("audit", READ);
    const { inputs } = auditInputs({ root: s.dir, traceDir: s.trace });
    assert.ok(inputs.files.includes("plugins/p.ts") && inputs.files.includes("scripts/remote/viteNoWatch.config.ts"), inputs.files.join(" "));
    assert.deepEqual(inputs.untraceable, []);
  } finally { s.done(); }
});

test("children: an allowed program is no untraceable read; another is; a node child carrying the recorder is followed, one without it is not", () => {
  const cases: [string, string, Record<string, string>, RegExp | null][] = [
    ["git, allowed", 'import { execFileSync } from "node:child_process"; execFileSync("git", ["--version"]);', { FLS_TRACE_CHILDREN: "git" }, null],
    ["git, not allowed", 'import { execFileSync } from "node:child_process"; execFileSync("git", ["--version"]);', {}, /audit: child process: git/],
    ["a node child that inherits the recorder", 'import { execFileSync } from "node:child_process"; execFileSync(process.execPath, ["-e", "1"]);', {}, null],
    ["a node child started without it", 'import { execFileSync } from "node:child_process"; execFileSync(process.execPath, ["-e", "1"], { env: { PATH: process.env.PATH } });', {}, /audit: child process: node/],
    ["a shell command line led by an allowed program", 'import { execSync } from "node:child_process"; execSync("git --version && cat src/a.ts");', { FLS_TRACE_CHILDREN: "git" }, /audit: child process: a shell command line/],
  ];
  for (const [what, code, extra, expected] of cases) {
    const s = setup();
    try {
      bothRoles(s, "", code, extra);
      const { untraceable } = auditInputs({ root: s.dir, traceDir: s.trace }).inputs;
      if (expected === null) assert.deepEqual(untraceable, [], what); else assert.ok(untraceable.some(reason => expected.test(reason)), `${what}: ${untraceable.join("; ")}`);
    } finally { s.done(); }
  }
});

test("the network: a loopback port FLS_TRACE_LOOPBACK names (the traced dev server) is followed; another port or host is not", async () => {
  // A free port nothing listens on: the recorder judges the connection when it is made, refused or not (a server in this
  // process could not answer — spawnSync holds its event loop).
  const port = await new Promise<string>(done => { const server = createServer(); server.listen(0, "127.0.0.1", () => { const free = String((server.address() as { port: number }).port); server.close(() => done(free)); }); });
  const connect = (p: string) => `import net from "node:net"; await new Promise(done => net.connect({ host: "127.0.0.1", port: ${p} }).on("error", done).on("close", done));`;
  try {
    for (const [what, code, extra, expected] of [
      ["the named loopback port", connect(port), { FLS_TRACE_LOOPBACK: port }, null],
      ["another loopback port", connect("9"), { FLS_TRACE_LOOPBACK: port }, /audit: network: 127\.0\.0\.1:9/],
      ["a fetch of the named port", `await fetch("http://127.0.0.1:${port}/").catch(() => {});`, { FLS_TRACE_LOOPBACK: port }, null],
      ["no port named", connect(port), {}, new RegExp(`audit: network: 127\\.0\\.0\\.1:${port}`)],
      ["a fetch of a port not named", `await fetch("http://127.0.0.1:9/").catch(() => {});`, { FLS_TRACE_LOOPBACK: port }, /audit: network: 127\.0\.0\.1:9/],
    ] as const) {
      const s = setup();
      try {
        bothRoles(s, "", code, extra as Record<string, string>);
        const { untraceable } = auditInputs({ root: s.dir, traceDir: s.trace }).inputs;
        if (expected === null) assert.deepEqual(untraceable, [], what); else assert.ok(untraceable.some(reason => expected.test(reason)), `${what}: ${untraceable.join("; ")}`);
      } finally { s.done(); }
    }
  } finally { /* nothing to close */ }
});

test("a file opened to write or append is no read; one opened to read is", () => {
  const t = setup();
  try {
    t.write("src/rp.ts", "rp\n"); t.write("src/ap.ts", "ap\n");
    bothRoles(t, `import fs from "node:fs"; fs.closeSync(fs.openSync("src/rp.ts", "r+")); fs.closeSync(fs.openSync("src/ap.ts", "a+")); fs.appendFileSync(${JSON.stringify(join(t.outside, "log.jsonl"))}, "x\\n"); fs.closeSync(fs.openSync("src/w.ts", "w")); fs.closeSync(fs.openSync("src/b.ts", "r")); await fs.promises.appendFile(${JSON.stringify(join(t.outside, "log2.jsonl"))}, "y\\n");`);
    const { inputs } = auditInputs({ root: t.dir, traceDir: t.trace });
    assert.ok(inputs.files.includes("src/b.ts"), "opened to read");
    assert.ok(inputs.files.includes("src/rp.ts") && inputs.files.includes("src/ap.ts"), "opened to read and write (r+, a+): read");
    assert.ok(!inputs.files.includes("src/w.ts"), "opened to write");
    assert.deepEqual(inputs.untraceable.filter(reason => /log/.test(reason)), [], "an appended log outside the repository is no read outside it");
  } finally { t.done(); }
});

test("declared: a read in a declared folder or file (as given or through a link) is bound by value, not untraceable; any other outside read is untraceable", () => {
  const s = setup();
  try {
    const states = join(s.outside, "states"); mkdirSync(states); writeFileSync(join(states, "a.json"), '{"a":1}');
    const real = join(s.outside, "os-release.real"); writeFileSync(real, "ID=x\n"); const link = join(s.outside, "os-release"); symlinkSync(real, link);
    bothRoles(s, "", `import { readFileSync } from "node:fs"; readFileSync(${JSON.stringify(join(states, "a.json"))}); readFileSync(${JSON.stringify(link)});`);
    const declared = [states, link];
    const clean = auditInputs({ root: s.dir, traceDir: s.trace, declared });
    assert.deepEqual(clean.inputs.untraceable, [], clean.inputs.untraceable.join("; "));
    assert.equal(declaredInputs({ root: s.dir, states: { ui5: states }, declaredPaths: clean.declaredPaths, chromium: "151" }).states.ui5, folderHash(states));
    // A read truly outside (not in a temporary folder, which the collector leaves out): a folder in the home directory,
    // made right before its own try so a failing assertion leaves nothing behind.
    const away = mkdtempSync(join(homedir(), ".fls-roles-test-"));
    try {
      const other = join(away, "other.txt"); writeFileSync(other, "o\n");
      s.run("audit", `import { readFileSync } from "node:fs"; readFileSync(${JSON.stringify(other)});`);
      assert.ok(auditInputs({ root: s.dir, traceDir: s.trace, declared }).inputs.untraceable.some(reason => reason.includes("other.txt"))); }
    finally { rmSync(away, { recursive: true, force: true }); }
    const before = folderHash(states);
    writeFileSync(join(states, "a.json"), '{"a":2}');
    assert.notEqual(folderHash(states), before, "a state changed: its folder hash changes");
  } finally { s.done(); }
});

test("the audit's own records (its result, failure shots, the baseline and exceptions) are no input; import.meta.glob makes the measurement untraceable", () => {
  const s = setup();
  try {
    s.write("docs/verification/uiaudit1/geometry-baseline.json", "{}\n"); s.write("docs/verification/uiaudit1/geometry/run-1/shots/x.jpg", "jpg");
    bothRoles(s, "", 'import { readFileSync, statSync } from "node:fs"; readFileSync("docs/verification/uiaudit1/geometry-baseline.json"); statSync("docs/verification/uiaudit1/geometry/run-1/shots/x.jpg");');
    const { inputs } = auditInputs({ root: s.dir, traceDir: s.trace });
    assert.deepEqual(inputs.files.filter(path => path.startsWith("docs/")), [], inputs.files.join(" "));
    assert.deepEqual(inputs.untraceable, []);
    s.write("src/g.ts", 'export const all = import.meta.glob("./parts/*.ts");\n');
    s.run("vite", 'import { readFileSync } from "node:fs"; readFileSync("src/g.ts");');
    assert.ok(auditInputs({ root: s.dir, traceDir: s.trace }).inputs.untraceable.some(reason => /src\/g\.ts uses import\.meta\.glob/.test(reason)));
  } finally { s.done(); }
});

test("followed only as named: a node child under another role, and a named port on a host that is not loopback, are untraceable", () => {
  const cases: [string, string, Record<string, string>, RegExp][] = [
    ["a node child carrying the recorder under another role", 'import { execFileSync } from "node:child_process"; execFileSync(process.execPath, ["-e", "1"], { env: { ...process.env, FLS_TRACE_ROLE: "other" } });', {}, /audit: child process: node/],
    ["a node child writing to another trace folder", 'import { execFileSync } from "node:child_process"; execFileSync(process.execPath, ["-e", "1"], { env: { ...process.env, FLS_TRACE_DIR: "/nowhere" } });', {}, /audit: child process: node/],
    ["the named port on another host", 'import net from "node:net"; await new Promise(done => net.connect({ host: "example.invalid", port: 4300 }).on("error", done).on("close", done));', { FLS_TRACE_LOOPBACK: "4300" }, /audit: network: example\.invalid:4300/],
  ];
  for (const [what, code, extra, expected] of cases) {
    const s = setup();
    try {
      bothRoles(s, "", code, extra);
      const { untraceable } = auditInputs({ root: s.dir, traceDir: s.trace }).inputs;
      assert.ok(untraceable.some(reason => expected.test(reason)), `${what}: ${untraceable.join("; ")}`);
    } finally { s.done(); }
  }
});

test("a role's record is written while it runs: a process killed outright still leaves what it read", () => {
  const s = setup();
  try {
    s.run("vite", 'import { readFileSync } from "node:fs"; readFileSync("scripts/remote/viteNoWatch.config.ts");');
    // No exit handler runs under SIGKILL: only the record written every second remains.
    const { NODE_TEST_CONTEXT: _runner, ...outer } = process.env;
    const killed = spawnSync(process.execPath, ["--input-type=module", "-e", 'import { readFileSync } from "node:fs"; readFileSync("src/b.ts"); setTimeout(() => process.kill(process.pid, "SIGKILL"), 1500);'],
      { cwd: s.dir, env: { ...outer, FLS_TRACE_DIR: s.trace, FLS_TRACE_ROLE: "audit", NODE_OPTIONS: `--import=${TRACER}` }, encoding: "utf8" });
    assert.equal(killed.signal, "SIGKILL");
    assert.ok(auditInputs({ root: s.dir, traceDir: s.trace }).inputs.files.includes("src/b.ts"));
  } finally { s.done(); }
});

test("declared values: only the state sets the audit read are hashed; the system files it read are hashed by content", () => {
  const s = setup();
  try {
    const read = join(s.outside, "ui5"); const unread = join(s.outside, "ui6"); mkdirSync(read); mkdirSync(unread);
    writeFileSync(join(read, "a.json"), "{}"); writeFileSync(join(unread, "b.json"), "{}");
    const system = join(s.outside, "version"); writeFileSync(system, "kernel 1\n"); const unreadSystem = join(s.outside, "ldd"); writeFileSync(unreadSystem, "ldd\n");
    bothRoles(s, "", `import { readFileSync } from "node:fs"; readFileSync(${JSON.stringify(join(read, "a.json"))}); readFileSync(${JSON.stringify(system)});`);
    const { declaredPaths } = auditInputs({ root: s.dir, traceDir: s.trace, declared: [read, unread, system, unreadSystem] });
    const values = declaredInputs({ root: s.dir, states: { ui5: read, ui6: unread }, declaredPaths, system: [system, unreadSystem] });
    assert.deepEqual(Object.keys(values.states), ["ui5"]);
    assert.deepEqual(Object.keys(values.system), [system]);
    assert.match(String(values.system[system]), /^[0-9a-f]{64}$/);
  } finally { s.done(); }
});

test("declared values are computed from what the run used: the lock file, Vite's dependency cache, Playwright, Chromium, node and the install", () => {
  const s = setup(); const t = setup();
  try {
    // Two run folders (the DGX makes one per run): Vite's own hashes cover the folder's absolute path and differ; the
    // declared value (its lock file hash, the pre-bundled dependencies by id and path in the folder) does not.
    const meta = (root: string, hash: string) => JSON.stringify({ hash, browserHash: `b-${hash}`, lockfileHash: "lock-1", optimized: { react: { src: join(root, "node_modules/react/index.js"), file: "react.js" } } });
    for (const [run, hash] of [[s, "h-1"], [t, "h-2"]] as const) {
      run.write("package-lock.json", '{"lockfileVersion":3}\n'); run.write("node_modules/.vite/deps/_metadata.json", meta(run.dir, hash));
      run.write("node_modules/.fls-nm-key", "abc-node24.21.0-aarch64\n"); run.write("node_modules/.package-lock.json", "{}\n");
    }
    const core = join(s.outside, "playwright-core"); mkdirSync(core); writeFileSync(join(core, "package.json"), '{"version":"1.62.1"}'); writeFileSync(join(core, "index.mjs"), "");
    const before = process.env.FLS_PLAYWRIGHT_CORE; process.env.FLS_PLAYWRIGHT_CORE = join(core, "index.mjs");
    try {
      const values = declaredInputs({ root: s.dir, states: {}, declaredPaths: [], chromium: "151.0" });
      assert.match(String(values.lock), /^[0-9a-f]{64}$/);
      assert.equal(values.viteDeps?.lockfileHash, "lock-1"); assert.match(String(values.viteDeps?.optimized), /^[0-9a-f]{64}$/);
      assert.deepEqual(declaredInputs({ root: t.dir, states: {}, declaredPaths: [] }).viteDeps, values.viteDeps, "another run folder, the same dependencies: the same value");
      t.write("node_modules/.vite/deps/_metadata.json", JSON.stringify({ ...JSON.parse(meta(t.dir, "h-2")), optimized: {} }));
      assert.notDeepEqual(declaredInputs({ root: t.dir, states: {}, declaredPaths: [] }).viteDeps, values.viteDeps, "other pre-bundled dependencies: another value");
      assert.equal(values.playwright, "1.62.1");
      assert.equal(values.chromium, "151.0");
      assert.equal(values.node, process.version);
      assert.equal(values.nodeModules?.key, "abc-node24.21.0-aarch64"); assert.match(String(values.nodeModules?.inode), /^\d+$/);
    } finally { if (before === undefined) delete process.env.FLS_PLAYWRIGHT_CORE; else process.env.FLS_PLAYWRIGHT_CORE = before; }
  } finally { s.done(); t.done(); }
});
