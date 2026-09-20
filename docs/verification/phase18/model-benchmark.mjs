import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs,value,index,all) => value.startsWith('--') ? [...pairs,[value.slice(2),all[index+1]]] : pairs, []));
const moduleName = flags.playwright ?? process.env.PLAYWRIGHT_MODULE ?? 'playwright-core';
const { chromium } = await import(moduleName.startsWith('/') ? pathToFileURL(moduleName).href : moduleName);
const raw = gunzipSync(await readFile(flags.state ?? 'tests/fixtures/phase16-city.json.gz'));
const state = JSON.parse(raw.toString('utf8'));
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1600,height:1100}});
  await page.routeWebSocket('**',socket => socket.close());
  for (const [file,anchor,counter] of [
    ['ui/eraConsoleModel.ts','function proposalSummaryForState(state, footprints) {','proposal'],
    ['engine/palisadeFootprints.ts','function palisadeFootprintsForState(state) {','footprints'],
  ]) {
    await page.route(`**/src/${file}*`,async route => {
      const response=await route.fetch(); const source=await response.text();
      if(!source.includes(anchor)) throw new Error(`Instrumentation anchor changed: ${file}`);
      await route.fulfill({response,body:source.replace(anchor,anchor+`if(window.modelCalls)window.modelCalls.${counter}++;`)});
    });
  }
  await page.goto(flags.url ?? 'http://127.0.0.1:3218/');
  const result=await page.evaluate(async state => {
    const {buildEraConsoleModel}=await import('/src/ui/EraConsole.tsx');
    const results=[];
    for(const era of ['hamlet','palisade','stone_town']) {
      const game={...state,era};const counts=[];const elapsed=[];let model;
      for(let round=0;round<4;round++) {
        window.modelCalls={proposal:0,footprints:0};
        const start=performance.now();
        for(let call=0;call<100;call++) model=buildEraConsoleModel({state:game,draft:null});
        elapsed.push(performance.now()-start);counts.push({...window.modelCalls});
      }
      results.push({era,callsPerRound:100,warmupRoundDiscarded:true,elapsedMs:elapsed,counts,meanMsPerCall:elapsed.slice(1).reduce((a,b)=>a+b,0)/300,proposalVisible:model.proposal.visible});
    }
    return results;
  },state);
  const root=flags['source-root']??'.';
  await writeFile(flags.output,JSON.stringify({browser:browser.version(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),stateSha256:createHash('sha256').update(raw).digest('hex'),instrumentation:'Entry counters only; model call duration includes counter increment, not a frame measurement',results:result},null,2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
