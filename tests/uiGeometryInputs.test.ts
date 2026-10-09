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
    writeFileSync(join(t.trace, `${process.pid}.config`), `${join(t.dir, "scripts/remote/viteNoWatch.config.ts")}\n${join(t.dir, "src/b.ts")}\n`);   // a config record of some process
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
    bothRoles(t, `import fs from "node:fs"; fs.appendFileSync(${JSON.stringify(join(t.outside, "log.jsonl"))}, "x\\n"); fs.closeSync(fs.openSync("src/w.ts", "w")); fs.closeSync(fs.openSync("src/b.ts", "r")); await fs.promises.appendFile(${JSON.stringify(join(t.outside, "log2.jsonl"))}, "y\\n");`);
    const { inputs } = auditInputs({ root: t.dir, traceDir: t.trace });
    assert.ok(inputs.files.includes("src/b.ts"), "opened to read");
    assert.ok(!inputs.files.includes("src/w.ts"), "opened to write");
    assert.deepEqual(inputs.untraceable.filter(reason => /log/.test(reason)), [], "an appended log outside the repository is no read outside it");
  } finally { t.done(); }
});

test("declared: a read in a declared folder or file (as given or through a link) is bound by value, not untraceable; any other outside read is untraceable", () => {
  const s = setup();
  try {
    const states = join(s.outside, "states"); mkdirSync(states); writeFileSync(join(states, "a.json"), '{"a":1}');
    const real = join(s.outside, "os-release.real"); writeFileSync(real, "ID=x\n"); const link = join(s.outside, "os-release"); symlinkSync(real, link);
    // A read truly outside (not in a temporary folder, which the collector leaves out): a folder in the home directory.
    const away = mkdtempSync(join(homedir(), ".fls-roles-test-")); const other = join(away, "other.txt"); writeFileSync(other, "o\n");
    bothRoles(s, "", `import { readFileSync } from "node:fs"; readFileSync(${JSON.stringify(join(states, "a.json"))}); readFileSync(${JSON.stringify(link)});`);
    const declared = [states, link];
    const clean = auditInputs({ root: s.dir, traceDir: s.trace, declared });
    assert.deepEqual(clean.inputs.untraceable, [], clean.inputs.untraceable.join("; "));
    assert.equal(declaredInputs({ root: s.dir, states: { ui5: states }, declaredPaths: clean.declaredPaths, chromium: "151" }).states.ui5, folderHash(states));
    s.run("audit", `import { readFileSync } from "node:fs"; readFileSync(${JSON.stringify(other)});`);
    try { assert.ok(auditInputs({ root: s.dir, traceDir: s.trace, declared }).inputs.untraceable.some(reason => reason.includes("other.txt"))); }
    finally { rmSync(away, { recursive: true, force: true }); }
    const before = folderHash(states);
    writeFileSync(join(states, "a.json"), '{"a":2}');
    assert.notEqual(folderHash(states), before, "a state changed: its folder hash changes");
  } finally { s.done(); }
});
