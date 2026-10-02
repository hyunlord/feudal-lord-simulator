const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/opt/homebrew/lib/node_modules/openclaw/node_modules/playwright-core');
const sharp=require('/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp');
const root='/tmp/charter-kin-brand-20261002',work='/tmp/charter-kin-work-20261002';
async function main(){
 const server=http.createServer((req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');if(req.url==='/'){res.end('<html><body></body></html>');return;}const name=req.url.slice(1);if(!['EBGaramond.ttf','NotoSerifKR.ttf'].includes(name)){res.statusCode=404;res.end();return;}res.setHeader('Content-Type','font/ttf');res.end(fs.readFileSync(work+'/fonts/'+name));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const page=await browser.newPage({deviceScaleFactor:1});await page.goto(`http://127.0.0.1:${port}`);
 const style=`<style>@font-face{font-family:'EB Garamond';src:url('/EBGaramond.ttf');font-weight:400 800}@font-face{font-family:'Noto Serif KR';src:url('/NotoSerifKR.ttf');font-weight:200 900}html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>`;
 const report=[];fs.mkdirSync(work+'/qa',{recursive:true});
 for(const lang of ['en','ko'])for(const layout of ['horizontal','vertical'])for(const theme of ['light','dark']){
 const W=layout==='horizontal'?1200:720,H=layout==='horizontal'?280:640;
 await page.setViewportSize({width:W,height:H});const pair={lang,layout,theme};
 for(const mode of ['text','outlined']){
 const name=`charter-kin-${lang}-${layout}-on-${theme}-${mode}`;
 const svg=fs.readFileSync(root+'/logos/'+name+'.svg','utf8').replace(/<\?xml[^>]*>/,'');await page.setContent(style+svg);await page.evaluate(()=>document.fonts.ready);
 if(mode==='text'){await page.evaluate(()=>Promise.all([document.fonts.load('600 100px "EB Garamond"'),document.fonts.load('600 100px "Noto Serif KR"')]));}
 pair[mode]=await page.locator('svg').screenshot({path:work+'/qa/'+name+'.png',omitBackground:true});
 const bounds=await page.locator('svg').evaluate(el=>{const b=el.getBBox();return {x:b.x,y:b.y,width:b.width,height:b.height};});pair[mode+'FontMetricBounds']=bounds;
 await page.locator('svg').evaluate((el,v)=>{el.setAttribute('width',v.W+128);el.setAttribute('height',v.H+128);el.setAttribute('viewBox',[-64,-64,v.W+128,v.H+128].join(' '));},{W,H});
 const padded=await page.locator('svg').screenshot({omitBackground:true});const raw=await sharp(padded).ensureAlpha().raw().toBuffer({resolveWithObject:true});let x0=raw.info.width,y0=raw.info.height,x1=-1,y1=-1;
 for(let y=0;y<raw.info.height;y++)for(let x=0;x<raw.info.width;x++)if(raw.data[(y*raw.info.width+x)*4+3]>0){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 assert(x0>=64&&y0>=64&&x1<64+W&&y1<64+H,'Actual ink outside canvas');pair[mode+'InkBounds']={x:x0-64,y:y0-64,width:x1-x0+1,height:y1-y0+1};
 }
 const a=await sharp(pair.text).raw().toBuffer(),b=await sharp(pair.outlined).raw().toBuffer();let changed=0,total=0,max=0;for(let i=0;i<a.length;i+=4){const d=Math.abs(a[i+3]-b[i+3]);if(d>20)changed++;if(a[i+3]>0||b[i+3]>0)total++;max=Math.max(max,d);}delete pair.text;delete pair.outlined;pair.alphaPixelsDifferOver20=changed;pair.unionVisiblePixels=total;pair.ratio=changed/total;pair.maxAlphaDiff=max;report.push(pair);
 }
 await browser.close();server.close();fs.writeFileSync(root+'/provenance/browser-qa.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
