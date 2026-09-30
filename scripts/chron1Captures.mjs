// CHRON-1 gates ①–⑤ in the browser (JPEG captures and one JSON of what each showed), on the seed 2 chapter 1 state
// (scripts/chron1States.ts):
//  ① the chronicle screen from the chapter page's [전체 연대기 보기]: the timeline, three card kinds, the filters (kind,
//    severity, years, person), the season ruler; C and the ledger drawer's tab open it too, Esc / C close it
//  ② the map then in four seasons (the season closes' thumbnails), and beside today's map
//  ③ the decision record of the Great Famine's answer
//  ④ one biography with its portrait (the pool JPEG loaded, the match line)
//  ⑤ a modal: time stops while it is up (the tick holds at 1x), and a ledger of 30,000 records opens in < 200 ms
//   PLAYWRIGHT_MODULE=... node scripts/chron1Captures.mjs <out-dir> --url <url> --states <dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/chron1Captures.mjs)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node scripts/chron1Captures.mjs …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4282/';
const statesDir = flag('states');
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url, errors: [], gates: {} };
// UI-KIT-1: the chronicle's filters are kit selects (a button and a list panel), not native <select>s. Opens the one
// labelled `label` (null: the person filter), presses its option `index`; returns every option's text.
const kitSelect = async (page, label, index) => {
  const box = label === null ? page.locator('.chronicle-select--person') : page.locator('.chronicle-select').filter({ hasText: label });
  await box.locator('.ui-select-trigger').click();
  const options = box.locator('[role="option"]');
  const texts = await options.allTextContents();
  await options.nth(Math.max(0, Math.min(index, texts.length - 1))).click();
  return texts;
};
const shot = (page, file, clip) => page.screenshot({ path: join(out, file), type: 'jpeg', quality: 72, ...(clip ? { clip } : {}) });
const state = JSON.parse(readFileSync(join(statesDir, 'chapter-end.json'), 'utf8'));
const tileOf = () => { const b = state.buildings.find(x => x.kind === 'chapel') ?? state.buildings[0]; return [b.tx, b.ty]; };
const tick = page => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tick);
const screen = page => page.locator('.chronicle-screen');
const detailClip = async page => { const box = await page.locator('.chronicle-detail').boundingBox(); return box ?? undefined; };
const facts = page => page.evaluate(() => ({
  records: Number(document.querySelector('.chronicle-screen')?.getAttribute('data-records') ?? -1),
  cards: [...document.querySelectorAll('.chronicle-card')].map(card => card.getAttribute('data-kind')),
  markers: [...document.querySelectorAll('.chronicle-marker')].map(marker => marker.getAttribute('data-marker')),
  detail: document.querySelector('.chronicle-detail-body')?.getAttribute('data-detail') ?? null,
  count: document.querySelector('.chronicle-count')?.textContent ?? null,
}));

async function open(name, extra = {}) {
  const opened = await openScene(browser, { state: extra.state ?? state, tile: tileOf(), baseUrl: url, width: extra.width ?? 1280, height: extra.height ?? 720,
    zoom: 1.2, run: false, initScript: TUTORIAL_OFF, hasTouch: extra.hasTouch ?? false, isMobile: extra.isMobile ?? false });
  opened.page.on('pageerror', error => result.errors.push(`${name}: ${String(error)}`));
  opened.page.on('console', message => { if (message.type() === 'error') result.errors.push(`${name} console: ${message.text()}`); });
  return opened;
}

// ① The chapter page, then the full chronicle from it.
{
  const { context, page } = await open('chapter');
  await page.locator('.chronicle-page').waitFor({ timeout: 15_000 });
  await shot(page, 'c01-chapter-page.jpg');
  await page.getByRole('button', { name: '전체 연대기 보기' }).click();
  await screen(page).waitFor();
  await page.waitForTimeout(600);
  await shot(page, 'c02-chronicle-open.jpg');
  const opened = await facts(page);
  // The famine era's start on the strip (the second segment's left edge): the list goes to it.
  const strip = await page.locator('.chronicle-strip').boundingBox();
  await page.mouse.click(strip.x + strip.width * (41 / 1024 + 0.2 * 943 / 1024) + 2, strip.y + strip.height * 0.4);
  await page.waitForTimeout(400);
  await shot(page, 'c02b-famine-era.jpg');
  const famineEra = await facts(page);
  // Every severity: the everyday cards (season lines, bundles, people) join the weighty ones.
  await kitSelect(page, '중요도', 0);
  await page.waitForTimeout(300);
  await shot(page, 'c03-all-records.jpg');
  const all = await facts(page);
  // Events and eras alone (their frames), then every kind again.
  for (const kind of ['decision', 'milestone', 'person', 'ledger']) await page.locator(`.chronicle-kind[data-kind="${kind}"]`).click();
  await page.waitForTimeout(300);
  await shot(page, 'c03b-events-eras.jpg');
  const eventsEras = await facts(page);
  for (const kind of ['decision', 'milestone', 'person', 'ledger']) await page.locator(`.chronicle-kind[data-kind="${kind}"]`).click();
  await page.waitForTimeout(200);
  // Kinds: the decisions alone, then the Great Famine's answer picked (③).
  for (const kind of ['event', 'era', 'milestone', 'person', 'ledger']) await page.locator(`.chronicle-kind[data-kind="${kind}"]`).click();
  await page.waitForTimeout(300);
  const famine = page.locator('.chronicle-card', { hasText: '대기근에' }).first();
  await famine.locator('.chronicle-card-body').click();
  await page.waitForTimeout(400);
  await shot(page, 'c04-decisions-famine.jpg');
  await shot(page, 'c05-famine-decision-record.jpg', await detailClip(page));
  const decision = await page.evaluate(() => ({ heading: document.querySelector('.chronicle-decision')?.getAttribute('aria-label') ?? null,
    rows: [...document.querySelectorAll('.chronicle-decision-row')].map(row => ({ delta: row.getAttribute('data-delta'), text: row.textContent })),
    chosen: document.querySelector('.chronicle-decision-chosen')?.textContent ?? null,
    alternatives: [...document.querySelectorAll('.chronicle-decision-column ul li')].map(li => li.textContent) }));
  const decisions = await facts(page);
  await page.locator('.chronicle-card', { hasText: '시장도시를 선포' }).first().locator('.chronicle-card-body').click();
  await page.waitForTimeout(400);
  await shot(page, 'c05b-market-town-decision-record.jpg', await detailClip(page));
  const marketTown = await page.evaluate(() => [...document.querySelectorAll('.chronicle-decision-row')].map(row => ({ delta: row.getAttribute('data-delta'), text: row.textContent })));
  // Years and person: a year range, then the most recorded person.
  for (const kind of ['event', 'era', 'milestone', 'person', 'ledger']) await page.locator(`.chronicle-kind[data-kind="${kind}"]`).click();
  const years = await kitSelect(page, '부터', 3);
  await kitSelect(page, '까지', Math.min(4, years.length - 1));
  await page.waitForTimeout(300);
  await shot(page, 'c06-year-range.jpg');
  const range = { from: years[3], to: years[4], ...(await facts(page)) };
  await kitSelect(page, '부터', 0);
  await kitSelect(page, '까지', 0);
  await kitSelect(page, null, 1);
  await page.waitForTimeout(300);
  await shot(page, 'c07-person-filter.jpg');
  const person = { id: personOption, ...(await facts(page)) };
  // The season ruler around a picked time.
  await kitSelect(page, null, 0);
  await page.getByRole('button', { name: '계절 보기' }).click();
  await page.waitForTimeout(300);
  const cells = page.locator('.chronicle-season');
  await cells.nth(5).click();
  await page.waitForTimeout(300);
  await shot(page, 'c08-season-ruler.jpg');
  const ruler = await page.evaluate(() => ({ cells: document.querySelectorAll('.chronicle-season').length,
    picked: document.querySelector('.chronicle-season[aria-pressed="true"]')?.getAttribute('aria-label') ?? null,
    detail: document.querySelector('.chronicle-detail-date')?.textContent ?? null }));
  result.gates.chronicle = { opened, famineEra, all, eventsEras, decisions, range, person, ruler,
    cardKinds: [...new Set([...famineEra.cards, ...all.cards, ...eventsEras.cards, ...decisions.cards])] };
  result.gates.decision = { famine: decision, marketTown };
  await context.close();
}

// ② The map then in four seasons (season lines of each season), and today's beside one.
{
  const { context, page } = await open('maps');
  await page.getByRole('button', { name: '계속 (샌드박스)' }).click().catch(() => undefined);
  await page.keyboard.press('KeyC');
  await screen(page).waitFor();
  await kitSelect(page, '중요도', 0);
  for (const kind of ['decision', 'event', 'era', 'milestone', 'person']) await page.locator(`.chronicle-kind[data-kind="${kind}"]`).click();
  await page.waitForTimeout(300);
  const maps = []; let ledgerCards = [];
  for (const [index, season] of ['봄', '여름', '가을', '겨울'].entries()) {
    const card = page.locator('.chronicle-card', { hasText: `년 ${season}` }).filter({ hasText: '계절 결산' }).first();
    await card.locator('.chronicle-card-body').click();
    await page.waitForTimeout(400);
    await shot(page, `c${String(9 + index).padStart(2, '0')}-map-${['spring', 'summer', 'autumn', 'winter'][index]}.jpg`, await detailClip(page));
    if (index === 0) { await shot(page, 'c09b-season-lines.jpg'); ledgerCards = (await facts(page)).cards; }
    maps.push(await page.evaluate(() => ({ date: document.querySelector('.chronicle-detail-date')?.textContent ?? null,
      snapshot: document.querySelector('.chronicle-maps')?.getAttribute('data-snapshot') ?? null, size: document.querySelector('.chronicle-maps')?.getAttribute('data-snapshot-size') ?? null,
      painted: (() => { const canvas = document.querySelector('.chronicle-map-canvas'); if (!canvas) return 0; const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; const colours = new Set(); for (let i = 0; i < data.length; i += 4 * 7) colours.add(`${data[i]},${data[i + 1]},${data[i + 2]}`); return colours.size; })(),
      legend: [...document.querySelectorAll('.chronicle-map-legend li')].map(li => li.textContent) })));
  }
  await page.getByRole('button', { name: '그때 지도와 지금 지도를 나란히 보기' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'c13-map-compare-now.jpg', await detailClip(page));
  const compare = await page.evaluate(() => [...document.querySelectorAll('.chronicle-map')].map(map => map.getAttribute('data-map')));
  // [위치로]: the screen closes and the camera goes to the record's place (a person's line carries their house).
  await page.locator('.chronicle-kind[data-kind="ledger"]').click();
  await page.locator('.chronicle-kind[data-kind="person"]').click();
  await page.waitForTimeout(200);
  const placed = page.locator('.chronicle-card[data-place]').first();
  const [tx, ty] = (await placed.getAttribute('data-place')).split(',').map(Number);
  const where = () => page.evaluate(tile => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx, ty });
  const before = await where();
  await placed.locator('.chronicle-card-action', { hasText: '위치로' }).click();
  await page.waitForTimeout(900);
  const after = await where();
  const viewport = page.viewportSize();
  const lookAt = { tile: [tx, ty], closed: await screen(page).count() === 0, before, after,
    centred: after !== null && Math.abs(after.clientX - viewport.width / 2) < 80 && Math.abs(after.clientY - viewport.height / 2) < 80 };
  await shot(page, 'c14-look-at.jpg');
  result.gates.maps = { seasons: maps, ledgerCards, compare, lookAt };
  await context.close();
}

// ④ A biography: the most recorded person with a portrait.
{
  const { context, page } = await open('biography');
  await page.getByRole('button', { name: '계속 (샌드박스)' }).click().catch(() => undefined);
  await page.keyboard.press('KeyC');
  await screen(page).waitFor();
  await kitSelect(page, null, 1);
  await page.waitForTimeout(300);
  await page.locator('.chronicle-card-action', { hasText: '인물' }).first().click();
  await page.locator('.chronicle-biography').waitFor();
  await page.waitForTimeout(800);
  await shot(page, 'c15-biography.jpg');
  const biography = await page.evaluate(async () => {
    const page = document.querySelector('.chronicle-biography');
    const style = getComputedStyle(document.querySelector('.chronicle-biography-portrait'));
    const src = /url\("?([^")]+)"?\)/.exec(style.backgroundImage)?.[1] ?? null;
    const response = src === null ? null : await fetch(src);
    const bytes = response === null ? 0 : (await response.arrayBuffer()).byteLength;
    const image = src === null ? null : await new Promise(done => { const img = new Image(); img.onload = () => done({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => done(null); img.src = src; });
    return { person: page?.getAttribute('data-person'), portrait: page?.getAttribute('data-portrait'), exact: page?.getAttribute('data-portrait-exact'),
      match: document.querySelector('.chronicle-biography-match')?.textContent ?? null, name: document.querySelector('.chronicle-biography-header h3')?.textContent ?? null,
      life: [...document.querySelectorAll('.chronicle-biography-life li')].length, relations: [...document.querySelectorAll('.chronicle-biography-band')[0]?.querySelectorAll('li') ?? []].length,
      src, status: response?.status ?? null, type: response?.headers.get('content-type') ?? null, bytes, image };
  });
  result.gates.biography = biography;
  await context.close();
}

// ⑤ Time stops (1x, the tick holds while the screen is up), C / the ledger tab / Esc, and the 30,000-record open.
{
  const { context, page } = await open('time');
  await page.getByRole('button', { name: '계속 (샌드박스)' }).click().catch(() => undefined);
  await page.getByRole('button', { name: '1배속', exact: true }).click();
  await page.waitForTimeout(1_000);
  const running = [await tick(page)]; await page.waitForTimeout(1_000); running.push(await tick(page));
  await page.keyboard.press('KeyC');
  await screen(page).waitFor();
  const held = [await tick(page)]; await page.waitForTimeout(2_000); held.push(await tick(page));
  await page.keyboard.press('KeyC');
  const closedByC = await screen(page).count() === 0;
  await page.waitForTimeout(1_000);
  const resumed = await tick(page);
  await page.keyboard.press('KeyL');
  await page.locator('[data-ledger-chronicle="open"]').click();
  await screen(page).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const escape = { closed: await screen(page).count() === 0, ledgerBack: await page.locator('.ledger-drawer').count() === 1 };
  result.gates.time = { running, held, closedByC, resumed, escape, stopped: held[1] === held[0] && running[1] > running[0] && resumed > held[1] };
  await context.close();
}
{
  // 30,000 records: the chapter's ledger repeated with fresh ids and ticks across 150 years.
  const records = state.history.records; const big = [];
  for (let index = 0; index < 30_000; index += 1) {
    const source = records[index % records.length];
    const { snapshotId: _unused, ...rest } = source;
    big.push({ ...rest, id: `h-${String(index + 1).padStart(6, '0')}`, tick: Math.floor(index * 19.9) });
  }
  const heavy = { ...state, tick: 600_000, history: { ...state.history, records: big, pendingActuals: [] } };
  const { context, page } = await open('heavy', { state: heavy });
  await page.getByRole('button', { name: '계속 (샌드박스)' }).click().catch(() => undefined);
  const opens = []; let rendered = null;
  for (let round = 0; round < 6; round += 1) {
    const ms = await page.evaluate(() => new Promise(done => {
      const started = performance.now();
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', key: 'c', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC', key: 'c', bubbles: true }));
      const wait = () => { if (document.querySelector('.chronicle-screen .chronicle-card') !== null) requestAnimationFrame(() => requestAnimationFrame(() => done(performance.now() - started))); else requestAnimationFrame(wait); };
      wait();
    }));
    opens.push(Math.round(ms));
    if (round === 0) { await shot(page, 'c16-thirty-thousand.jpg'); rendered = await page.evaluate(() => ({ cards: document.querySelectorAll('.chronicle-card').length,
      records: Number(document.querySelector('.chronicle-screen')?.getAttribute('data-records') ?? -1) })); }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  const sorted = [...opens].sort((a, b) => a - b);
  result.gates.thirtyThousand = { records: 30_000, opensMs: opens, medianMs: sorted[Math.floor(sorted.length / 2)], maxMs: sorted.at(-1), rendered, pass: sorted.at(-1) < 200 };
  await context.close();
}
{
  // Tablet 1180 x 820 (touch): the same screen.
  // A touch tablet (isMobile: the browser reports a coarse pointer, so the 48 px rules apply).
  const { context, page } = await open('tablet', { width: 1180, height: 820, hasTouch: true, isMobile: true });
  await page.getByRole('button', { name: '계속 (샌드박스)' }).tap().catch(() => undefined);
  // By touch: the dock's ledger, then its [연대기] tab.
  await page.locator('[data-dock="ledger"]').tap();
  await page.locator('[data-ledger-chronicle="open"]').tap();
  await screen(page).waitFor();
  await page.waitForTimeout(500);
  await shot(page, 'c17-tablet.jpg');
  result.gates.tablet = await page.evaluate(() => {
    const small = [...document.querySelectorAll('.chronicle-screen button, .chronicle-screen select')].filter(element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height < 48; })
      .map(element => `${element.className} ${Math.round(element.getBoundingClientRect().height)}`);
    const text = [...document.querySelectorAll('.chronicle-screen *')].filter(element => element.childNodes.length > 0 && [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim() !== ''))
      .map(element => parseFloat(getComputedStyle(element).fontSize)).filter(size => size < 12);
    return { coarse: matchMedia('(pointer: coarse)').matches, targetsUnder48: small, textUnder12: text.length };
  });
  // The biography on the tablet too.
  await page.locator('.chronicle-card-action', { hasText: '인물' }).first().tap();
  await page.locator('.chronicle-biography').waitFor();
  await page.waitForTimeout(600);
  await shot(page, 'c18-tablet-biography.jpg');
  await context.close();
}
await browser.close();
writeFileSync(join(out, 'captures.json'), `${JSON.stringify(result, null, 1)}\n`);
console.log(JSON.stringify({ errors: result.errors.length, time: result.gates.time?.stopped, thirty: result.gates.thirtyThousand, kinds: result.gates.chronicle?.cardKinds }));
