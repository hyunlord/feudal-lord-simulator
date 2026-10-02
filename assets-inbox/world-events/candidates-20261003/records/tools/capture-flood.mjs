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

const result=await page.evaluate(async()=>{
 const {buildZoneLayer}=await import('/src/render/zoneLayer.ts');
 const {drawArableFields}=await import('/src/render/drawArableFields.ts');
 const {wave9Art}=await import('/src/render/wave9Art.ts');
 const state=window.__vision.store.getState();
 const cells=Array(state.width*state.height);for(const t of state.tiles)cells[t.ty*state.width+t.tx]=t;
 const layer=buildZoneLayer(state,cells);
 const indexes=layer.fields.flatMap((f,i)=>f&&layer.zones[i].id==='zone-000005'?[i]:[]);
 const states=new Map(layer.arableBands.filter(b=>indexes.includes(b.zoneIndex)).map(b=>[b.stripId,'flooded']));
 wave9Art('field_ridge_flooded');
 await new Promise(resolve=>setTimeout(resolve,1500));
 const outputs=[];
 for(const [season,num]of [['summer',1],['winter',3]])for(const [zoom,panX,panY]of [[1,224,-780],[0.6,454.4,-268]]){
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;const ctx=canvas.getContext('2d');ctx.setTransform(zoom,0,0,zoom,panX,panY);ctx.beginPath();[[52,47],[55,47],[55,50.4],[52,50.4]].forEach(([x,y],i)=>{const sx=(x-y)*32,sy=(x+y)*16;i?ctx.lineTo(sx,sy):ctx.moveTo(sx,sy)});ctx.closePath();ctx.clip();drawArableFields(ctx,layer,indexes,states,num);outputs.push({name:'flood-layer-'+season+'-z'+zoom.toFixed(1),png:canvas.toDataURL('image/png')});
 }
 return{outputs,fields:indexes.map(i=>({index:i,zone:layer.zones[i]})),triggerNote:'Proof-only flooded state lookup; original field geometry and engine painter; winter wetSummer not active'};
});
for(const o of result.outputs)await fs.writeFile(out+'/references/'+o.name+'.png',Buffer.from(o.png.split(',')[1],'base64'));
await fs.writeFile(out+'/provenance/flood-layer.json',JSON.stringify({...result,outputs:result.outputs.map(o=>o.name)},null,2));
console.log(result.fields);
await browser.close();
