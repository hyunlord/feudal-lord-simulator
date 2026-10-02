import { gunzipSync } from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { chromium } from '/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import { openScene } from '../../../scripts/renderCommitProbe.mjs';
import { decodeSave } from '../../../src/save/saveCodec.ts';

const root = new URL('../', import.meta.url);
const state = decodeSave(new Uint8Array(gunzipSync(await readFile(new URL('../../../tests/fixtures/boundary/seed2-arable-scene.json.gz',import.meta.url))))).envelope.state;
const browser = await chromium.launch({channel:'chrome',headless:true});
const moduleText = await (await fetch('http://127.0.0.1:4319/src/render/drawWallFaces.ts')).text();
const changed=moduleText.replace('for (const node of nodes) {','for (const node of nodes) { if (node.point.x===64&&node.point.y===26) continue;').replace('const { chain } = slice;','const { chain } = slice; const aa=chain.raw[Math.floor(slice.t0)],bb=chain.raw[Math.ceil(slice.t1)]; if(aa&&bb&&Math.hypot(aa.x-64,aa.y-26)<=1.01&&Math.hypot(bb.x-64,bb.y-26)<=1.01)return;');
const {page,context} = await openScene(browser,{state:{...state,walkers:[]},tile:[64,26],baseUrl:'http://127.0.0.1:4319/',zoom:2,run:false,rewrite:[{pattern:'**/src/render/drawWallFaces.ts*',from:moduleText,to:changed}],query:'&render-wall-strips=1'});
await page.waitForTimeout(2500);
await mkdir(new URL('records/captures/',root),{recursive:true});
await page.screenshot({path:new URL('records/captures/slot.png',root).pathname});
await writeFile(new URL('records/browser-diagnosis.json',root),JSON.stringify(await page.evaluate(()=>window.__FEUDAL_PHASE10_PROOF__.diagnosis()),null,2));
await context.close();await browser.close();
