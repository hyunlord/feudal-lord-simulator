import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('/opt/homebrew/lib/node_modules/openclaw/node_modules/playwright-core');
const repo='/Users/rexxa/fls-astra-worldevents';
const out='/Users/rexxa/fls-astra-worldevents-output';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
await page.addInitScript("localStorage.setItem('feudal-lord-simulator:tutorial:v1',JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));localStorage.setItem('feudal.seasonLedgerAuto','0');");
await page.goto('http://127.0.0.1:4480',{waitUntil:'networkidle'});
const bytes=zlib.gunzipSync(await fs.readFile(repo+'/fixtures/perf-gate/ch4-1380.save.json.gz')).toString('base64');
await page.evaluate(async encoded=>{const m=await import('/src/platform/indexedDbSaveStorage.ts');const db=await m.openSaveDatabase(indexedDB,5000);await new m.IndexedDbSaveStorage(db).write('manual',Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)));db.close();},bytes);
await page.reload({waitUntil:'networkidle'});
await page.getByRole('button',{name:'이어하기',exact:true}).click();
await page.waitForTimeout(2500);

await page.evaluate('('+await fs.readFile(repo+'/tools/vision-check/vision_check/adapter.js','utf8')+')()');
await page.evaluate(()=>window.__vision.store.setSpeed(0));
const original=await page.evaluate(()=>window.__vision.store.getState());
const records=[];
for (const [season,tick] of [['summer',321010],['winter',323010]]) {
 await page.evaluate(s=>window.__vision.store.dispatch({type:'load_saved_state',state:s}),{...original,tick});
 await page.waitForTimeout(800);
 await page.evaluate('('+await fs.readFile(repo+'/tools/vision-check/vision_check/adapter.js','utf8')+')()');
 await page.evaluate(()=>window.__vision.store.setSpeed(0));
 for(const [area,center] of [['church',[49,31]],['market',[55,36]],['manor',[30,19]]]) for(const zoom of [1,0.6]){
  await page.evaluate(({zoom,center})=>{const v=window.__vision,p=v.probe();v.input.emit({kind:'zoom',factor:zoom/p.camera().zoom,anchor:{x:800,y:500}});v.input.emit({kind:'lookAt',tile:{tx:center[0],ty:center[1]}});},{zoom,center});
  await page.waitForTimeout(900);
  const name=area+'-'+season+'-z'+zoom.toFixed(1);
  const png=await page.locator('canvas').first().evaluate(c=>c.toDataURL('image/png'));
  await fs.writeFile(out+'/references/'+name+'.png',Buffer.from(png.split(',')[1],'base64'));
  await page.screenshot({path:out+'/references/'+name+'-hud.jpg',quality:80});
  const record=await page.evaluate(()=>{const v=window.__vision;return{tick:v.store.getState().tick,camera:v.probe().camera(),viewport:v.probe().viewport()}});
  records.push({name,season,area,center,...record});console.log(name,record);
 }
}
await fs.writeFile(out+'/provenance/captures.json',JSON.stringify({records,buildings:original.buildings.map(({id,kind,tx,ty})=>({id,kind,tx,ty})),tiles:original.tiles.filter(t=>t.hasRoad||t.buildingId).map(({tx,ty,hasRoad,buildingId})=>({tx,ty,hasRoad,buildingId})),notes:['Actual renderer, no source or art replacement','In-memory tick staged from same fixture for seasonal comparison; no organic event claim','Camera via native input; canvas excludes DOM HUD; HUD saved separately']},null,2));
await browser.close();
