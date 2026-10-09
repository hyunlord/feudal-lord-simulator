// RR25 (measured, user ruling 2026-10-09): what a test really reads, recorded while it runs. test:changed loads this
// with NODE_OPTIONS=--import into every test process; it writes one JSON per test process into $FLS_TRACE_DIR:
//   { pid, test, files, dirs, missing, untraceable }
// files: read, opened, stat'ed or required paths (main thread; the loader thread's modules come from traceHooks.mjs and
// V8's own script list, NODE_V8_COVERAGE); dirs: listed or copied folders; missing: paths looked for and absent (a test
// that checked a file that did not exist must run again when it appears); untraceable: why the record cannot be trusted
// (a child process, the network, a worker thread) — such a test is never reused. Only processes the test runner started
// for a test file (NODE_TEST_CONTEXT) write a record. A relative path is made absolute against the working folder at
// the time of the call (a test may chdir); a module or file that failed to resolve is recorded as missing too.
import childProcess from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import Module, { register, syncBuiltinESMExports } from "node:module";
import net from "node:net";
import { dirname, isAbsolute, resolve as resolvePath } from "node:path";
import workerThreads from "node:worker_threads";

const out = process.env.FLS_TRACE_DIR;
const testFile = process.env.NODE_TEST_CONTEXT ? process.argv.slice(1).reverse().find(arg => /\.test\.(ts|tsx|mts|mjs|js|cjs)$/.test(arg)) : undefined;
// RR26 measured (a′): a long-lived process records under a role instead of a test (the geometry audit's dev server and
// the audit itself), writes its record every second while it runs (it is stopped by a signal, not ended), and may name
// the programs it starts that read nothing of the repository on its behalf (FLS_TRACE_CHILDREN: git, the browser).
const role = process.env.FLS_TRACE_ROLE || undefined;
const allowedChildren = new Set((process.env.FLS_TRACE_CHILDREN ?? "").split(",").map(name => name.trim()).filter(Boolean));

if (out && (testFile || role)) {
  const files = new Set(), dirs = new Set(), lists = new Set(), missing = new Set(), untraceable = new Set(), children = new Set();
  const cwd = process.cwd();
  const rawPath = value => typeof value === "string" ? value : value instanceof URL ? (value.protocol === "file:" ? decodeURIComponent(value.pathname) : null)
    : Buffer.isBuffer(value) ? value.toString() : null;
  const pathOf = value => { const path = rawPath(value); return path === null || isAbsolute(path) ? path : resolvePath(process.cwd(), path); };
  // A wrapped function keeps its own properties (fs.realpathSync.native and fs.realpath.native, wrapped as well).
  const keep = (traced, original, wrap) => { for (const key of Object.keys(original)) traced[key] = original[key]; if (typeof original.native === "function") traced.native = wrap(original.native); return traced; };
  const absent = (path, error) => { if (path !== null && (error?.code === "ENOENT" || error?.code === "ENOTDIR")) missing.add(path); };
  // A folder listed one level (readdir without { recursive: true }) shows only which entries exist: `lists`; one walked
  // whole (recursive, glob, a copy): `dirs`. The rest of the record: files read, paths looked for and missed.
  const listing = args => (args.slice(1).some(arg => arg !== null && typeof arg === "object" && arg.recursive === true) ? dirs : lists);
  const setOf = (into, args) => (typeof into === "function" ? into(args) : into);
  // A file opened to write or append is no read (the telemetry plugin appends to its own log): open's flags say which.
  const writesOnly = (name, args) => /^open(Sync)?$/.test(name) && typeof args[1] === "string" && /^[wa]/.test(args[1]) && !args[1].includes("+");
  const syncReader = (target, name, into) => {
    const original = target[name]; if (typeof original !== "function") return;
    const wrap = fn => function traced(...args) {
      const path = writesOnly(name, args) ? null : pathOf(args[0]);
      try {
        const result = fn.apply(this, args);
        // existsSync false, or a stat with { throwIfNoEntry: false } that found nothing: a path looked for and missed.
        if (path !== null) { if ((name === "existsSync" && result === false) || (/^l?statSync$/.test(name) && result === undefined)) missing.add(path); else setOf(into, args).add(path); }
        return result;
      } catch (error) { absent(path, error); throw error; }
    };
    target[name] = keep(wrap(original), original, wrap);
  };
  const asyncReader = (target, name, into) => {
    const original = target[name]; if (typeof original !== "function") return;
    const wrap = fn => function traced(...args) {
      const path = writesOnly(name, args) ? null : pathOf(args[0]);
      const callback = typeof args.at(-1) === "function" ? args.length - 1 : -1;
      if (callback >= 0) {
        const done = args[callback];
        args[callback] = function (error, ...rest) { if (path !== null) { if (error) absent(path, error); else setOf(into, args).add(path); } return done.call(this, error, ...rest); };
        return fn.apply(this, args);
      }
      let result;
      try { result = fn.apply(this, args); } catch (error) { absent(path, error); throw error; }
      if (result && typeof result.then === "function") return result.then(value => { if (path !== null) setOf(into, args).add(path); return value; }, error => { absent(path, error); throw error; });
      if (path !== null) setOf(into, args).add(path);
      return result;
    };
    target[name] = keep(wrap(original), original, wrap);
  };
  // The first argument is what is read: a copy's source too (a test may copy a fixture to a temporary file and read that).
  for (const name of ["readFileSync", "statSync", "lstatSync", "existsSync", "openSync", "accessSync", "realpathSync", "createReadStream", "readlinkSync", "copyFileSync"]) syncReader(fs, name, files);
  for (const name of ["readdirSync", "opendirSync"]) syncReader(fs, name, listing);
  for (const name of ["cpSync", "globSync"]) syncReader(fs, name, dirs);
  for (const name of ["readFile", "stat", "lstat", "open", "access", "realpath", "readlink", "copyFile"]) { asyncReader(fs, name, files); asyncReader(fsp, name, files); }
  asyncReader(fs, "openAsBlob", files);
  for (const name of ["readdir", "opendir"]) { asyncReader(fs, name, listing); asyncReader(fsp, name, listing); }
  for (const name of ["cp", "glob"]) { asyncReader(fs, name, dirs); asyncReader(fsp, name, dirs); }
  // What cannot be followed: another process, the network, another thread. A marked function keeps its own properties,
  // symbols too (util.promisify.custom: promisify(execFile) resolves to { stdout, stderr } as without the recorder).
  const keepAll = (traced, original) => { for (const key of [...Object.getOwnPropertyNames(original), ...Object.getOwnPropertySymbols(original)]) { if (!["length", "name", "prototype", "arguments", "caller"].includes(key)) { try { Object.defineProperty(traced, key, Object.getOwnPropertyDescriptor(original, key)); } catch { /* fixed */ } } } return traced; };
  // A child process: its program's name, allowed when FLS_TRACE_CHILDREN names it (recorded as a child either way).
  const program = (name, args) => { const command = name === "fork" ? "node" : String(args[0] ?? ""); const first = name === "exec" || name === "execSync" ? command.trim().split(/\s+/)[0] : command; return first.split(/[\\/]/).pop() ?? first; };
  // Under a role, a node child that inherits the recorder (NODE_OPTIONS with this file, the same trace folder and role)
  // writes its own record under the role: it is followed (tsx runs the audit in such a child). A test's child writes none.
  const followed = (name, args, child) => {
    if (role === undefined || (child !== "node" && child !== process.execPath.split(/[\\/]/).pop())) return false;
    const options = args.slice(1).find(arg => arg !== null && typeof arg === "object" && !Array.isArray(arg));
    const env = options?.env ?? process.env;
    return String(env.NODE_OPTIONS ?? "").includes("traceReads.mjs") && env.FLS_TRACE_DIR === out && env.FLS_TRACE_ROLE === role;
  };
  for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) {
    const original = childProcess[name]; if (typeof original !== "function") continue;
    childProcess[name] = keepAll(function marked(...args) { const child = program(name, args); children.add(child); if (!allowedChildren.has(child) && !followed(name, args, child)) untraceable.add(role === undefined ? "child process" : `child process: ${child}`); return original.apply(this, args); }, original);
  }
  // The network: a host and port. Under a role, a connection to the loopback ports FLS_TRACE_LOOPBACK names (the traced
  // dev server, which records what it serves) is followed; anything else cannot be. A socket path is no network (tsx
  // talks to its parent through one).
  const loopbackPorts = new Set((process.env.FLS_TRACE_LOOPBACK ?? "").split(",").map(port => port.trim()).filter(Boolean));
  const network = (host, port) => {
    const target = `${host ?? "localhost"}:${port ?? "?"}`;
    if (role !== undefined && /^(127\.0\.0\.1|localhost|::1|\[::1\])$/.test(String(host ?? "localhost")) && loopbackPorts.has(String(port))) { children.add(`loopback:${port}`); return; }
    untraceable.add(role === undefined ? "network" : `network: ${target}`);
  };
  const urlTarget = value => { try { const url = new URL(String(value?.url ?? value)); return [url.hostname, url.port || (url.protocol === "https:" ? "443" : "80")]; } catch { return [undefined, undefined]; } };
  for (const name of ["connect", "createConnection"]) {
    const original = net[name]; if (typeof original !== "function") continue;
    net[name] = keepAll(function marked(...args) {
      const [first, second] = args;
      const ipc = typeof first === "string" ? !/^\d+$/.test(first) : first !== null && typeof first === "object" && typeof first.path === "string";
      if (!ipc) { if (first !== null && typeof first === "object") network(first.host, first.port); else network(typeof second === "string" ? second : undefined, first); }
      return original.apply(this, args);
    }, original);
  }
  for (const target of [http, https]) for (const name of ["request", "get"]) {
    const original = target[name]; if (typeof original !== "function") continue;
    target[name] = keepAll(function marked(...args) {
      const [first] = args;
      if (typeof first === "string" || first instanceof URL) network(...urlTarget(first)); else network(first?.hostname ?? first?.host, first?.port ?? (target === https ? 443 : 80));
      return original.apply(this, args);
    }, original);
  }
  if (typeof globalThis.fetch === "function") { const original = globalThis.fetch; globalThis.fetch = function marked(...args) { network(...urlTarget(args[0])); return original.apply(this, args); }; }
  const Worker = workerThreads.Worker;
  // esbuild's own service thread (tsx compiles the TypeScript with it) reads nothing of the repository; any other is a thread we cannot follow.
  const esbuild = /[\\/]node_modules[\\/]esbuild[\\/]lib[\\/]main\.js$/;
  workerThreads.Worker = class TracedWorker extends Worker { constructor(...args) { if (!esbuild.test(String(args[0] instanceof URL ? args[0].pathname : args[0]))) untraceable.add("worker thread"); super(...args); } };
  syncBuiltinESMExports();
  // CommonJS (and tsx's compiled imports): every resolved module file.
  const resolveFilename = Module._resolveFilename;
  Module._resolveFilename = function traced(request, parent, ...rest) {
    try {
      const resolved = resolveFilename.call(this, request, parent, ...rest);
      if (typeof resolved === "string" && resolved.startsWith("/")) files.add(resolved);
      return resolved;
    } catch (error) {
      // A relative require that found nothing: the path it looked for (with any extension or as a folder, testInputs.mjs).
      if (typeof request === "string" && /^\.{1,2}\//.test(request) && typeof parent?.filename === "string") missing.add(resolvePath(dirname(parent.filename), request));
      throw error;
    }
  };
  // ES modules through the loader chain.
  register(new URL("./traceHooks.mjs", import.meta.url), { data: { out, pid: process.pid } });
  const writeFile = fs.writeFileSync; let written = -1;
  const write = () => {
    const size = files.size + dirs.size + lists.size + missing.size + untraceable.size + children.size;
    if (size === written) return; written = size;
    try {
      writeFile(`${out}/${process.pid}.json`, JSON.stringify({ pid: process.pid, test: testFile, role, cwd, files: [...files], dirs: [...dirs], lists: [...lists], missing: [...missing], untraceable: [...untraceable], children: [...children] }));
    } catch { /* the record is lost: testInputs.mjs finds no record for this test, which then is never reused */ }
  };
  process.on("exit", write);
  if (role !== undefined) setInterval(write, 1_000).unref();
}
