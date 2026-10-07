import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { loadChromium, openScene } from '../../scripts/renderCommitProbe.mjs';
import { refuseHeavyOnMac } from '../../scripts/remote/localGuard.mjs';
refuseHeavyOnMac('RB-LOG-STOCKPILES same-save game capture', { entry: import.meta.url });
const [out,url] = process.argv.slice(2); if(!out||!url) throw new Error('OUT URL required');
mkdirSync(out,{recursive:true});
const provenance=JSON.parse(readFileSync('.omo/log-stockpiles/provenance.json'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const contactOnly=process.env.LOG_CONTACT_ONLY==='1';
const views=contactOnly?provenance.scenes.filter(s=>s.season.includes('seed5')).flatMap(s=>s.homes.filter(h=>h.kind==='logging_camp'&&h.id==='construction-site-000064').map(h=>({name:`${s.season}-${h.kind}-${h.id}-z3`,scene:s.season,target:h,zoom:3,tile:[h.tx,h.ty]}))):provenance.scenes.flatMap(s=>s.homes.filter(h=>['summer','winter'].includes(s.season)||h.selected?.includes('-b-')).flatMap(h=>[1,.6,3].map(zoom=>({name:`${s.season}-${h.kind}-${h.id}-z${zoom}`,scene:s.season,target:h,zoom,tile:[h.tx,h.ty]}))));
if(!contactOnly)assert.ok(views.some(v=>v.target.selected?.includes('-b-summer')),'warm b fixture required');
if(!contactOnly)assert.ok(views.some(v=>v.target.selected?.includes('-b-winter')),'winter b fixture required');
assert.equal(views.length,contactOnly?2:18,'exact requested view count');
const installed=existsSync('public/assets/wave42/regrowth/log_stack_a_summer.png');
const report={contactOnly,installed,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),provenance,views:[],errors:[],networkFailures:[]};
const init=`globalThis.__logDraws=[];globalThis.__logTotals={};if(location.protocol==='http:'||location.protocol==='https:'){localStorage.setItem('feudal-lord-simulator:tutorial:v1',JSON.stringify({enabled:false,acks:[],pulsed:[],log:[]}));localStorage.setItem('feudal.presentation.eventPause','0');}(()=>{const origins=new WeakMap();for(const type of [globalThis.CanvasRenderingContext2D,globalThis.OffscreenCanvasRenderingContext2D]){if(!type)continue;const original=type.prototype.drawImage;type.prototype.drawImage=function(image,...args){const src=image instanceof HTMLImageElement?image.currentSrc||image.src:origins.get(image)||'';if(/log_stack_[ab]_(summer|winter)/.test(src)){globalThis.__logTotals[src]=(globalThis.__logTotals[src]||0)+1;if(this.canvas.width<512&&this.canvas.height<512)origins.set(this.canvas,src);else if(globalThis.__logDraws.length<2000)globalThis.__logDraws.push({src,args,transform:{a:this.getTransform().a,d:this.getTransform().d,e:this.getTransform().e,f:this.getTransform().f}});}return original.call(this,image,...args);};}})();`;
const browser=await(await loadChromium()).launch({channel:'chrome',headless:true,args:['--disable-gpu']});
let current='opening';
const newContext=browser.newContext.bind(browser);
browser.newContext=async options=>{const context=await newContext(options);context.on('page',page=>{page.on('pageerror',e=>report.errors.push({view:current,message:String(e)}));page.on('requestfailed',r=>report.networkFailures.push({view:current,url:r.url(),error:r.failure()?.errorText}));});return context;};
try{for(const view of views){current=view.name;let context;const fixture=provenance.scenes.find(s=>s.season===view.scene);const bytes=readFileSync('.omo/log-stockpiles/'+fixture.file);assert.equal(hash(bytes),fixture.saveSHA256);const row={...view,saveSHA256:fixture.saveSHA256};report.views.push(row);
 try{const scene=await openScene(browser,{state:JSON.parse(bytes),tile:view.tile,zoom:view.zoom,baseUrl:url,run:false,initScript:init,loadTimeout:90000});context=scene.context;
 await scene.page.evaluate(()=>document.fonts.ready);await scene.page.waitForTimeout(1200);
 if(view.target.selected&&installed){const file=view.target.selected.replace('core-log-stack-','log_stack_').replaceAll('-','_')+'.png';await scene.page.waitForFunction(file=>Object.keys(globalThis.__logTotals).some(src=>src.endsWith(file)),file,{timeout:30000});}
 await scene.page.evaluate(()=>{globalThis.__logDraws=[];});await scene.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const state=await scene.page.evaluate(()=>window.__FEUDAL_PHASE10_PROOF__.state());row.stateSHA256=hash(JSON.stringify(state));row.tick=state.tick;assert.equal(state.tick,fixture.tick);const home=state.buildings.find(b=>b.id===view.target.id);assert.deepEqual(home.inventory,view.target.inventory);
 row.inventory=home.inventory;
 row.camera=await scene.page.evaluate(()=>window.__FEUDAL_PHASE10_PROOF__.diagnosis().camera);row.targetClientPoint=await scene.page.evaluate(({tx,ty})=>window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({tx,ty}),view.target);row.draws=await scene.page.evaluate(()=>globalThis.__logDraws);row.drawTotals=await scene.page.evaluate(()=>globalThis.__logTotals);
 row.expectedWorldRect={x:view.target.anchor.x-64*.3,y:view.target.anchor.y-108*.3,width:128*.3,height:128*.3};
 row.targetDraws=row.draws.filter(draw=>{const [x,y,width,height]=draw.args.slice(-4);const rect=row.expectedWorldRect;return Math.abs(x-rect.x)<.01&&Math.abs(y-rect.y)<.01&&Math.abs(width-rect.width)<.01&&Math.abs(height-rect.height)<.01;});
 if(installed&&view.target.selected){assert.ok(row.targetDraws.length>0,'actual log draw at the target door anchor required');const file=view.target.selected.replace('core-log-stack-','log_stack_').replaceAll('-','_')+'.png';assert.ok(row.targetDraws.every(draw=>draw.src.endsWith(file)),'target variant and season must match');}
 else assert.equal(row.targetDraws.length,0,'baseline or zero-stock target must have no new log draw');
 if(!installed)assert.equal(row.draws.length,0,'baseline must not draw new log PNGs');
 await scene.page.screenshot({path:`${out}/${view.name}.jpg`,type:'jpeg',quality:85});assert.equal(await scene.page.evaluate(()=>window.__FEUDAL_PHASE10_PROOF__.state().tick),fixture.tick,'save stays paused during capture');row.jpegSHA256=hash(readFileSync(`${out}/${view.name}.jpg`));
 }catch(error){report.errors.push({view:current,message:String(error)});break;}finally{await context?.close();writeFileSync(out+'/result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({view:current,completed:report.views.length,errors:report.errors.length}));}
}}finally{await browser.close();}
if(report.errors.length)process.exitCode=1;
