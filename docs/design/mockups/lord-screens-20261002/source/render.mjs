import { chromium } from '/tmp/astra-wave39-work-20260930/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const root='/tmp/astra-lord-screens-20261002';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const screens=JSON.parse(fs.readFileSync(root+'/source/screens.json','utf8'));
const report=[];
for(const [width,height] of [[1920,1080],[1280,800]]){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 for(let i=0;i<8;i++){
  await page.goto('file://'+root+'/index.html?screen='+i);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.images].every(im=>im.complete));
  const metrics=await page.evaluate(()=>{const main=document.querySelector('main'),r=main.getBoundingClientRect();return {missing:[...document.images].filter(im=>!im.naturalWidth).map(im=>im.src),mainOverflow:main.scrollHeight>main.clientHeight,clipped:[...main.querySelectorAll('*')].filter(el=>{const s=getComputedStyle(el);if(s.position==='absolute'||el.tagName==='svg'||el.closest('svg')||el.closest('.map'))return false;const b=el.getBoundingClientRect();return b.bottom>r.bottom+1||b.right>r.right+1}).map(el=>({tag:el.tagName,cls:el.className,text:el.innerText?.slice(0,70)}))}});
  const file=`screens/${width}x${height}/${screens[i].slug}.jpg`;await page.screenshot({path:root+'/'+file,type:'jpeg',quality:92});report.push({file,width,height,...metrics});
 }
 await page.close();
}
fs.writeFileSync(root+'/qa/layout-metrics.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
