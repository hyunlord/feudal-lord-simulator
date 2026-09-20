import { pathToFileURL } from 'node:url';
const moduleName = process.env.PLAYWRIGHT_MODULE ?? 'playwright-core';
const { chromium } = await import(moduleName.startsWith('/') ? pathToFileURL(moduleName).href : moduleName);
const url = process.argv[2] ?? 'http://127.0.0.1:3226/';
const output = process.argv[3] ?? 'output/phase16/A-house-study';
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:800,height:600},deviceScaleFactor:2});
  await page.routeWebSocket('**',socket=>socket.close());
  await page.goto(url);
  for(const zoom of [1,1.35]) {
    await page.evaluate(async zoom=>{
      const single=await import('/src/render/historicalHouseAssets.ts');
      const compound=await import('/src/render/houseCompoundAssets.ts');
      await Promise.all([single.preloadHistoricalHouseAssets(),compound.preloadHouseCompoundAssets()]);
      document.querySelector('#sprite-study')?.remove();
      const canvas=document.createElement('canvas');canvas.id='sprite-study';canvas.width=1600;canvas.height=1200;
      Object.assign(canvas.style,{position:'fixed',left:0,top:0,width:'800px',height:'600px',zIndex:99999});document.body.append(canvas);
      const context=canvas.getContext('2d');context.scale(2,2);context.fillStyle='#d9d0b8';context.fillRect(0,0,800,600);
      context.fillStyle='#352b20';context.font='16px sans-serif';context.fillText(`Actual sprite fixtures · zoom ${zoom} · DPR 2`,20,28);
      const variants=[...[0,1,2,3,4].map(level=>({level,axis:null})),...[2,3,4].flatMap(level=>['horizontal','vertical'].map(axis=>({level,axis})))];
      variants.forEach((variant,index)=>{
        const x=100+(index%4)*200;const y=160+Math.floor(index/4)*185;
        context.save();context.translate(x,y-16*zoom);context.scale(zoom,zoom);
        const building={id:'fixture',kind:'house',tx:0,ty:0,...(variant.axis?{houseLot:variant.axis}:{})};
        const drawn=variant.axis?compound.drawHouseCompoundSprite(context,building,variant.level):single.drawHistoricalHouse(context,building,variant.level);
        context.restore();if(!drawn)throw Error('Sprite not ready');
        context.fillStyle='#352b20';context.font='12px sans-serif';context.textAlign='center';context.fillText(`L${variant.level} ${variant.axis??'single'}`,x,y+25);
      });
    },zoom);
    await page.locator('#sprite-study').screenshot({path:`${output}-zoom${zoom}.jpg`,type:'jpeg',quality:85});
  }
}finally{await browser.close();}
