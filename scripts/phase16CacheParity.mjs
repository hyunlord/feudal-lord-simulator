import { pathToFileURL } from 'node:url';
const moduleName = process.env.PLAYWRIGHT_MODULE ?? 'playwright-core';
const { chromium } = await import(moduleName.startsWith('/') ? pathToFileURL(moduleName).href : moduleName);
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
const state = JSON.parse(gunzipSync(await readFile('tests/fixtures/phase16-city.json.gz')).toString('utf8'));
const output = process.argv[2] ?? 'output/phase16/E-parity.json';
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1600,height:1100}});
  await page.routeWebSocket('**',socket=>socket.close());
  await page.route('**/src/render/worldRasterCache.ts*',async route=>{
    const response=await route.fetch(); const source=await response.text();
    const anchor='function drawCachedWorldRaster(context, content, bounds, draw) {';
    if(!source.includes(anchor))throw new Error('Cache instrumentation anchor changed');
    await route.fulfill({response,body:source.replace(anchor,`${anchor} if(window.bypassRaster) { draw(context); return; }`)});
  });
  await page.goto('http://127.0.0.1:3226/');
  const result=await page.evaluate(async state=>{
    const {renderFrame}=await import('/src/render/renderer.ts');
    for(const path of ['worldAssets','stoneWallAssets','gateArtAssets','timberWallAssets','historicalHouseAssets','houseCompoundAssets','historicalFacilityAssets','runtimeActorAssets','constructionArtAssets']) {
      const module=await import(`/src/render/${path}.ts`);
      for(const [name,fn] of Object.entries(module)) if(name.startsWith('preload')&&typeof fn==='function') await fn();
    }
    const canvas=document.createElement('canvas'); const context=canvas.getContext('2d'); const rows=[];
    for(const dpr of [1,2])for(const zoom of [.5,1,1.35])for(const pan of [0,.35]){
      canvas.width=1200*dpr;canvas.height=850*dpr;
      const camera={zoom,panX:600+pan,panY:400-1440*zoom+pan};
      function draw(bypass,game=state,pose=camera){
        window.bypassRaster=bypass;context.setTransform(1,0,0,1,0,0);context.fillStyle='#222';context.fillRect(0,0,canvas.width,canvas.height);
        context.setTransform(dpr*pose.zoom,0,0,dpr*pose.zoom,dpr*pose.panX,dpr*pose.panY);
        renderFrame({context,state:game,camera:pose,viewport:{width:1200,height:850},preview:{tool:null,tile:null,footprint:[],roadPath:[],ok:true,reason:null,cursor:null},nowMs:0});
        return context.getImageData(0,0,canvas.width,canvas.height).data;
      }
      for(const [name,game] of [['initial',state],['tick',{...state,tick:state.tick+20}],['wall_removed',{...state,palisade:{...state.palisade,segments:state.palisade.segments.slice(1)}}]]){
        draw(true,game);const expected=draw(true,game);const cold=draw(false,game);const hot=draw(false,game);
        draw(false,game,{...camera,panX:camera.panX+2000});const restored=draw(false,game);
        let changed=0,hotChanged=0,restoredChanged=0,max=0,sum=0;
        for(let i=0;i<expected.length;i+=4){let m=0;for(let c=0;c<4;c++){const diff=Math.abs(expected[i+c]-hot[i+c]);m=Math.max(m,diff);sum+=diff;}if(m)changed++;
          if(cold[i]!==hot[i]||cold[i+1]!==hot[i+1]||cold[i+2]!==hot[i+2]||cold[i+3]!==hot[i+3])hotChanged++;
          if(restored[i]!==hot[i]||restored[i+1]!==hot[i+1]||restored[i+2]!==hot[i+2]||restored[i+3]!==hot[i+3])restoredChanged++;
          max=Math.max(max,m);
        }
        rows.push({dpr,zoom,pan,name,changed,hotChanged,restoredChanged,max,mean:sum/expected.length});
      }
    }
    const {palisadeSegmentRenderItems}=await import('/src/render/palisadeObjectRenderItems.ts');
    const {computeVisibleTileRange}=await import('/src/render/renderVisibility.ts');
    const {drawPalisadeSegment}=await import('/src/render/drawPalisadeSegments.ts');
    const silhouettes=[];
    const mask=document.createElement('canvas');const maskContext=mask.getContext('2d');
    for(const dpr of [1,2])for(const zoom of [.5,1,1.35])for(const pan of [0,.35]){
      mask.width=1200*dpr;mask.height=850*dpr;
      const camera={zoom,panX:600+pan,panY:400-1440*zoom+pan};
      const items=palisadeSegmentRenderItems(state.palisade,computeVisibleTileRange({camera,viewport:{width:1200,height:850},world:state}));
      const drawMask=bypass=>{
        window.bypassRaster=bypass;maskContext.setTransform(1,0,0,1,0,0);maskContext.clearRect(0,0,mask.width,mask.height);
        maskContext.setTransform(dpr*zoom,0,0,dpr*zoom,dpr*camera.panX,dpr*camera.panY);
        for(const item of items)drawPalisadeSegment(maskContext,{segment:item.segment,gate:item.gate,gates:item.gates,stoneNodes:item.stoneNodes,zoom});
        return maskContext.getImageData(0,0,mask.width,mask.height).data;
      };
      drawMask(true);const expected=drawMask(true);const actual=drawMask(false);
      let addedOutsideTwoPixels=0,removedOutsideTwoPixels=0,opaqueInteriorHoles=0; const outliers=[];
      for(let y=2;y<mask.height-2;y++)for(let x=2;x<mask.width-2;x++){
        const alpha=(data,x,y)=>data[(y*mask.width+x)*4+3];
        const old=alpha(expected,x,y),next=alpha(actual,x,y);
        if(old===next)continue;
        let oldNear=false,nextNear=false,opaque=true;
        for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
          oldNear ||= alpha(expected,x+dx,y+dy)>0;nextNear ||= alpha(actual,x+dx,y+dy)>0;
          opaque &&= alpha(expected,x+dx,y+dy)===255;
        }
        if(next>0&&!oldNear){addedOutsideTwoPixels++;outliers.push({x,y,old,next});}
        if(old>0&&!nextNear){removedOutsideTwoPixels++;outliers.push({x,y,old,next});}
        if(opaque&&next<254)opaqueInteriorHoles++;
      }
      silhouettes.push({dpr,zoom,pan,addedOutsideTwoPixels,removedOutsideTwoPixels,opaqueInteriorHoles,outliers,structuralOutliers:outliers.filter(pixel=>Math.max(pixel.old,pixel.next)>1).length});
    }
    const {drawCachedWorldRaster,worldRasterCacheDiagnostics}=await import('/src/render/worldRasterCache.ts');
    const probe=document.createElement('canvas');probe.width=200;probe.height=200;const paint=probe.getContext('2d');let calls=0;
    const bounds={left:-100,top:-100,right:200,bottom:200};
    const render=key=>drawCachedWorldRaster(paint,key,bounds,ctx=>{calls++;ctx.fillStyle='red';ctx.fillRect(-30,10,60,20);});
    window.bypassRaster=false;render('ready:A');render('ready:A');if(calls!==1)throw Error('unchanged content did not reuse');
    paint.translate(.35,0);render('ready:A');if(calls!==1)throw Error('pan regenerated cache');
    probe.width=220;render('ready:A');if(calls!==1)throw Error('viewport resize regenerated world cache');
    render('loading:A');if(calls!==2)throw Error('asset state stale');
    paint.globalAlpha=.5;render('loading:A');render('loading:A');if(calls!==4)throw Error('alpha fallback broken');
    const createElement=document.createElement.bind(document);
    let readbackFallbackCalls=0;
    const fallbackCanvas=createElement('canvas');fallbackCanvas.width=200;fallbackCanvas.height=200;
    const fallbackContext=fallbackCanvas.getContext('2d');
    try {
      document.createElement=(tag,...args)=>{
        const element=createElement(tag,...args);
        if(tag==='canvas')element.getContext('2d').getImageData=()=>{throw new DOMException('tainted test surface','SecurityError');};
        return element;
      };
      for(let index=0;index<2;index++)drawCachedWorldRaster(fallbackContext,'tainted-readback',bounds,ctx=>{
        readbackFallbackCalls++;ctx.fillStyle='red';ctx.fillRect(10,10,30,30);
      });
    } finally {document.createElement=createElement;}
    if(readbackFallbackCalls!==1||fallbackContext.getImageData(20,20,1,1).data[3]!==255)throw Error('readback failure lost drawing/cache');
    const diagnostics=worldRasterCacheDiagnostics(context);
    return {rows,silhouettes,edgeTolerance:{radiusDevicePixels:2,alphaQuantizationTail:1,reason:'All observed outliers beyond two pixels have alpha 0 to 1 out of 255; retain these raw samples while separately checking structural opacity.'},cacheInvalidation:{calls,readbackFallbackCalls,passed:true},diagnostics};
  },state);
  await writeFile(output,JSON.stringify(result,null,2));
  console.log(JSON.stringify({cases:result.rows.length,hotChanged:result.rows.reduce((n,r)=>n+r.hotChanged,0),restoredChanged:result.rows.reduce((n,r)=>n+r.restoredChanged,0),maxMean:Math.max(...result.rows.map(r=>r.mean)),silhouetteFailures:result.silhouettes.filter(row=>row.structuralOutliers||row.opaqueInteriorHoles),...result.diagnostics}));
  if(result.rows.some(row=>row.hotChanged||row.restoredChanged)||result.silhouettes.some(row=>row.structuralOutliers||row.opaqueInteriorHoles))process.exitCode=1;
}finally{await browser.close();}
