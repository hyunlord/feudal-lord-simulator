// RR25 (measured, user ruling 2026-10-09): a test's recorded inputs, and whether a set of changed files touches them.
// The same shape serves the geometry audit's rows (step (a)): { files, dirs, missing, untraceable }, paths relative to
// the repository root ('' is the root itself).
//   files: files read, required, imported, opened or stat'ed;  dirs: folders listed, walked or copied;
//   missing: paths looked for and absent;  untraceable: why the inputs cannot be trusted (then nothing is reused).
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Files whose change touches every test: what node_modules holds (its reads are not recorded) and the compiler setup. */
export const EVERY_TEST = Object.freeze(["package.json", "package-lock.json", "tsconfig.json"]);
const TEMP = [...new Set([tmpdir(), "/tmp", "/private/tmp", "/var/folders", "/private/var/folders"].map(path => resolve(path)))];

/** Where an absolute path stands: inside the repository (its relative path), a dependency or temporary file (null), or outside. */
const CASELESS = process.platform === "darwin" || process.platform === "win32";   // the file systems compare names without case
function place(root, absolute) {
  if (CASELESS && absolute.toLowerCase().startsWith(root.toLowerCase()) && [sep, undefined].includes(absolute[root.length])) absolute = root + absolute.slice(root.length);
  const rel = relative(root, absolute);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) return rel.split(sep).includes("node_modules") ? { ignore: true } : { rel: rel.split(sep).join("/") };
  if (absolute.split(sep).includes("node_modules") || TEMP.some(temp => absolute === temp || absolute.startsWith(temp + sep))) return { ignore: true };
  return { outside: absolute };
}

/**
 * The measured inputs of every test file that ran with traceReads.mjs: test (relative path) -> inputs. V8's script list
 * (NODE_V8_COVERAGE) and the loader thread's modules join the main record by process id.
 */
export function collectTestInputs({ root: given, traceDir, coverageDir = null }) {
  const root = realpathSync(given);   // processes record real paths (/tmp is /private/tmp on macOS)
  const byTest = new Map();
  if (!existsSync(traceDir)) return byTest;
  const scripts = new Map();   // pid -> absolute paths V8 compiled
  if (coverageDir !== null && existsSync(coverageDir)) {
    for (const name of readdirSync(coverageDir)) {
      const pid = /^coverage-(\d+)-/.exec(name)?.[1]; if (pid === undefined) continue;
      let result = []; try { result = JSON.parse(readFileSync(join(coverageDir, name), "utf8")).result ?? []; } catch { continue; }
      if (!scripts.has(pid)) scripts.set(pid, new Set());
      for (const entry of result) if (typeof entry.url === "string" && entry.url.startsWith("file:")) { try { scripts.get(pid).add(fileURLToPath(entry.url.split("?")[0])); } catch { /* not a path */ } }
    }
  }
  for (const name of readdirSync(traceDir)) {
    if (!name.endsWith(".json")) continue;
    let record; try { record = JSON.parse(readFileSync(join(traceDir, name), "utf8")); } catch { continue; }
    const pid = String(record.pid);
    const at = path => resolve(record.cwd ?? root, path);
    const modules = existsSync(join(traceDir, `${pid}.modules`)) ? readFileSync(join(traceDir, `${pid}.modules`), "utf8").split("\n").filter(Boolean) : [];
    const inputs = { files: new Set(), dirs: new Set(), missing: new Set(), untraceable: new Set(record.untraceable ?? []) };
    const add = (into, absolute, outsideIsUntraceable) => {
      const where = place(root, absolute);
      if (where.rel !== undefined) into.add(where.rel);
      else if (where.outside !== undefined && outsideIsUntraceable) inputs.untraceable.add(`reads outside the repository: ${where.outside}`);
    };
    for (const path of [...record.files, ...modules, ...(scripts.get(pid) ?? [])]) add(inputs.files, at(path), true);
    for (const path of record.dirs) add(inputs.dirs, at(path), true);
    for (const path of record.missing) add(inputs.missing, at(path), false);   // a parent folder's missing tsconfig is no input
    const test = place(root, at(record.test)).rel; if (test === undefined) continue;
    const before = byTest.get(test);
    if (before === undefined) byTest.set(test, inputs);
    else for (const key of Object.keys(inputs)) for (const value of inputs[key]) before[key].add(value);   // a test file run twice: both runs
  }
  return new Map([...byTest].map(([test, inputs]) => [test, Object.fromEntries(Object.entries(inputs).map(([key, values]) => [key, [...values].sort()]))]));
}

/** A compact form for a record: one path table, per test the indexes. */
export function packInputs(byTest) {
  const paths = []; const index = new Map();
  const id = path => { if (!index.has(path)) { index.set(path, paths.length); paths.push(path); } return index.get(path); };
  const tests = {};
  for (const [test, inputs] of byTest) tests[test] = { f: inputs.files.map(id), d: inputs.dirs.map(id), m: inputs.missing.map(id), u: inputs.untraceable };
  return { schema: 1, paths, tests };
}

/** One test's inputs from a packed form, or null when it holds none for that test. */
export function unpackInputs(packed, test) {
  // A record whose inputs are missing, of another schema or broken counts as unmeasured: its test always runs again.
  if (packed?.schema !== 1 || !Array.isArray(packed.paths) || packed.tests === null || typeof packed.tests !== "object") return null;
  const entry = packed.tests[test];
  if (entry === undefined || entry === null || typeof entry !== "object" || ![entry.f, entry.d, entry.m].every(list => list === undefined || Array.isArray(list))) return null;
  const at = indexes => (indexes ?? []).map(index => packed.paths[index]).filter(path => typeof path === "string");
  return { files: at(entry.f), dirs: at(entry.d), missing: at(entry.m), untraceable: entry.u ?? [] };
}

/** The changes between two trees or commits: [{ status: "A" | "M" | "D" | …, path }], renames as a delete and an add. */
export function treeChanges(cwd, from, to) {
  const out = execFileSync("git", ["diff", "--name-status", "--no-renames", "-z", from, to], { cwd, encoding: "utf8", maxBuffer: 256 << 20, stdio: ["ignore", "pipe", "ignore"] });
  const parts = out.split("\0"); const changes = [];
  for (let k = 0; k + 1 < parts.length; k += 2) changes.push({ status: parts[k].slice(0, 1), path: parts[k + 1] });
  return changes;
}

/**
 * The changed paths that touch these inputs: a file read or a path looked for (now changed, added or deleted), anything
 * under a folder listed, or a file every test depends on. A module added where an import used to resolve elsewhere
 * (src/m.ts beside src/m/index.ts) is a path the resolver looked for and missed: it is in `missing`.
 */
export function inputOverlap(inputs, changes) {
  const files = new Set(inputs.files); const missing = new Set(inputs.missing);
  const under = path => inputs.dirs.some(dir => dir === "" || path === dir || path.startsWith(`${dir}/`));
  return changes.filter(({ path }) => EVERY_TEST.includes(path) || files.has(path) || missing.has(path) || under(path)).map(change => change.path).sort();
}
