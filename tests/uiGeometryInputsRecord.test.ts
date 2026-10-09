import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { tempDir } from "./helpers/tempRepo";
import { auditInputs } from "../scripts/uiGeometryInputs.mjs";
import { inputOverlap } from "../scripts/checks/testInputs/testInputs.mjs";

// RR26 measured (a′, user ruling 2026-10-10): what the audit's dev server reads, measured for real — a throwaway project
// served by the repository's Vite 8 under the RR25 recorder (role `vite`, as scripts/remote/tasks.sh runs it) with the
// audit's own config file (scripts/remote/viteNoWatch.config.ts, copied as it is: watching off, the config files
// written out), its page loaded in Chromium. The required cases (user ruling) on that measurement: a src file no page
// loads changes nothing; a picture a CSS rule calls with url(), a module imported dynamically, a file changed to import
// a new one and a file added where an import looked and found nothing all do. Needs Playwright (the DGX runner sets it).
const REPO = resolve(import.meta.dirname, "..");
const playwright = process.env.PLAYWRIGHT_MODULE ?? process.env.FLS_PLAYWRIGHT_CORE;
const freePort = () => new Promise<number>(done => { const server = createServer(); server.listen(0, "127.0.0.1", () => { const port = (server.address() as { port: number }).port; server.close(() => done(port)); }); });

test("the dev server's reads, measured: what the page loads is in, what it does not is out", { skip: !playwright && "needs Playwright (the DGX runner)", timeout: 180_000 }, async () => {
  const dir = tempDir("fls-vite-inputs-");
  const trace = join(dir, ".trace"); mkdirSync(trace);
  const write = (path: string, text: string) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  write("index.html", '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>\n');
  write("src/main.ts", 'import "./style.css";\nimport { a } from "./a";\ndocument.getElementById("app")!.textContent = String(a);\nimport("./lazy.ts").then(m => { document.body.dataset.lazy = m.lazy; });\nconst optional = "./optional.ts"; try { await import(/* @vite-ignore */ optional); } catch { /* none yet */ }\n');
  write("src/a.ts", "export const a = 1;\n"); write("src/lazy.ts", 'export const lazy = "yes";\n'); write("src/unused.ts", "export const u = 1;\n");
  write("src/style.css", "body { background: url('/pic.png'); }\n#app { background: url('./img.png'); }\n");
  write("public/pic.png", "PNG1"); write("src/img.png", "PNG2");
  write("plugins/cfgPlugin.ts", 'export const cfgPlugin = () => ({ name: "cfg-plugin" });\n');
  write("vite.config.ts", 'import { cfgPlugin } from "./plugins/cfgPlugin";\nexport default { plugins: [cfgPlugin()], optimizeDeps: { entries: ["index.html"] } };\n');
  write("scripts/remote/viteNoWatch.config.ts", readFileSync(join(REPO, "scripts/remote/viteNoWatch.config.ts"), "utf8"));
  write("package.json", '{"name":"story","type":"module"}\n');
  const port = await freePort();
  const env = { ...process.env, FLS_TRACE_DIR: trace, FLS_TRACE_ROLE: "vite", FLS_TRACE_CHILDREN: "git", NODE_OPTIONS: `--import=${pathToFileURL(join(REPO, "scripts/checks/testInputs/traceReads.mjs")).href}` };
  delete (env as Record<string, string | undefined>).NODE_TEST_CONTEXT;
  const vite = spawn(join(REPO, "node_modules/.bin/vite"), ["--config", "scripts/remote/viteNoWatch.config.ts", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = ""; vite.stdout.on("data", chunk => { log += chunk; }); vite.stderr.on("data", chunk => { log += chunk; });
  try {
    for (let k = 0; k < 120 && !/Local:/.test(log); k += 1) await new Promise(done => setTimeout(done, 250));
    const { chromium } = await import(pathToFileURL(playwright!).href);
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${port}/`);
      await page.waitForFunction(() => document.body.dataset.lazy === "yes", null, { timeout: 30_000 });
      await page.waitForFunction(() => getComputedStyle(document.body).backgroundImage.includes("pic.png"), null, { timeout: 10_000 });
      await page.waitForTimeout(1_500);   // the pictures load; the server writes its record every second
    } finally { await browser.close(); }
    await new Promise(done => setTimeout(done, 1_500));
  } finally { try { process.kill(-vite.pid!, "SIGTERM"); } catch { /* gone */ } }
  await new Promise(done => setTimeout(done, 500));
  try {
    // Declared as scripts/remote/tasks.sh declares them (the system files that pick native binaries), and the outer
    // checkout's package.json, which Vite reads looking upward for a workspace root because this project sits inside it
    // (the real audit's parent, ~/fls-runs, has none).
    const { inputs } = auditInputs({ root: dir, traceDir: trace, declared: ["/proc/version", "/usr/bin/ldd", "/etc/os-release", join(REPO, "package.json")] });
    const files = new Set(inputs.files);
    for (const path of ["index.html", "src/main.ts", "src/a.ts", "src/style.css", "src/lazy.ts", "public/pic.png", "src/img.png", "vite.config.ts", "plugins/cfgPlugin.ts", "scripts/remote/viteNoWatch.config.ts"]) assert.ok(files.has(path), `${path} is read (${inputs.files.join(" ")})\n${log.slice(-600)}`);
    assert.ok(!files.has("src/unused.ts"), "a module nothing imports is not read");
    assert.ok(inputs.missing.includes("src/optional.ts"), `the dynamic import that found nothing is a missing path (${inputs.missing.join(" ")})`);
    assert.deepEqual(inputs.untraceable, ["no record of the audit"], "the server alone: nothing it did is untraceable");
    const measured = { ...inputs, untraceable: [] };
    const touched = (...changes: [string, string][]) => inputOverlap(measured, changes.map(([status, path]) => ({ status, path })));
    assert.deepEqual(touched(["M", "src/unused.ts"]), [], `a src file no page loads: no audit (dirs ${JSON.stringify(inputs.dirs)} lists ${JSON.stringify(inputs.lists)})`);
    assert.ok(inputs.lists?.includes(""), "the dependency scanner lists the root one level (its index.html glob): an entry added there counts, a file changed does not");
    assert.deepEqual(touched(["M", "public/pic.png"]), ["public/pic.png"], "a picture a CSS rule calls with url() (from public/)");
    assert.deepEqual(touched(["M", "src/img.png"]), ["src/img.png"], "a picture a CSS rule calls with url() (beside the CSS)");
    assert.deepEqual(touched(["M", "src/lazy.ts"]), ["src/lazy.ts"], "a module imported dynamically");
    assert.ok(touched(["M", "src/main.ts"], ["A", "src/new.ts"]).includes("src/main.ts"), "a file changed to import a new one");
    assert.deepEqual(touched(["A", "src/optional.ts"]), ["src/optional.ts"], "a file added where an import looked and found nothing");
    assert.deepEqual(touched(["M", "plugins/cfgPlugin.ts"]), ["plugins/cfgPlugin.ts"], "a file the config was bundled from (read natively by Rolldown, written out by the config)");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
