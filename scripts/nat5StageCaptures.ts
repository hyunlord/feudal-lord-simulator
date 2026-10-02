// NAT-5 stages evidence: each view of scripts/nat5StageViews.ts captured in the game (paused, tutorial off) from the gate
// states (scripts/nat5StageStates.ts). Starts its own vite dev server (no watch) on --port; writes one PNG per view and
// result.json (per view: the Wave 42 pictures loaded, the ground chunk counters, page errors) to <out>. Needs none of the
// NAT-5 modules, so the same views run on the base commit for the "before" frames.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/nat5StageCaptures.ts <out> --states <dir> --views <file> --port <port>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/nat5StageCaptures.ts)", { remote: "scripts/remote/run.sh render-NAT5-stages-<sha7> -- node_modules/.bin/tsx scripts/nat5StageCaptures.ts …", entry: import.meta.url });
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type View = { readonly name: string; readonly state: string; readonly tile: readonly [number, number]; readonly zoom: number;
  readonly width: number; readonly height: number; readonly clip: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } };
type Page = {
  waitForTimeout: (ms: number) => Promise<void>;
  screenshot: (options: object) => Promise<unknown>;
  evaluate: <T>(fn: () => T) => Promise<T>;
  on: (event: string, handler: (value: { message?: string; type?: () => string; text?: () => string }) => void) => void;
};
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const statesDir = flag("states") ?? ""; const viewsFile = flag("views") ?? ""; const port = Number(flag("port") ?? 4391);
mkdirSync(out ?? ".", { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const views = JSON.parse(readFileSync(viewsFile, "utf8")) as View[];
const result: Record<string, unknown> = {};
const errors: string[] = [];
const states = new Map<string, unknown>();
const state = (name: string) => { if (!states.has(name)) states.set(name, JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8"))); return states.get(name); };

const vite = spawn("node_modules/.bin/vite", ["--config", "scripts/remote/viteNoWatch.config.ts", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "ignore" });
const url = `http://127.0.0.1:${port}/`;
for (let tries = 0; tries < 90; tries += 1) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(done => setTimeout(done, 1_000));
}
/** The Wave 42 pictures the page has loaded (none on the base commit) and the ground chunk counters. */
const probe = (page: Page) => page.evaluate(async () => {
  const paths = ["/src/render/wave42StageArt.ts", "/src/render/wave42StageManifest.generated.ts"];
  let loaded: string[] | null = null;
  try {
    const art = await import(/* @vite-ignore */ paths[0] ?? "") as { stageArt: (key: string) => unknown };
    const manifest = await import(/* @vite-ignore */ paths[1] ?? "") as { WAVE42_STAGES: Record<string, unknown> };
    loaded = Object.keys(manifest.WAVE42_STAGES).filter(key => art.stageArt(key) !== null);
  } catch { loaded = null; }
  const port = (window as unknown as { __FEUDAL_PHASE10_PROOF__?: { diagnosis: () => { boundary: { chunks: unknown } | null } } }).__FEUDAL_PHASE10_PROOF__;
  return { wave42Loaded: loaded, chunks: port?.diagnosis().boundary?.chunks ?? null };
});

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const view of views) {
    try {
      const { context, page: opened } = await openScene(browser, { state: state(view.state), tile: view.tile, baseUrl: url, width: view.width, height: view.height,
        zoom: view.zoom, run: false, initScript: TUTORIAL_OFF, query: "&story-delay=600000", loadTimeout: 90_000 });
      const page = opened as Page;
      const pageErrors: string[] = [];
      page.on("pageerror", error => { pageErrors.push(String(error.message).slice(0, 300)); });
      page.on("console", message => { if (message.type?.() === "error") pageErrors.push((message.text?.() ?? "").slice(0, 300)); });
      // The pictures load on their first draw; the chunks re-raster once they have (their key's readiness bit).
      await page.waitForTimeout(4_000);
      await page.screenshot({ path: join(out ?? ".", `${view.name}.png`), clip: view.clip });
      result[view.name] = { view, ...(await probe(page)), pageErrors };
      await context.close();
    } catch (error) { errors.push(`${view.name}: ${String(error).slice(0, 300)}`); }
  }
} finally {
  await browser.close();
  vite.kill();
}
writeFileSync(join(out ?? ".", "result.json"), `${JSON.stringify({ ...result, errors }, null, 2)}\n`);
console.log(JSON.stringify({ views: views.length, errors }));
process.exit(errors.length === 0 ? 0 : 1);
