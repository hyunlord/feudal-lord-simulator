import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cpus, platform, release, arch } from 'node:os';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs,value,index,all) => value.startsWith('--') ? [...pairs,[value.slice(2),all[index+1]]] : pairs, []));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const task=flags.task??'A'; const dpr=Number(flags.dpr??1); const condition=flags.condition??'paused';
if(![1,2].includes(dpr)||!['paused','running','drag'].includes(condition)) throw new Error('Invalid condition');
const sourcePath=resolve(flags.state); const bytes=await readFile(sourcePath);
const source=(sourcePath.endsWith('.gz')?gunzipSync(bytes):bytes).toString('utf8'); const state=JSON.parse(source);
const output=resolve(flags.output);await mkdir(output,{recursive:true});
const adapterPath=flags.adapter?resolve(flags.adapter):null;
const adapter=adapterPath?await import(pathToFileURL(adapterPath).href):null;
const adapterSha=adapterPath?sha(await readFile(adapterPath)):null;
const variants={before:{url:flags['before-url'],root:resolve(flags['before-root'])},after:{url:flags['after-url'],root:resolve(flags['after-root'])}};
const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
for(const variant of Object.values(variants)) {
  variant.commit=git(variant.root,'rev-parse','HEAD');
  variant.sourceDiffSha256=sha(execFileSync('git',['diff','HEAD'],{cwd:variant.root}));
  if(variant.sourceDiffSha256!==sha(''))throw new Error(`Dirty measurement source: ${variant.root}`);
}
const playwright=flags.playwright??process.env.PLAYWRIGHT_MODULE??'playwright-core';
const {chromium}=await import(playwright.startsWith('/')?pathToFileURL(playwright).href:playwright);
const browser=await chromium.launch({channel:'chrome',headless:true});
const camera={zoom:Number(flags.zoom??1),panX:800,panY:500-1440*Number(flags.zoom??1)};
const rounds=[];const errors=[];const instrumentation=[];
try {
  for(let round=0;round<(flags.smoke==='true'?1:3);round++)for(const name of (flags.smoke==='true'||flags.single==='true'?['before']:['before','after'])) {
    const variant=variants[name];
    const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:dpr});
    page.on('pageerror',error=>errors.push(error.message));
    await page.routeWebSocket('**',socket=>socket.close());
    if(adapter)await adapter.install(page,receipt=>instrumentation.push({variant:name,round,...receipt}));
    await page.route('**/src/state/gameStore.ts*',async route=>{
      const response=await route.fetch();const text=await response.text();const anchor='useState(DEFAULT_GAME_STATE)';
      if(!text.includes(anchor))throw new Error('State injection anchor changed');
      await route.fulfill({response,body:text.replace(anchor,`useState(${source})`)});
    });
    await page.route('**/src/render/canvasRuntime.ts*',async route=>{
      const response=await route.fetch();const text=await response.text();const anchor='function cameraForStartingHouse(canvas, state) {';
      if(!text.includes(anchor))throw new Error('Camera injection anchor changed');
      await route.fulfill({response,body:text.replace(anchor,anchor+`return ${JSON.stringify(camera)};`)});
    });
    await page.goto(variant.url+'?phase10-proof=1');
    if(await page.locator('.welcome-dismiss-layer').count())await page.locator('.welcome-dismiss-layer').click();
    await page.keyboard.press('Escape');
    if(await page.locator('.settlement-progress[open]').count())await page.locator('.settlement-progress summary').click();
    await page.mouse.move(800,950);
    if(condition!=='paused')await page.getByRole('button',{name:'1배속',exact:true}).click();
    await page.waitForTimeout(1500);
    const environment=await page.evaluate(()=>({visibilityState:document.visibilityState,hasFocus:document.hasFocus(),devicePixelRatio:window.devicePixelRatio,innerWidth:innerWidth,innerHeight:innerHeight}));
    if(environment.visibilityState!=='visible'||environment.devicePixelRatio!==dpr)throw new Error('Unexpected visibility or DPR');
    const measured=await page.evaluate(async({drag,paused,expectedTick})=>{
      const port=window.__FEUDAL_PHASE10_PROOF__;const canvas=document.querySelector('canvas');
      if(!port||!canvas)throw new Error('Proof port/canvas missing');
      const point=port.tileClientPoint({tx:45,ty:45});
      if(Math.abs(point.clientX-800)>.01||Math.abs(point.clientY-500)>.01)throw new Error('Initial camera mismatch');
      if(drag)canvas.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:1,buttons:4,clientX:700,clientY:450}));
      return new Promise((resolveWindow,rejectWindow)=>{
        const timeout=setTimeout(()=>rejectWindow(new Error('Measurement exceeded 180 seconds')),180000);
        let start,last,before,beforeTick,lastTickCount;const raf=[];const positions=[];const tickSamples=[];
        function frame(now){
          try{
            if(start===undefined){start=now;last=now;before=port.diagnosis().work;beforeTick=port.snapshot().tick;
              if(!before||before.capacity!==240)throw new Error('Work metrics ring unavailable');lastTickCount=before.tickCount;
              if(paused&&beforeTick!==expectedTick)throw new Error('Paused starting state advanced');
            } else raf.push(now-last);
            last=now;
            if(drag){
              const delta=200-Math.abs((((now-start)*.2+200)%800)-400);
              canvas.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,button:1,buttons:4,clientX:700+delta,clientY:450}));
              if(raf.length%60===0){const actual=port.tileClientPoint({tx:45,ty:45});positions.push({frame:raf.length,delta,...actual});
                if(Math.abs(actual.clientX-(800+delta))>1.01||Math.abs(actual.clientY-500)>.01)throw new Error('Real drag trajectory mismatch');}
            }
            if(raf.length>0&&raf.length%40===0){const checkpoint=port.diagnosis().work;const count=checkpoint.tickCount-lastTickCount;if(count>240||count<0)throw new Error(`Tick checkpoint overflow: ${count}`);if(count)tickSamples.push(...checkpoint.tickWorkMs.slice(-count));lastTickCount=checkpoint.tickCount;}
            if(raf.length===240){
              const after=port.diagnosis().work;const afterTick=port.snapshot().tick;
              const frameCount=after.frameCount-before.frameCount;const tickCount=after.tickCount-before.tickCount;
              if(frameCount!==240)throw new Error(`Expected 240 actual draw calls, got ${frameCount}`);
              if(tickSamples.length!==tickCount)throw new Error(`Tick sample mismatch: ${tickSamples.length}/${tickCount}`);
              const snapshotTickDelta=afterTick-beforeTick;
              const snapshotCountDifference=snapshotTickDelta-tickCount;
              if(paused&&tickCount!==0)throw new Error('Paused simulation advanced');
              if(drag)window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true,button:1,clientX:700,clientY:450}));
              clearTimeout(timeout);resolveWindow({raf,frameWorkMs:after.frameWorkMs,tickWorkMs:tickSamples,frameCount,tickCount,beforeTick,afterTick,snapshotCountDifference,beforeWorkCounts:{frame:before.frameCount,tick:before.tickCount},afterWorkCounts:{frame:after.frameCount,tick:after.tickCount},positions});
            }else requestAnimationFrame(frame);
          }catch(error){rejectWindow(error);}
        }
        requestAnimationFrame(frame);
      });
    },{drag:condition==='drag',paused:condition==='paused',expectedTick:state.tick});
    rounds.push({variant:name,round,discarded:round===0,environment,...measured});
    await page.close();
    console.log(JSON.stringify({variant:name,round,frames:measured.frameCount,ticks:measured.tickCount}));
  }
  const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {count:values.length,median:sorted[Math.floor(sorted.length/2)]??null,p95:sorted[Math.floor(sorted.length*.95)]??null,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null};};
  const summary={};for(const name of ['before','after']){const retained=rounds.filter(r=>r.variant===name&&!r.discarded);summary[name]={frameWork:stats(retained.flatMap(r=>r.frameWorkMs)),tickWork:stats(retained.flatMap(r=>r.tickWorkMs)),raf:stats(retained.flatMap(r=>r.raf)),tickRanges:retained.map(r=>({from:r.beforeTick,to:r.afterTick,count:r.tickCount,snapshotCountDifference:r.snapshotCountDifference}))};}
  const result={task,dpr,condition,singleVariant:flags.single==='true',correctnessSmokeOnly:flags.smoke==='true',measuredAt:new Date().toISOString(),browser:browser.version(),host:{platform:platform(),release:release(),arch:arch(),cpu:cpus()[0]?.model},variants,stateSha256:sha(source),stateTick:state.tick,population:state.population,houses:state.houses.length,camera,viewport:{width:1600,height:1100},protocol:flags.single==='true'?'N0 discarded; N1 N2 retained; 240 draws/window, 480 native frames; tick snapshots every 40 draws':'A0 B0 discarded; A1 B1 A2 B2 retained; 240 actual draws/window, 480/variant; tick ring snapshots every 40 draws (same cadence both variants)',adapterSha256:adapterSha,harnessSha256:sha(await readFile(new URL(import.meta.url))),instrumentation,summary,rounds,errors};
  await writeFile(`${output}/${task}-dpr${dpr}-${condition}.json`,JSON.stringify(result,null,2));
  if(errors.length)throw new Error(`Browser errors: ${errors.join('; ')}`);
}finally{await browser.close();}
