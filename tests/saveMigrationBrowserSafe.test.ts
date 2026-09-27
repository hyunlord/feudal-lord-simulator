/**
 * The save code runs in the browser: a v9 save opened in the game walks every migration step, so no module the codec
 * and the migrations reach may touch a Node-only global (`process`, `Buffer`, `require`, `__dirname` …) or import a
 * Node builtin. UI-6/RES-REG found `process.env.MIG_DEBUG` in v9ToV10 stopping every v9-and-older save in the page.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";

const ROOTS = ["src/save/saveCodec.ts", "src/save/migrations/index.ts"];
const NODE_GLOBALS = ["process", "Buffer", "require", "__dirname", "__filename", "global", "setImmediate", "clearImmediate"];
const NODE_MODULES = new Set(builtinModules.flatMap(name => [name, `node:${name}`]));

/** The source with comments blanked and string contents emptied (template expressions kept as code). */
function codeOnly(source: string): string {
  let out = "";
  const templates: number[] = []; // brace depth at each open template expression
  let depth = 0;
  for (let at = 0; at < source.length; at += 1) {
    const char = source[at]!;
    const next = source[at + 1];
    if (char === "/" && next === "/") { while (at < source.length && source[at] !== "\n") at += 1; out += "\n"; continue; }
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", at + 2);
      out += source.slice(at, end < 0 ? source.length : end + 2).replace(/[^\n]/g, " ");
      at = end < 0 ? source.length : end + 1;
      continue;
    }
    if (char === "\"" || char === "'" || (char === "}" && templates.at(-1) === depth) || char === "`") {
      const quote = char === "}" ? "`" : char;
      if (char === "}") templates.pop();
      out += quote;
      at += 1;
      while (at < source.length) {
        const inner = source[at]!;
        if (inner === "\\") { at += 2; continue; }
        if (inner === "\n") out += "\n";
        if (inner === quote) { out += quote; break; }
        if (quote === "`" && inner === "$" && source[at + 1] === "{") { templates.push(depth); out += "${"; at += 1; break; }
        at += 1;
      }
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    out += char;
  }
  return out;
}

function importsOf(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g)].map(match => match[1]!);
}

function resolveLocal(from: string, specifier: string): string | null {
  const base = join(dirname(from), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (/\.tsx?$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

test("the save codec and every migration step reach no Node-only global or builtin module (they run in the browser)", () => {
  const seen = new Set<string>();
  const queue = [...ROOTS];
  const faults: string[] = [];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const specifier of importsOf(source)) {
      if (specifier.startsWith(".")) {
        const local = resolveLocal(file, specifier);
        if (local !== null) queue.push(local);
      } else if (NODE_MODULES.has(specifier)) faults.push(`${file}: imports ${specifier}`);
    }
    const code = codeOnly(source);
    code.split("\n").forEach((line, index) => {
      for (const name of NODE_GLOBALS) {
        if (new RegExp(`(?<![.\\w$])${name}(?![\\w$])(?!\\s*:)`).test(line)) faults.push(`${relative(".", file)}:${index + 1}: ${name}`);
      }
    });
  }
  assert.ok(seen.has("src/save/migrations/v9ToV10.ts"), "the walk reaches the migrations");
  assert.deepEqual(faults, []);
});

test("the check sees what it guards against: a Node global in code, not in a comment, a string or a property name", () => {
  const found = (source: string) => NODE_GLOBALS.filter(name => new RegExp(`(?<![.\\w$])${name}(?![\\w$])(?!\\s*:)`).test(codeOnly(source)));
  assert.deepEqual(found(`if (process.env.MIG_DEBUG) console.log("site");`), ["process"]);
  assert.deepEqual(found("const bytes = Buffer.from(text);"), ["Buffer"]);
  assert.deepEqual(found(`// process.env is Node's\nconst label = "process"; const t = \`\${state.process} Buffer\`; const o = { global: 1 };`), []);
  assert.deepEqual(found("const x = `a${process.argv[2]}b`;"), ["process"]);
});
