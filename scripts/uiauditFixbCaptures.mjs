// UI-AUDIT-1 fix group B evidence: the chronicle and legacy surfaces opened as the geometry audit opens them
// (src/ui/surfaces.registry.ts chains), measured with its checks (scripts/uiGeometryMeasure.ts) and captured, on this
// build and on the base build beside it. The book is measured page by page (the audit's row stops at its title page).
// Each surface is measured twice: `audit` is the audit's own reading; `box` reads the root's content box
// (border = the frame's safe inset, padding = the gap: the frame token contract) instead of the frame layer's widths.
//   PLAYWRIGHT_MODULE=… node_modules/.bin/tsx scripts/uiauditFixbCaptures.mjs <out> --url <this> [--base <base>] --states5 <dir> --states9 <dir> --states10 <dir>
// On the DGX through scripts/uiauditFixbVerification.sh. Writes <out>/<build>-<name>.jpg (the listed captures) and
// <out>/measures.json.
import { refuseHeavyOnMac } from './remote/localGuard.mjs';
refuseHeavyOnMac('브라우저 캡처(scripts/uiauditFixbCaptures.mjs)', { remote: 'scripts/remote/run.sh render-UIAUDIT-fixb -- bash scripts/uiauditFixbVerification.sh <base>', entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
import { FRAME_GAP_PX, SURFACES, VIEWPORTS } from '../src/ui/surfaces.registry.ts';
import { collectSurface, evaluateSurface } from './uiGeometryMeasure.ts';
import { extremeNumbers, mapTile, sceneTile } from './uiGeometryScene.ts';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const builds = [['after', flag('url')], ...(flag('base') === undefined ? [] : [['before', flag('base')]])];
const DIRS = { ui5: flag('states5'), ui9: flag('states9'), ui10: flag('states10') };
mkdirSync(out, { recursive: true });

const NAME_SHIM = 'globalThis.__name = globalThis.__name || (target => target);';
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const byId = new Map(SURFACES.map(row => [row.id, row]));
const chainOf = row => row.extends === undefined ? [row] : [...chainOf(byId.get(row.extends)), row];
const shown = selector => `${selector} >> visible=true`;

async function runStep(page, state, step) {
  if ('click' in step) {
    const choices = Array.isArray(step.click) ? step.click : [step.click];
    for (const selector of choices) if (await page.locator(shown(selector)).count() > 0) { await page.locator(shown(selector)).first().click({ timeout: 10_000 }); return; }
    await page.locator(shown(choices[0])).first().click({ timeout: 10_000 });
  } else if ('clickAll' in step) {
    for (let guard = 0; guard < 24 && await page.locator(shown(step.clickAll)).count() > 0; guard += 1) { await page.locator(shown(step.clickAll)).first().click({ timeout: 10_000 }); await pause(150); }
  } else if ('wait' in step) await page.locator(shown(step.wait)).first().waitFor({ timeout: step.timeout ?? 20_000 });
  else if ('pause' in step) await pause(step.pause);
  else if ('dismiss' in step) {
    for (const selector of step.dismiss) if (await page.locator(shown(selector)).count() > 0) { await page.locator(shown(selector)).first().click({ timeout: 10_000 }).catch(() => undefined); await pause(400); }
  } else if ('key' in step) await page.keyboard.press(step.key);
  else if ('map' in step) {
    const point = await page.evaluate(at => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), mapTile(state, step.map));
    await page.mouse.click(point.clientX, point.clientY);
  } else throw new Error(`step not supported here: ${JSON.stringify(step)}`);
}

const specOf = row => ({ root: row.root, frame: row.frame, gap: FRAME_GAP_PX, frameLayer: row.frameLayer, contentSlot: row.contentSlot, frameSlots: row.frameSlots,
  scroll: row.scroll, scrollParts: row.scrollParts, painting: row.painting, portraitRing: row.portraitRing, siblingsNoOverlap: row.siblingsNoOverlap });
/** The content-box reading: a layer surface measured by its root's border and padding alone. */
const boxSpec = spec => spec.frame === 'layer' ? { ...spec, frame: 'flat', frameLayer: undefined, contentSlot: undefined } : spec;
const brief = evaluation => ({ total: evaluation.failures.length, counts: Object.fromEntries(Object.entries(evaluation.counts).filter(([, count]) => count > 0)),
  first: evaluation.failures.slice(0, 8).map(failure => `${failure.check}: ${failure.what} — ${failure.path} ${failure.px}px`) });

async function measure(page, row, name, shot) {
  const spec = specOf(row);
  const collected = await page.evaluate(collectSurface, spec);
  if (!collected.found) return { name, found: false };
  const audit = brief(evaluateSurface(collected, spec));
  const box = brief(evaluateSurface(await page.evaluate(collectSurface, boxSpec(spec)), boxSpec(spec)));
  if (shot !== null) {
    const rect = collected.root.rect; const view = collected.viewport;
    const clip = { x: Math.max(0, rect.l - 8), y: Math.max(0, rect.t - 8) };
    clip.width = Math.min(view.w, rect.r + 8) - clip.x; clip.height = Math.min(view.h, rect.b + 8) - clip.y;
    await page.screenshot({ path: join(out, shot), type: 'jpeg', quality: 62, clip });
  }
  return { name, found: true, root: collected.root.rect, audit, box };
}

/** Opens `id`'s chain on a fresh scene. */
async function open(browser, url, id, condition) {
  const row = byId.get(id); const scene = chainOf(row)[0].scene; const viewport = VIEWPORTS[condition.viewport];
  const base = JSON.parse(readFileSync(join(DIRS[scene.set], `${scene.name}.json`), 'utf8'));
  const state = condition.numbers === 'extreme' ? extremeNumbers(base) : base;
  const opened = await openScene(browser, { state, tile: sceneTile(state, scene.tile), baseUrl: url, width: viewport.width, height: viewport.height, zoom: scene.zoom ?? 1.1,
    run: false, hasTouch: viewport.touch, initScript: `${NAME_SHIM}${TUTORIAL_OFF}`, query: `${scene.query ?? ''}${condition.copy === 'long' ? '&pseudo-long=1' : ''}` });
  for (const step of chainOf(row).flatMap(item => item.open)) await runStep(opened.page, state, step);
  return opened;
}

const CONDITIONS = [{ viewport: '1280x800', copy: 'normal', numbers: 'normal' }, { viewport: '1280x800', copy: 'long', numbers: 'extreme' },
  { viewport: 'tablet-1180x820', copy: 'long', numbers: 'extreme' }, { viewport: '1920x1080', copy: 'normal', numbers: 'normal' }];
const tag = condition => `${condition.viewport}-${condition.copy}-${condition.numbers}`;
/** The captures kept (the first condition only): record card, biography, the book's family page. */
const SHOTS = new Set(['modal.history.record-card', 'modal.history.biography', 'book.family']);

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};
for (const [build, url] of builds) {
  { const warm = await browser.newPage(); await warm.goto(url, { timeout: 180_000 }).catch(() => undefined); await warm.waitForTimeout(3_000); await warm.close(); }
  for (const condition of CONDITIONS) {
    const key = `${build}/${tag(condition)}`; const rows = []; results[key] = rows;
    const shotName = name => condition === CONDITIONS[0] && SHOTS.has(name) ? `${build}-${name}.jpg` : null;
    for (const id of ['modal.history.records', 'modal.history.record-card', 'modal.history.snapshot-map', 'modal.select-list', 'modal.history.decision',
      'modal.history.biography', 'modal.history.family-tree', 'modal.history.factions', 'modal.history.faction-page', 'modal.legacy-ending']) {
      let opened = null;
      try { opened = await open(browser, url, id, condition); rows.push(await measure(opened.page, byId.get(id), id, shotName(id))); }
      catch (error) { rows.push({ name: id, error: String(error).split('\n')[0].slice(0, 200) }); }
      finally { await opened?.context.close().catch(() => undefined); }
    }
    // The book, every page (next until the last).
    let opened = null;
    try {
      opened = await open(browser, url, 'modal.chronicle-book', condition);
      const row = byId.get('modal.chronicle-book');
      for (let page = 0; page < 20; page += 1) {
        await pause(450);
        const kind = await opened.page.locator('.legacy-book-page').first().getAttribute('data-kind');
        const name = `book.${kind === 'chapter' ? `chapter${page}` : kind}`;
        rows.push(await measure(opened.page, row, name, shotName(name)));
        const next = opened.page.locator(shown('.legacy-book-next')).first();
        if (await next.isDisabled()) break;
        await next.click({ timeout: 10_000 });
      }
    } catch (error) { rows.push({ name: 'modal.chronicle-book', error: String(error).split('\n')[0].slice(0, 200) }); }
    finally { await opened?.context.close().catch(() => undefined); }
    for (const row of rows) console.log(`${key} ${row.name}: ${row.error ?? (row.found ? `audit ${row.audit.total} box ${row.box.total}` : 'not found')}`);
  }
}
await browser.close();
writeFileSync(join(out, 'measures.json'), `${JSON.stringify(results, null, 1)}\n`);
