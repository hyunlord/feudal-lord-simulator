import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { chromium } from '/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import { openScene } from '../../../scripts/renderCommitProbe.mjs';
import { decodeSave } from '../../../src/save/saveCodec.ts';
const root=new URL('../',import.meta.url);
const state=decodeSave(new Uint8Array(gunzipSync(await readFile(new URL('../../../tests/fixtures/boundary/seed2-arable-scene.json.gz',import.meta.url))))).envelope.state;
const corners={north:[39,29],east:[61,29],south:[61,47],west:[39,47]};
const polygon=Object.values(corners).map(([x,y])=>({x,y}));polygon.push(polygon[0]);
const paths=[];
for(let i=0;i<4;i++){const a=polygon[i],b=polygon[i+1],n=Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y));for(let t=0;t<n;t++)paths.push([{x:a.x+(b.x-a.x)*t/n,y:a.y+(b.y-a.y)*t/n},{x:a.x+(b.x-a.x)*(t+1)/n,y:a.y+(b.y-a.y)*(t+1)/n}]);}
const moduleText=await(await fetch('http://127.0.0.1:4319/src/render/drawWallFaces.ts')).text();
const browser=await chromium.launch({channel:'chrome',headless:true});
browser.on('context',ctx=>ctx.on('page',p=>p.on('pageerror',e=>console.error('PAGE',e.message))));
const cases=[];await mkdir(new URL('records/captures/',root),{recursive:true});
for(const material of ['stone','palisade'])for(const season of ['winter'])for(const [direction,tile] of Object.entries(corners)){
 const id=`control_${material}_${direction}_${season}`;const [x,y]=tile;
 const frame=structuredClone(state);frame.walkers=[];frame.tick=(Math.floor(state.tick/4000)+1)*4000+(season==='summer'?1500:3500);
 frame.palisade={...frame.palisade,polygon,gate:{x:50,y:29},additionalGates:[],segments:paths.map((edgePath,i)=>({...state.palisade.segments[0],id:`astra-qa-${i}`,order:i,edgePath,tileCount:1,completed:true,material:material==='stone'?'stone':'timber'}))};
 const near=p=>`(${p}.x===${x}&&${p}.y===${y})`;
 let changed=moduleText.replace('for (const node of nodes) {',`for (const node of nodes) { if(${near('node.point')})continue;`);
 if(changed===moduleText)throw new Error('Preview interception failed');
 const {page,context}=await openScene(browser,{state:frame,tile,baseUrl:'http://127.0.0.1:4319/',zoom:1.4,run:false,rewrite:[{pattern:'**/src/render/drawWallFaces.ts*',from:moduleText,to:changed}],query:'&render-wall-strips=1'});
 await page.waitForTimeout(500);const file=`records/captures/${id}.png`;await page.screenshot({path:new URL(file,root).pathname});
 cases.push({id,material,season,direction,tile,zoom:1.4,anchor:[640,377.6],file,fixture:'seed2-arable-scene migrated; rectangular wall layout only for four-direction QA',tick:frame.tick,previewOnlyClearance:.65});
 await context.close();console.log(id);
}
await browser.close();await writeFile(new URL('records/controls-winter.json',root),JSON.stringify(cases,null,2));
