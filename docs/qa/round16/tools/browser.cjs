const fs=require('fs'),fsp=require('fs/promises'),http=require('http'),zlib=require('zlib');
const {chromium}=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root='/tmp/QA_ROUND_16';
(async()=>{
await new Promise(r=>setTimeout(r,1500));console.log('Visual QA: no performance measurement or queue dependency');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:1100},deviceScaleFactor:1});
let page=await context.newPage();page.setDefaultTimeout(5000);
async function shot(name){await page.screenshot({path:root+'/evidence/'+name+'.jpg',type:'jpeg',quality:83});const qa=await page.locator('.qa-overlay').innerText().catch(()=>null);await fsp.writeFile(root+'/repro/'+name+'.json',JSON.stringify({time:new Date().toISOString(),url:page.url(),qa,text:await page.locator('body').innerText()},null,2));return qa}
async function load(source){await page.context().close();const fresh=await browser.newContext({viewport:{width:1600,height:1100},deviceScaleFactor:1});page=await fresh.newPage();page.setDefaultTimeout(5000);const bytes=source.endsWith('.gz')?zlib.gunzipSync(fs.readFileSync(source)):fs.readFileSync(source);await page.goto('http://127.0.0.1:4830/');await page.evaluate(async p=>{const m=await import('/src/platform/indexedDbSaveStorage.ts');const db=await m.openSaveDatabase(indexedDB,5000);try{await new m.IndexedDbSaveStorage(db).write('manual',new Uint8Array(p));}finally{db.close()}},Array.from(bytes));await page.reload();await page.getByRole('button',{name:'이어하기',exact:true}).click();await page.waitForTimeout(1200);}
async function speed(value){const b=page.getByRole('button',{name:value==='paused'?'일시 정지':value+'배속',exact:true});if(await b.getAttribute('aria-pressed')!=='true')await b.click();await page.waitForTimeout(350);}
async function motion(name,n=20,interval=100){const dir='/tmp/fls-qa-raw-round16/'+name;await fsp.mkdir(dir,{recursive:true});const t=Date.now(),times=[];for(let i=0;i<n;i++){await page.waitForTimeout(Math.max(1,t+i*interval-Date.now()));const start=Date.now()-t;await page.screenshot({path:dir+'/'+String(i).padStart(4,'0')+'.jpg',type:'jpeg',quality:79});times.push({i,start,end:Date.now()-t});}await fsp.writeFile(root+'/repro/'+name+'.json',JSON.stringify({url:page.url(),qa:await page.locator('.qa-overlay').innerText().catch(()=>null),times},null,2));return times;}
await page.goto('http://127.0.0.1:4830/');
http.createServer(async(req,res)=>{let s='';for await(const c of req)s+=c;try{const fn=new Function('page','context','shot','load','speed','motion','return (async()=>{'+JSON.parse(s).code+'})()');const result=await fn(page,context,shot,load,speed,motion);res.end(JSON.stringify({result}));}catch(e){res.end(JSON.stringify({error:String(e)}));}}).listen(4832,'127.0.0.1');console.log('QA control ready 4832');
})();
