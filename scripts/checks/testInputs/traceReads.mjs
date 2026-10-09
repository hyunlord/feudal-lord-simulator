// RR25 (measured, user ruling 2026-10-09): what a test really reads, recorded while it runs. test:changed loads this
// with NODE_OPTIONS=--import into every test process; it writes one JSON per test process into $FLS_TRACE_DIR:
//   { pid, test, files, dirs, missing, untraceable }
// files: read, opened, stat'ed or required paths (main thread; the loader thread's modules come from traceHooks.mjs and
// V8's own script list, NODE_V8_COVERAGE); dirs: listed or copied folders; missing: paths looked for and absent (a test
// that checked a file that did not exist must run again when it appears); untraceable: why the record cannot be trusted
// (a child process, the network, a worker thread) — such a test is never reused. Only processes the test runner started
// for a test file (NODE_TEST_CONTEXT) write a record. Paths are as the test passed them; testInputs.mjs resolves them.
import childProcess from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import Module, { register, syncBuiltinESMExports } from "node:module";
import net from "node:net";
import workerThreads from "node:worker_threads";

const out = process.env.FLS_TRACE_DIR;
const testFile = process.env.NODE_TEST_CONTEXT ? process.argv.slice(1).reverse().find(arg => /\.test\.(ts|tsx|mts|mjs|js|cjs)$/.test(arg)) : undefined;

if (out && testFile) {
  const files = new Set(), dirs = new Set(), missing = new Set(), untraceable = new Set();
  const cwd = process.cwd();
  const pathOf = value => typeof value === "string" ? value : value instanceof URL ? (value.protocol === "file:" ? decodeURIComponent(value.pathname) : null)
    : Buffer.isBuffer(value) ? value.toString() : null;
  const absent = (path, error) => { if (path !== null && (error?.code === "ENOENT" || error?.code === "ENOTDIR")) missing.add(path); };
  const syncReader = (target, name, into) => {
    const original = target[name]; if (typeof original !== "function") return;
    target[name] = function traced(...args) {
      const path = pathOf(args[0]);
      try {
        const result = original.apply(this, args);
        if (path !== null) { if (name === "existsSync" && result === false) missing.add(path); else into.add(path); }
        return result;
      } catch (error) { absent(path, error); throw error; }
    };
  };
  const asyncReader = (target, name, into) => {
    const original = target[name]; if (typeof original !== "function") return;
    target[name] = function traced(...args) {
      const path = pathOf(args[0]);
      const callback = typeof args.at(-1) === "function" ? args.length - 1 : -1;
      if (callback >= 0) {
        const done = args[callback];
        args[callback] = function (error, ...rest) { if (path !== null) { if (error) absent(path, error); else into.add(path); } return done.call(this, error, ...rest); };
        return original.apply(this, args);
      }
      const result = original.apply(this, args);
      if (result && typeof result.then === "function") return result.then(value => { if (path !== null) into.add(path); return value; }, error => { absent(path, error); throw error; });
      if (path !== null) into.add(path);
      return result;
    };
  };
  for (const name of ["readFileSync", "statSync", "lstatSync", "existsSync", "openSync", "accessSync", "realpathSync", "createReadStream", "readlinkSync"]) syncReader(fs, name, files);
  for (const name of ["readdirSync", "opendirSync", "cpSync", "globSync"]) syncReader(fs, name, dirs);
  for (const name of ["readFile", "stat", "lstat", "open", "access", "realpath", "readlink"]) { asyncReader(fs, name, files); asyncReader(fsp, name, files); }
  for (const name of ["readdir", "opendir", "cp", "glob"]) { asyncReader(fs, name, dirs); asyncReader(fsp, name, dirs); }
  // What cannot be followed: another process, the network, another thread.
  const mark = (target, names, why) => { for (const name of names) { const original = target[name]; if (typeof original !== "function") continue; target[name] = function marked(...args) { untraceable.add(why); return original.apply(this, args); }; } };
  mark(childProcess, ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"], "child process");
  // A socket path (tsx talks to its parent through one) is no network; a host or port is.
  for (const name of ["connect", "createConnection"]) {
    const original = net[name]; if (typeof original !== "function") continue;
    net[name] = function marked(...args) {
      const [first] = args;
      const ipc = typeof first === "string" ? !/^\d+$/.test(first) : first !== null && typeof first === "object" && typeof first.path === "string";
      if (!ipc) untraceable.add("network");
      return original.apply(this, args);
    };
  }
  mark(http, ["request", "get"], "network"); mark(https, ["request", "get"], "network");
  if (typeof globalThis.fetch === "function") { const original = globalThis.fetch; globalThis.fetch = function marked(...args) { untraceable.add("network"); return original.apply(this, args); }; }
  const Worker = workerThreads.Worker;
  // esbuild's own service thread (tsx compiles the TypeScript with it) reads nothing of the repository; any other is a thread we cannot follow.
  const esbuild = /[\\/]node_modules[\\/]esbuild[\\/]lib[\\/]main\.js$/;
  workerThreads.Worker = class TracedWorker extends Worker { constructor(...args) { if (!esbuild.test(String(args[0] instanceof URL ? args[0].pathname : args[0]))) untraceable.add("worker thread"); super(...args); } };
  syncBuiltinESMExports();
  // CommonJS (and tsx's compiled imports): every resolved module file.
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function traced(...args) { const resolved = resolveFilename.apply(this, args); if (typeof resolved === "string" && resolved.startsWith("/")) files.add(resolved); return resolved; };
  // ES modules through the loader chain.
  register(new URL("./traceHooks.mjs", import.meta.url), { data: { out, pid: process.pid } });
  process.on("exit", () => {
    try {
      fs.writeFileSync(`${out}/${process.pid}.json`, JSON.stringify({ pid: process.pid, test: testFile, cwd, files: [...files], dirs: [...dirs], missing: [...missing], untraceable: [...untraceable] }));
    } catch { /* the record is lost: testInputs.mjs finds no record for this test, which then is never reused */ }
  });
}
