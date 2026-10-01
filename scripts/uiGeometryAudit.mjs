// UI-AUDIT-1 geometry audit (work order §2): every surface of src/ui/surfaces.registry.ts, opened the way a player
// opens it, in five viewports (1280×800, 1920×1080, tablet 1180×820 touch, 1024×768, 1280×720) × two copy lengths (normal, the dev
// server's 1.4× pseudo-long copy) × two number ranges (normal; extreme: the injected state's treasury 9,999,999d,
// population 1,234, every stock 99,999 and every person with a long name no name list has), measured in the page
// (scripts/uiGeometryMeasure.ts: outside, overflow, border, portrait, overlap, empty, controls; QA round 15: content, hud,
// ornament — from a second capture of the root with its text transparent and its controls hidden, scripts/uiGeometryPaint.ts).
// One scene load serves a row and its first `extends` child; another child loads the scene again and replays the
// chain. A step that timed out before anything was measured is tried again (up to three times); a tree with a condition
// still not opened after the pass runs again (two more rounds, half the pages).
// Writes <out>/geometry.json (row × condition → checks, the first 25 failures with the element path and px), <out>/geometry.md (the
// table), <out>/shots/*.jpg (a capture per failing row, the failures outlined red and the inner box dashed blue;
// ≤ --shots captures, ≤ 2 MB), and the committed summary (--summary, default docs/verification/uiaudit1/geometry.json:
// the input hash scripts/checks/uiGeometry.mjs compares, the failure count).
// Needs the dev server (?pseudo-long=1 is a dev-server transform): on the DGX, npm run remote:ui-geometry.
//   PLAYWRIGHT_MODULE=... node_modules/.bin/tsx scripts/uiGeometryAudit.mjs <out> --url <dev server> --states5 <dir> --states6 <dir>
//     --states8 <dir> --states9 <dir> --states10 <dir> --extra <dir> [--only id,prefix.] [--viewports …] [--copy normal,long]
//     [--numbers normal,extreme] [--jobs 4] [--shots 40] [--summary <path>|none]
// Exit 1 when any condition fails or cannot be opened.
import { refuseHeavyOnMac } from './remote/localGuard.mjs';
refuseHeavyOnMac('브라우저 캡처(scripts/uiGeometryAudit.mjs)', { remote: 'npm run remote:ui-geometry', entry: import.meta.url });
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
import { compareBaseline, geometryInputHash, geometryInputs, UI_GEOMETRY_BASELINE, UI_GEOMETRY_EXCEPTIONS, UI_GEOMETRY_SUMMARY, UI_INPUT_ROOTS } from './checks/uiGeometry.mjs';
import { FRAME_GAP_PX, HUD_ALWAYS, SURFACES, VIEWPORTS } from '../src/ui/surfaces.registry.ts';
import { FRAME_TOKENS } from '../src/ui/frameTokens.generated.ts';
import { CHECKS, collectSurface, evaluateSurface, failureKey, markFailures, revealSurface } from './uiGeometryMeasure.ts';
import { HIDE_CSS, paintFacts, STILL_CSS } from './uiGeometryPaint.ts';
import { decodePng } from './keyartDerivatives.ts';
import { extremeNumbers, mapTile, sceneTile } from './uiGeometryScene.ts';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const list = (name, all) => (flag(name) ?? all.join(',')).split(',').filter(Boolean);
if (out === undefined || out.startsWith('--')) { console.error('usage: uiGeometryAudit.mjs <out> --url <url> --states5 <dir> …'); process.exit(2); }
const url = flag('url') ?? 'http://127.0.0.1:5173/';
const STATE_DIRS = { ui5: flag('states5'), ui6: flag('states6'), ui8: flag('states8'), ui9: flag('states9'), ui10: flag('states10'), 'ui10-extra': flag('extra') };
const viewports = list('viewports', Object.keys(VIEWPORTS));
const copies = list('copy', ['normal', 'long']);
const numberModes = list('numbers', ['normal', 'extreme']);
const jobs = Number(flag('jobs') ?? 4);
const shotLimit = Number(flag('shots') ?? 40);
const SHOT_BYTES = 2 * 1024 * 1024;
const summaryPath = flag('summary') ?? UI_GEOMETRY_SUMMARY;
const only = flag('only')?.split(',').filter(Boolean) ?? null;
mkdirSync(join(out, 'shots'), { recursive: true });

// tsx wraps named functions with __name (keepNames); the page has no such helper.
const NAME_SHIM = 'globalThis.__name = globalThis.__name || (target => target);';
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const byId = new Map(SURFACES.map(row => [row.id, row]));
const children = new Map(SURFACES.map(row => [row.id, SURFACES.filter(other => other.extends === row.id)]));
// --only: a term is a row id, or (when no id equals it) a prefix — "map.selection" and "map.selection." pick the same rows.
const pickedBy = entry => SURFACES.some(row => row.id === entry) ? SURFACES.filter(row => row.id === entry)
  : SURFACES.filter(row => row.id.startsWith(entry.endsWith('.') ? entry : `${entry}.`) || row.id.startsWith(entry));
if (only !== null) {
  const empty = only.filter(entry => pickedBy(entry).length === 0);
  for (const entry of only) console.log(`--only ${entry}: ${pickedBy(entry).map(row => row.id).join(', ') || 'no row'}`);
  if (empty.length > 0) { console.error(`--only: no registry row for ${empty.join(', ')}`); process.exit(2); }
}
const picked = only === null ? null : new Set(only.flatMap(entry => pickedBy(entry).map(row => row.id)));
const selected = row => picked === null || picked.has(row.id);
/** A row to open: selected, or on the way to a selected one. */
const wanted = row => selected(row) || (children.get(row.id) ?? []).some(wanted);
const chainOf = row => row.extends === undefined ? [row] : [...chainOf(byId.get(row.extends)), row];

// --- States and the extreme numbers.
const stateCache = new Map();
function loadState(set, name) {
  const key = `${set}/${name}`;
  if (!stateCache.has(key)) {
    const dir = STATE_DIRS[set];
    if (dir === undefined) throw new Error(`no --${set === 'ui10-extra' ? 'extra' : `states${set.slice(2)}`} folder for ${key}`);
    stateCache.set(key, JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')));
  }
  return stateCache.get(key);
}
// --- Scenes and steps.
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const pageErrors = [];

async function loadScene(scene, condition) {
  const viewport = VIEWPORTS[condition.viewport];
  const long = condition.copy === 'long';
  if (scene.kind === 'state' || scene.kind === 'new-game') {
    const base = scene.kind === 'state' ? loadState(scene.set, scene.name) : null;
    const state = base !== null && condition.numbers === 'extreme' ? extremeNumbers(base) : base;
    const opened = await openScene(browser, { state, tile: state === null ? [45, 41] : scene.focus !== undefined ? (({ tx, ty }) => [tx, ty])(mapTile(state, scene.focus)) : sceneTile(state, scene.tile), baseUrl: url, width: viewport.width, height: viewport.height,
      zoom: scene.zoom ?? 1.1, run: false, hasTouch: viewport.touch, loadTimeout: 120_000,
      initScript: scene.kind === 'state' ? `${NAME_SHIM}${TUTORIAL_OFF}` : NAME_SHIM, query: `${scene.query ?? ''}${long ? '&pseudo-long=1' : ''}` });
    opened.page.on('pageerror', error => pageErrors.push(String(error).slice(0, 200)));
    // openScene starts the clock by the 1× seal's name, which the pseudo-long copy lengthens: press the second seal.
    if (scene.run) await opened.page.locator('.speed-seals .speed-seal').nth(1).click({ timeout: 10_000 });
    return { ...opened, state: state ?? { buildings: [], constructionSites: [], walkers: [] } };
  }
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch });
  await context.addInitScript(NAME_SHIM);
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(String(error).slice(0, 200)));
  await page.routeWebSocket('**', socket => socket.close());
  const target = new URL(scene.kind === 'route' ? scene.path : '', url);
  if (long) target.searchParams.set('pseudo-long', '1');
  await page.goto(target.href, { timeout: 120_000 });
  await page.locator(scene.kind === 'route' ? '[data-testid="ui-kit-gallery"]' : '.welcome-parchment').first().waitFor({ timeout: 60_000 });
  return { context, page, state: { buildings: [], constructionSites: [], walkers: [] } };
}

const shown = selector => `${selector} >> visible=true`;
async function runStep(page, state, step) {
  if ('click' in step) {
    const choices = Array.isArray(step.click) ? step.click : [step.click];
    for (const selector of choices) if (await page.locator(shown(selector)).count() > 0) { await page.locator(shown(selector)).first().click({ timeout: 10_000, force: step.force ?? false }); return; }
    try { await page.locator(shown(choices[0])).first().click({ timeout: 10_000, force: step.force ?? false }); }
    catch (error) { if (!step.optional) throw error; }
  } else if ('clickAll' in step) {
    for (let guard = 0; guard < 24 && await page.locator(shown(step.clickAll)).count() > 0; guard += 1) { await page.locator(shown(step.clickAll)).first().click({ timeout: 10_000 }); await pause(150); }
  } else if ('key' in step) await page.keyboard.press(step.key);
  else if ('wait' in step) {
    try { await page.locator(shown(step.wait)).first().waitFor({ timeout: step.timeout ?? 20_000 }); } catch (error) { if (!step.optional) throw error; }
  } else if ('pause' in step) await pause(step.pause);
  else if ('story' in step) {
    // As a player (and scripts/ui10Captures.ts): the waiting chips in turn; another petition is put off, a card that
    // offers no decision is closed.
    const wanted = () => page.locator(shown(step.story)).count().then(count => count > 0);
    if (!await page.locator(shown(step.story)).first().waitFor({ timeout: 8_000 }).then(() => true).catch(() => false)) {
      await page.locator(shown('.event-chip')).first().waitFor({ timeout: 30_000 }).catch(() => undefined);
      for (let chip = 0; chip < 8 && !await wanted(); chip += 1) {
        if (await page.locator(shown('.story-modal')).count() > 0) { await page.locator(shown('.story-modal-later')).first().click({ timeout: 5_000 }).catch(() => undefined); await pause(500); }
        if (await page.locator(shown('.event-chip')).count() === 0) break;
        await page.locator(shown('.event-chip')).first().click({ timeout: 5_000 }); await pause(600);
        if (await page.locator(shown('.event-card-decide')).count() > 0) { await page.locator(shown('.event-card-decide')).first().click({ timeout: 5_000 }); await pause(900); continue; }
        await page.locator(shown('.event-card-actions > button:last-child')).first().click({ timeout: 5_000 }).catch(() => undefined); await pause(500);
      }
      await page.locator(shown(step.story)).first().waitFor({ timeout: 30_000 });
    }
  } else if ('repeat' in step) {
    for (let turn = 0; turn < (step.max ?? 10) && await page.locator(shown(step.until)).count() === 0; turn += 1) {
      await page.locator(shown(step.repeat)).first().click({ timeout: 10_000 }); await pause(400);
    }
    await page.locator(shown(step.until)).first().waitFor({ timeout: 5_000 });
  } else if ('dismiss' in step) {
    for (const selector of step.dismiss) if (await page.locator(shown(selector)).count() > 0) { await page.locator(shown(selector)).first().click({ timeout: 10_000 }).catch(() => undefined); await pause(400); }
  } else if ('map' in step) {
    const point = await page.evaluate(at => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), mapTile(state, step.map));
    if (step.action === 'hover') await page.mouse.move(point.clientX, point.clientY, { steps: 3 });
    else if (step.action === 'tap') await page.touchscreen.tap(point.clientX, point.clientY).catch(() => page.mouse.click(point.clientX, point.clientY));
    else await page.mouse.click(point.clientX, point.clientY);
  } else if ('hoverEach' in step) {
    const buildings = state.buildings.filter(item => step.hoverEach.includes(item.kind)).slice(0, step.max ?? 12);
    for (const building of buildings) {
      const point = await page.evaluate(at => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), { tx: building.tx, ty: building.ty });
      await page.mouse.move(point.clientX, point.clientY, { steps: 2 }); await pause(500);
      if (await page.locator(shown(step.until)).count() > 0) return;
    }
    throw new Error(`no hovered building showed ${step.until}`);
  } else if ('holdTimers' in step) {
    // The page's timers stop (its CSS animations are held when the measure starts): a surface shown for a moment stays.
    await page.clock.install(); await page.clock.pauseAt(Date.now() + 1_000);
  } else throw new Error(`unknown step ${JSON.stringify(step)}`);
}

// --- Results.
const conditionsOf = row => {
  const stateScene = chainOf(row)[0].scene.kind === 'state';
  const rows = [];
  for (const viewport of viewports) for (const copy of copies) for (const numbers of numberModes) {
    if (row.viewports !== undefined && !row.viewports.includes(viewport)) continue;
    if (numbers === 'extreme' && (row.numbers === false || !stateScene)) continue;
    rows.push({ viewport, copy, numbers, id: `${viewport}/${copy}/${numbers}` });
  }
  return rows;
};
const results = {};
for (const row of SURFACES) if (selected(row)) results[row.id] = { frame: row.frame, root: row.root, data: row.data, ...(row.unreachable ? { unreachable: row.unreachable } : {}), conditions: {} };
const shots = { count: 0, bytes: 0, rows: new Set() };
const specOf = row => ({ root: row.root, frame: row.frame, gap: FRAME_GAP_PX, frameLayer: row.frameLayer, contentSlot: row.contentSlot, frameSlots: row.frameSlots,
  scroll: row.scroll, scrollParts: row.scrollParts, painting: row.painting, portraitRing: row.portraitRing, siblingsNoOverlap: row.siblingsNoOverlap, expect: row.expect,
  registryRoots: REGISTRY_ROOTS, requires: row.requires, hud: HUD_ALWAYS });
const REGISTRY_ROOTS = [...new Set(SURFACES.map(row => row.root))];
/** Framed roots on screen that no registry root matches: kind + class → the rows whose screens showed them. */
const unregisteredFramed = new Map();
/** The frame type a data-frame kind stands for (FRAME_TOKENS; "flat" has no art). */
const kindType = kind => kind === 'flat' ? 'flat' : FRAME_TOKENS[kind]?.type ?? 'unknown';

/** Two frames rendered (a page whose timers a holdTimers step stopped has no requestAnimationFrame: 250 ms then). */
const twoFrames = page => Promise.race([page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))), pause(250)]);

/** The two captures of the measured root (marked data-geometry-root by collectSurface): as it is, then its text transparent
 * and its controls hidden; the root's attribute and both styles are gone afterwards. The captures cover the part of the
 * root on screen (what its scrolling ancestors show, within the viewport); none of it on screen: no paint pass (undefined). */
async function paintPass(page, collected) {
  const box = collected.root.visible === undefined ? collected.root.rect : collected.root.visible; const view = collected.viewport;
  const x = box === null ? 0 : Math.max(0, Math.floor(box.l)); const y = box === null ? 0 : Math.max(0, Math.floor(box.t));
  const r = box === null ? 0 : Math.min(view.w, Math.ceil(box.r)); const b = box === null ? 0 : Math.min(view.h, Math.ceil(box.b));
  if (r - x < 1 || b - y < 1) {
    await page.evaluate(() => { for (const element of document.querySelectorAll('[data-geometry-root]')) element.removeAttribute('data-geometry-root'); }).catch(() => undefined);
    return undefined;
  }
  const clip = { x, y, width: r - x, height: b - y };
  const style = css => page.evaluate(text => { const element = document.createElement('style'); element.dataset.geometryPaint = ''; element.textContent = text; document.head.append(element); }, css);
  const frames = () => twoFrames(page);
  try {
    await style(STILL_CSS); await frames();
    const first = decodePng(await page.screenshot({ clip, type: 'png' }));
    await style(HIDE_CSS); await frames();
    const second = decodePng(await page.screenshot({ clip, type: 'png' }));
    return paintFacts(collected, first, second, { x: clip.x, y: clip.y });
  } finally {
    await page.evaluate(() => { for (const element of document.querySelectorAll('style[data-geometry-paint]')) element.remove();
      for (const element of document.querySelectorAll('[data-geometry-root]')) element.removeAttribute('data-geometry-root'); }).catch(() => undefined);
  }
}

const roundBox = box => box === null ? null : Object.fromEntries(Object.entries(box).map(([key, value]) => [key, Math.round(value * 10) / 10]));
async function measure(row, condition, page) {
  const spec = specOf(row);
  // The surface holds still from the moment it is measured (its CSS animations paused where they are; the paint pass's
  // STILL_CSS keeps them so): a fading screen is measured as it showed when the steps reached it, not half gone.
  await page.evaluate(selector => { for (const animation of document.getAnimations()) { const target = animation.effect?.target;
    if (target instanceof Element && [...document.querySelectorAll(selector)].some(root => root === target || root.contains(target))) animation.pause(); } }, row.root);
  // A root its scrolling ancestors show nothing of is scrolled to first (as a player does: the family tree's banner).
  if (await page.evaluate(revealSurface, row.root)) await twoFrames(page);
  let collected = await page.evaluate(collectSurface, spec);
  if (collected.found) { const paint = await paintPass(page, collected); if (paint !== undefined) collected = { ...collected, paint }; }
  const evaluation = evaluateSurface(collected, spec);
  for (const { kind, path } of collected.unregistered ?? []) {
    const key = `${kind} ${path}`; if (!unregisteredFramed.has(key)) unregisteredFramed.set(key, new Set()); unregisteredFramed.get(key).add(row.id);
  }
  const kind = collected.root?.kind ?? null;
  const record = evaluation.found
    ? { status: 'measured', counts: evaluation.counts, failures: evaluation.failures.slice(0, 25).map(failure => ({ ...failure, rect: roundBox(failure.rect) })),
      total: evaluation.failures.length, keys: [...new Set(evaluation.failures.map(failureKey))].sort(), empty: evaluation.empty, ...(evaluation.expectMissed ? { expectMissed: row.expect } : {}),
      inner: roundBox(evaluation.inner), root: roundBox(collected.root.rect), kind }
    : { status: 'not-found', error: `${row.root} not on screen after the steps${evaluation.expectMissed ? ` (and ${row.expect} missing)` : ''}` };
  results[row.id].conditions[condition.id] = record;
  if (evaluation.found && evaluation.failures.length > 0 && !shots.rows.has(row.id) && shots.count < shotLimit && shots.bytes < SHOT_BYTES) {
    shots.rows.add(row.id);
    const boxes = evaluation.failures.map(failure => failure.rect).filter(box => box !== null).slice(0, 40);
    const id = await page.evaluate(markFailures, { boxes, inner: evaluation.inner });
    const box = collected.root.rect; const view = collected.viewport;
    const clip = { x: Math.max(0, box.l - 16), y: Math.max(0, box.t - 16) };
    clip.width = Math.max(8, Math.min(view.w, box.r + 16) - clip.x); clip.height = Math.max(8, Math.min(view.h, box.b + 16) - clip.y);
    const file = join('shots', `${row.id}--${condition.id.replace(/\//g, '-')}.jpg`);
    await page.screenshot({ path: join(out, file), type: 'jpeg', quality: 55, clip }).catch(() => undefined);
    await page.evaluate(layer => document.getElementById(layer)?.remove(), id);
    try { const size = statSync(join(out, file)).size; shots.count += 1; shots.bytes += size; record.shot = file; } catch { /* no capture */ }
  }
  console.log(`${row.id} ${condition.id}: ${record.status}${record.status === 'measured' ? ` ${record.total} failure(s) ${CHECKS.filter(check => record.counts[check] > 0).map(check => `${check}=${record.counts[check]}`).join(' ')}` : ''}`);
}

/** A root row and its extends-tree in one condition: the first child continues on the page, a later one loads the scene again. */
async function runTree(rootRow, condition) {
  let opened = null; let at = null;
  const close = async () => { if (opened !== null) await opened.context.close().catch(() => undefined); opened = null; at = null; };
  const visit = async row => {
    if (!wanted(row)) return;
    const applies = conditionsOf(row).some(item => item.id === condition.id);
    if (!applies) return;
    if (row.unreachable !== undefined) { if (results[row.id]) results[row.id].conditions[condition.id] = { status: 'unreachable' }; return; }
    const parent = row.extends === undefined ? null : byId.get(row.extends);
    let done = false; let failedShot = null;
    for (let attempt = 1; attempt <= 3 && !done; attempt += 1) {
      try {
        if (opened === null || at !== (parent?.id ?? null)) {
          await close();
          opened = await loadScene(chainOf(row)[0].scene, condition);
          for (const step of chainOf(row).slice(0, -1).flatMap(item => item.open)) await runStep(opened.page, opened.state, step);
          at = parent?.id ?? null;
        }
        for (const step of row.open) await runStep(opened.page, opened.state, step);
        at = row.id;
        if (results[row.id]) await measure(row, condition, opened.page);
        done = true;
      } catch (error) {
        const retry = attempt < 3 && String(error).includes('Timeout');
        console.log(`${row.id} ${condition.id}: ${retry ? `attempt ${attempt} timed out, again` : 'FAILED'} ${String(error).split('\n')[0].slice(0, 200)}`);
        if (!retry) console.log(String(error).split('\n').slice(1, 14).map(line => `    ${line.slice(0, 200)}`).join('\n'));
        // The screen the step gave up on (once per row, in the capture budget).
        if (!retry && opened !== null && results[row.id] && !shots.rows.has(row.id) && shots.count < shotLimit && shots.bytes < SHOT_BYTES) {
          const file = join('shots', `x-${row.id}--${condition.id.replace(/\//g, '-')}.jpg`);
          if (await opened.page.screenshot({ path: join(out, file), type: 'jpeg', quality: 40 }).then(() => true).catch(() => false)) {
            shots.rows.add(row.id); shots.count += 1; shots.bytes += statSync(join(out, file)).size; failedShot = file;
          }
        }
        await close();
        if (!retry) {
          const message = String(error).split('\n')[0].slice(0, 300);
          if (results[row.id]) results[row.id].conditions[condition.id] = { status: 'error', error: message, ...(failedShot === null ? {} : { shot: failedShot }) };
          // The rows reached through it cannot be opened in this condition either.
          const below = item => (children.get(item.id) ?? []).flatMap(child => [child, ...below(child)]);
          for (const child of below(row)) if (results[child.id] && child.unreachable === undefined && conditionsOf(child).some(item => item.id === condition.id)) {
            results[child.id].conditions[condition.id] = { status: 'error', error: `not reached: ${row.id} failed (${message.slice(0, 120)})` };
          }
          return;
        }
      }
    }
    for (const child of children.get(row.id) ?? []) await visit(child);
  };
  try { await visit(rootRow); } finally { await close(); }
}

// --- Run: warm the dev server's module graph once, then the trees × conditions on `jobs` pages at a time.
const started = Date.now();
{ const warm = await browser.newPage(); await warm.goto(url, { timeout: 180_000 }).catch(() => undefined); await warm.waitForTimeout(3_000); await warm.close(); }
const queue = [];
for (const row of SURFACES) if (row.extends === undefined) for (const condition of new Map(SURFACES.filter(other => chainOf(other)[0] === row).flatMap(conditionsOf).map(item => [item.id, item])).values()) queue.push([row, condition]);
const drain = async (list, width) => { await Promise.all(Array.from({ length: Math.max(1, width) }, async () => { for (let next = list.shift(); next !== undefined; next = list.shift()) await runTree(...next); })); };
const trees = [...queue];
await drain(queue, jobs);
// A busy shared DGX (and the paused save's chapter page that sometimes never opens, UI-9b) leaves conditions unopened:
// their trees run again, up to two more rounds, on half the pages.
const retried = [];
for (let round = 1; round <= 2; round += 1) {
  const again = trees.filter(([root, condition]) => SURFACES.some(row => chainOf(row)[0] === root && results[row.id]?.conditions[condition.id]?.status === 'error'));
  if (again.length === 0) break;
  retried.push(again.length);
  console.log(`retry round ${round}: ${again.length} tree(s) with a condition not opened`);
  await drain(again, Math.ceil(jobs / 2));
}
await browser.close();

// --- Totals, the report, the committed summary.
const git = args => { try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const inputs = geometryInputs('HEAD');
// public/assets is left out of the status check: its LFS files can show as changed where git-lfs is missing.
const dirty = process.env.DIRTY === '1' || git(['status', '--porcelain', '--untracked-files=no', '--', ...UI_INPUT_ROOTS.map(item => item.root).filter(root => root !== 'public/assets')]) !== '';
const totals = { rows: Object.keys(results).length, conditions: 0, measured: 0, failures: 0, unopened: 0, unreachable: [], warnings: 0, byCheck: Object.fromEntries(CHECKS.map(check => [check, 0])) };
const bySurface = {};
const kindNotes = [];
for (const [id, row] of Object.entries(results)) {
  if (row.unreachable) { totals.unreachable.push(id); continue; }
  const kinds = [...new Set(Object.values(row.conditions).filter(record => record.status === 'measured').map(record => record.kind ?? 'none'))];
  row.kinds = kinds;
  for (const kind of kinds) {
    if (kind === 'none') kindNotes.push(`${id}: the root has no data-frame (${row.frame === 'flat' ? 'a container: its own border and the 8 px gap' : 'measured by its border and border-image'})`);
    else if (kindType(kind) !== row.frame) kindNotes.push(`${id}: data-frame="${kind}" is ${kindType(kind)}, the registry says ${row.frame}`);
  }
  const surface = { measured: 0, failures: 0, unopened: 0, byCheck: {}, conditionsFailing: 0, kinds };
  for (const record of Object.values(row.conditions)) {
    totals.conditions += 1;
    if (record.status !== 'measured') { surface.unopened += 1; totals.unopened += 1; continue; }
    surface.measured += 1; totals.measured += 1;
    if (record.total > 0) surface.conditionsFailing += 1;
    for (const check of CHECKS) if (record.counts[check] > 0) { surface.byCheck[check] = (surface.byCheck[check] ?? 0) + record.counts[check]; totals.byCheck[check] += record.counts[check]; }
    surface.failures += record.total; totals.failures += record.total;
    if (record.empty?.warn) totals.warnings += 1;
  }
  bySurface[id] = surface;
}
const run = process.env.RUN ?? `local-${new Date(started).toISOString().replace(/[:.]/g, '-')}`;
// Every failure's key (the gate's baseline compares them) and the numbers against the committed baseline and exceptions.
const failureKeys = Object.entries(results).flatMap(([id, row]) => Object.entries(row.conditions)
  .flatMap(([condition, record]) => (record.keys ?? []).map(key => `${id}|${condition}|${key}`))).sort();
const readDoc = path => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; } };
const against = compareBaseline({ keys: failureKeys, baseline: readDoc(UI_GEOMETRY_BASELINE)?.entries ?? [], exceptions: readDoc(UI_GEOMETRY_EXCEPTIONS)?.exceptions ?? [] });
const baselineLine = `Against the committed baseline: ${against.failures} failure key(s) counted (${against.excepted} more under ${against.exceptions} exception(s)); baseline ${against.baseline}, new ${against.added.length}, fixed ${against.fixed.length}.`;
const report = { run, url, commit: git(['rev-parse', 'HEAD']), dirty, inputs: inputs.length, inputHash: geometryInputHash(inputs), startedAt: new Date(started).toISOString(), durationS: Math.round((Date.now() - started) / 1000),
  axes: { viewports, copies, numbers: numberModes }, gapPx: FRAME_GAP_PX, totals, retried, shots: { count: shots.count, bytes: shots.bytes }, pageErrors: [...new Set(pageErrors)].slice(0, 40),
  kindNotes, unregisteredFramed: [...unregisteredFramed].map(([key, rows]) => ({ root: key, seenIn: [...rows].slice(0, 6) })), rows: results };
writeFileSync(join(out, 'geometry.json'), `${JSON.stringify(report)}\n`);

const md = [`# UI-AUDIT-1 geometry audit — ${run}`, '',
  `Commit ${report.commit.slice(0, 8)}${dirty ? ' (dirty tree)' : ''}, ${totals.rows} registry rows, ${totals.conditions} row × condition cells (${viewports.length} viewports × ${copies.length} copy × ${numberModes.length} numbers where they apply), ${Math.round(report.durationS / 60)} min.`,
  baselineLine,
  `Measured ${totals.measured}, not opened ${totals.unopened}, not reachable by design ${totals.unreachable.length}. Failures ${totals.failures}: ${CHECKS.map(check => `${check} ${totals.byCheck[check]}`).join(', ')}. Empty-space warnings ${totals.warnings}.`, '',
  `| surface | frame (data-frame) | measured | failing conditions | ${CHECKS.join(' | ')} | empty (min) | not opened | first failure |`, `|---|---|---|---|${CHECKS.map(() => '---').join('|')}|---|---|---|`];
for (const [id, row] of Object.entries(results)) {
  if (row.unreachable) { md.push(`| ${id} | ${row.frame} | — | — | ${CHECKS.map(() => '').join(' | ')} | | | not reachable: ${row.unreachable} |`); continue; }
  const surface = bySurface[id]; const records = Object.values(row.conditions).filter(record => record.status === 'measured');
  const first = records.flatMap(record => record.failures)[0];
  const minEmpty = records.length === 0 ? '' : Math.min(...records.map(record => record.empty?.ratio ?? 1)).toFixed(2);
  const errors = Object.values(row.conditions).filter(record => record.status !== 'measured').map(record => record.error).filter(Boolean);
  md.push(`| ${id} | ${row.frame} (${surface.kinds.join(', ')}) | ${surface.measured} | ${surface.conditionsFailing} | ${CHECKS.map(check => surface.byCheck[check] ?? 0).join(' | ')} | ${minEmpty} | ${surface.unopened}${errors.length ? ` (${errors[0].slice(0, 80).replace(/\|/g, '/')})` : ''} | ${first === undefined ? '' : `${first.check}: ${first.what} — \`${first.path.replace(/\|/g, '/')}\` ${first.px}px`} |`);
}
md.push('', `## Framed roots on screen that no registry row measures (${report.unregisteredFramed.length})`, '',
  ...(report.unregisteredFramed.length === 0 ? ['none'] : report.unregisteredFramed.map(entry => `- \`${entry.root}\` (seen with ${entry.seenIn.join(', ')})`)),
  '', `## Frame kind notes (${kindNotes.length})`, '', ...(kindNotes.length === 0 ? ['none'] : kindNotes.map(note => `- ${note}`)));
writeFileSync(join(out, 'geometry.md'), `${md.join('\n')}\n`);

if (summaryPath !== 'none') {
  mkdirSync(dirname(summaryPath), { recursive: true });
  const summary = { schema: 1, run, commit: report.commit, dirty, inputs: inputs.length, inputHash: report.inputHash, measuredAt: report.startedAt, report: join(out, 'geometry.json'),
    axes: report.axes, rows: totals.rows, conditions: totals.conditions, measured: totals.measured, failures: totals.failures, unopened: totals.unopened,
    unreachable: totals.unreachable, warnings: totals.warnings, byCheck: totals.byCheck, unregisteredFramed: report.unregisteredFramed.length,
    baseline: { entries: against.baseline, counted: against.failures, excepted: against.excepted, exceptions: against.exceptions, added: against.added.length, fixed: against.fixed.length },
    bySurface: Object.fromEntries(Object.entries(bySurface).map(([id, surface]) => [id, { failures: surface.failures, unopened: surface.unopened, byCheck: surface.byCheck }])),
    failureKeys };
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 1)}\n`);
}
console.log(JSON.stringify({ run, measured: totals.measured, failures: totals.failures, unopened: totals.unopened, byCheck: totals.byCheck, shots: shots.count }));
console.log(baselineLine);
process.exit(totals.failures === 0 && totals.unopened === 0 ? 0 : 1);
