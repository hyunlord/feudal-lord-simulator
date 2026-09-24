import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_GAME_STATE } from '../src/state/gameStore';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../src/content/buildingConfig';
import type { GameState } from '../src/engine/engine.types';
import { allocateBuildingAndConstructionLabour } from '../src/population/labour';
import { createPalisadeConstructionSite } from '../src/economy/constructionSites';
import { closeChrome, createCdpClient, createTarget, defaultChromePath, launchChrome, waitForChrome } from './phase13Part7BuildMenuProofChrome';

const output = path.resolve(process.argv[2] ?? 'output/rule-repairs/ui');
await mkdir(output, { recursive: true });
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const bundleFiles = (await readdir('dist/assets')).filter(file => /^index-.*\.js$/.test(file));
const distBundles = await Promise.all(bundleFiles.map(async file => ({ file, sha256: createHash('sha256').update(await readFile(path.join('dist/assets', file))).digest('hex') })));
const dirty = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split('\n');
const chrome = await launchChrome({ chromePath: defaultChromePath(), remoteDebuggingPort: 9341, userDataPrefix: 'fls-rule-ui-' });
await waitForChrome(9341, chrome.stderr, { chrome: chrome.chrome });
const target = await createTarget(9341, 'about:blank');
const cdp = await createCdpClient(target.webSocketDebuggerUrl);
const provider = `(() => { const root=document.getElementById('root'); const key=Object.keys(root).find(k=>k.startsWith('__reactContainer$')); const stack=[root[key].stateNode.current]; while(stack.length){ const f=stack.pop(); const v=f.memoizedProps?.value; if(v?.state?.buildings&&typeof v.dispatch==='function'&&typeof v.setSpeed==='function')return v; if(f.sibling)stack.push(f.sibling);if(f.child)stack.push(f.child);}throw Error('provider missing'); })()`;
const results: Record<string, unknown> = { classification: 'Prepared injected states in the actual product UI; not natural screen play', head, dirty, distBundles, viewport: [1600, 1100], screenshots: [] };
const shots: string[] = [];
async function settled() { await cdp.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))', true); }
async function wait(expression: string) {
  await cdp.evaluate(`(async()=>{for(let i=0;i<160;i++){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw Error('wait failed: '+${JSON.stringify(expression)});})()`, true);
}
async function click(selector: string) {
  const point = await cdp.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing selector');const b=e.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2,width:b.width,height:b.height};})()`, true);
  assert.ok(point !== null && typeof point === 'object' && 'x' in point && 'y' in point);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await settled();
  return point;
}
async function clickText(text: string) {
  await cdp.evaluate(`(()=>{const e=[...document.querySelectorAll('button,summary')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('missing text');e.setAttribute('data-rule-proof-click','1');})()`, true);
  await click('[data-rule-proof-click="1"]');
  await cdp.evaluate('document.querySelectorAll("[data-rule-proof-click]").forEach(e=>e.removeAttribute("data-rule-proof-click"))', false);
}
async function inject(state: GameState) {
  await cdp.evaluate(`(()=>{const p=${provider};p.setSpeed(0);p.dispatch({type:'load_saved_state',state:${JSON.stringify(state)}});})()`, true);
  await settled();
}
async function select(building: Building) {
  const point = await cdp.evaluate(`window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({tx:${building.tx},ty:${building.ty}})`, true);
  assert.ok(point !== null && typeof point === 'object' && 'clientX' in point && 'clientY' in point);
  for (const type of ['mousePressed', 'mouseReleased']) await cdp.send('Input.dispatchMouseEvent', { type, x: point.clientX, y: point.clientY, button: 'left', clickCount: 1 });
  await settled();
}
async function shot(name: string) {
  await settled();
  const response = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 48 });
  const result = response.result;
  assert.ok(result !== null && typeof result === 'object' && 'data' in result && typeof result.data === 'string');
  await writeFile(path.join(output, `${name}.jpg`), Buffer.from(result.data, 'base64'));
  shots.push(`${name}.jpg`);
}
function building(id: string, kind: Building['kind'], tx: number, ty: number): Building {
  return { id, kind, tx, ty, workers: BUILDING_CONFIG_BY_KIND[kind].workersRequired, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}
const homes = Array.from({ length: 12 }, (_, i) => building(`house-${i}-0-0`, 'house', 41 + i % 4, 38 + Math.floor(i / 4) * 2));
const newcomer = building('construction-site-000099', 'house', 46, 40);
const well = building('well-proof', 'well', 45, 40);
const farm = building('farm-proof', 'wheat_farm', 46, 43);
const store = { ...building('store-proof', 'storehouse', 42, 44), inventory: { stone: 220 } };
function fixture(): GameState {
  const buildings = [...homes, newcomer, well, farm, store];
  return { ...structuredClone(DEFAULT_GAME_STATE), buildings,
    houses: [...homes, newcomer].map(b => ({ buildingId: b.id, level: 1, residents: 8, hasWater: true, breadStock: 3, lastServicedTick: 0, unmetRequirementTicks: 0 })),
    population: 104, tick: 100, wallTick: 100, walkers: [], constructionSites: [], pathCache: {},
    tiles: DEFAULT_GAME_STATE.tiles.map(tile => {
      const occupied = buildings.find(b => tile.tx >= b.tx && tile.ty >= b.ty && tile.tx < b.tx + BUILDING_CONFIG_BY_KIND[b.kind].width && tile.ty < b.ty + BUILDING_CONFIG_BY_KIND[b.kind].height);
      return { ...tile, terrain: 'grass', buildingId: occupied?.id ?? null, hasRoad: occupied === undefined && tile.tx >= 40 && tile.tx <= 50 && tile.ty >= 37 && tile.ty <= 47 };
    }),
  };
}
try {
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__ruleErrors=[];window.addEventListener('error',e=>window.__ruleErrors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__ruleErrors.push(String(e.reason)));localStorage.setItem('feudal-lord-simulator:welcome-dismissed:v1','1');` });
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:4178/?phase10-proof=1' });
  await wait('window.__FEUDAL_PHASE10_PROOF__ !== undefined');
  await inject(fixture());
  await select(newcomer);
  await wait('document.body.innerText.includes("먼저 지어진 집 12채가 사용 중")');
  results.capacity = await cdp.evaluate('document.querySelector(".diagnostic-card")?.innerText', false);
  await shot('prepared-capacity-priority');
  await select(farm);
  const rect = await click('[data-action="toggle-building-operation"]');
  assert.ok('width' in rect && typeof rect.width === 'number' && rect.width >= 44);
  assert.ok('height' in rect && typeof rect.height === 'number' && rect.height >= 44);
  await wait(`(${provider}).state.buildings.find(b=>b.id==='farm-proof').operationPaused===true`);
  results.pause = { target: rect, state: await cdp.evaluate(`(${provider}).state.buildings.find(b=>b.id==='farm-proof')`, false) };
  await shot('prepared-farm-paused');
  await click('[data-action="toggle-building-operation"]');
  await wait(`(${provider}).state.buildings.find(b=>b.id==='farm-proof').operationPaused===false`);
  await click('.speed-seal:nth-child(2)');
  await wait(`(${provider}).state.buildings.find(b=>b.id==='farm-proof').workers===4`);
  await click('.speed-seal:nth-child(1)');
  await shot('prepared-farm-resumed');
  results.resume = await cdp.evaluate(`(${provider}).state.buildings.find(b=>b.id==='farm-proof')`, false);
  await select(well);
  await click('[data-action="toggle-building-operation"]');
  await select(homes[0] ?? newcomer);
  await wait('document.querySelector(".diagnostic-card")?.innerText.includes("시설 가동 중지")');
  await shot('prepared-well-paused-house');
  await cdp.evaluate(`document.querySelectorAll('details').forEach(e=>{if(e.textContent.includes('지금 저장'))e.open=true;})`, false);
  await settled();
  await clickText('지금 저장');
  await wait('(window.__FLS_SAVE_METRICS__??[]).some(m=>m.reason==="manual")');
  results.save = await cdp.evaluate('window.__FLS_SAVE_METRICS__', false);
  results.errorsBeforeReload = await cdp.evaluate('window.__ruleErrors', false);
  await cdp.send('Page.reload');
  await wait('window.__FEUDAL_PHASE10_PROOF__ !== undefined && [...document.querySelectorAll("button")].some(e=>e.textContent.trim()==="이어하기")');
  await clickText('이어하기');
  await wait(`(${provider}).state.buildings.some(b=>b.id==='well-proof'&&b.operationPaused===true)`);
  results.reloadPaused = true;
  await select(store);
  await wait('document.querySelector(".diagnostic-card")?.innerText.includes("넘침 20")');
  await shot('prepared-returned-cargo-overflow');
  const walls = [0, 1].map(index => ({ ...createPalisadeConstructionSite({ id: `wall-${index}`, wallId: 'proof-wall', segmentIndex: index, gateDistance: index, order: index, path: [{ x: 40 + index, y: 36 }, { x: 41 + index, y: 36 }], startedTick: 0 }), delivered: { timber: 15 } }));
  const wallState = fixture();
  const labour = allocateBuildingAndConstructionLabour(wallState.buildings, walls, wallState.population, { era: 'palisade', tick: wallState.tick, eraProclaimedTick: 0 });
  assert.equal(labour.constructionSites.reduce((sum, site) => sum + site.assignedBuilders, 0), 6);
  await inject({ ...wallState, era: 'palisade', eraProclaimedTick: 0, buildings: [...labour.buildings], constructionSites: [...labour.constructionSites] });
  await cdp.evaluate('document.querySelector(".settlement-panel")?.setAttribute("open","");document.querySelectorAll("details").forEach(e=>{if(e.textContent.includes("도시 발전 조건"))e.open=true;})', false);
  await wait('document.body.innerText.includes("성벽 공사 인력 6명")');
  await cdp.evaluate('document.querySelector(".era-tooltip")?.scrollIntoView({block:"center"})', false);
  await shot('prepared-wall-workers-actual');
  results.wallWorkers = '성벽 공사 인력 6명';
  results.errors = await cdp.evaluate('window.__ruleErrors', false);
  results.screenshots = shots;
  await writeFile(path.join(output, 'result.json'), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results));
} finally { cdp.close(); await closeChrome(chrome); }
