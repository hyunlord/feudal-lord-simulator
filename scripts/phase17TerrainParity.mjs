import { pathToFileURL } from 'node:url';
const moduleName = process.env.PLAYWRIGHT_MODULE ?? 'playwright-core';
const { chromium } = await import(moduleName.startsWith('/') ? pathToFileURL(moduleName).href : moduleName);
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
const state = JSON.parse(gunzipSync(await readFile('tests/fixtures/phase16-city.json.gz')).toString('utf8'));
const output = process.argv[2] ?? 'output/phase17/terrain-parity.json';
const url = process.argv[3] ?? 'http://127.0.0.1:3237/';
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page = await browser.newPage({viewport:{width:1600,height:1100}});
  await page.routeWebSocket('**',socket=>socket.close());
  // The intercepted reference is the pre-Phase17 clipped-rectangle implementation.
  // Candidate mode executes the actual served product function without replacement.
  await page.route('**/src/render/drawTerrain.ts*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const anchor = 'function fillTerrainPattern(context, tile, pattern) {';
    if (!source.includes(anchor)) throw new Error('Terrain function anchor changed');
    const reference = `if(!window.directPattern){
      const center=tileToScreen(tile.tx,tile.ty);traceTerrainDiamond(context,tile);
      const previousAlpha=context.globalAlpha;context.save();try{
        context.clip();context.globalAlpha=previousAlpha*terrainTextureOpacity(tile.terrain);
        context.fillStyle=pattern;context.fillRect(snapToPixel(center.sx-TILE_W/2),snapToPixel(center.sy-TILE_H/2),TILE_W,TILE_H);
      }finally{context.globalAlpha=previousAlpha;context.restore();}return;}`;
    await route.fulfill({response,body:source.replace(anchor,anchor+reference)});
  });
  await page.goto(url);
  const result=await page.evaluate(async state=>{
    const {renderFrame}=await import('/src/render/renderer.ts');
    for(const path of ['worldAssets','stoneWallAssets','gateArtAssets','timberWallAssets','historicalHouseAssets','houseCompoundAssets','historicalFacilityAssets','runtimeActorAssets','constructionArtAssets','farmAssets']) {
      const module=await import(`/src/render/${path}.ts`);
      for(const [name,fn] of Object.entries(module)) if(name.startsWith('preload')&&typeof fn==='function') await fn();
    }
    const canvas=document.createElement('canvas'); const context=canvas.getContext('2d'); const rows=[];
    for(const dpr of [1,2])for(const zoom of [.5,1,1.35])for(const pan of [0,.35]){
      canvas.width=1200*dpr;canvas.height=850*dpr;
      const camera={zoom,panX:600+pan,panY:400-1440*zoom+pan};
      function draw(bypass,game=state,pose=camera){
        window.directPattern=!bypass;context.setTransform(1,0,0,1,0,0);context.fillStyle='#222';context.fillRect(0,0,canvas.width,canvas.height);
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
    const {drawTerrain}=await import('/src/render/drawTerrain.ts');
    const alphaRows=[];
    for(const terrain of ['grass','forest','rock'])for(const dpr of [1,2])for(const zoom of [.5,1,1.35])for(const pan of [0,.35]){
      const tiles=state.tiles.map(tile=>({...tile,terrain,hasRoad:false,buildingId:null}));const tile=tiles.find(tile=>tile.tx===45&&tile.ty===45);
      const game={...state,tiles,buildings:[],houses:[],constructionSites:[],palisade:null,forestHarvests:[]};
      const canvas=document.createElement('canvas');canvas.width=400*dpr;canvas.height=300*dpr;const context=canvas.getContext('2d');
      const draw=direct=>{window.directPattern=direct;context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);context.setTransform(dpr*zoom,0,0,dpr*zoom,dpr*(200+pan),dpr*(150-1440*zoom+pan));drawTerrain(context,{state:game,tiles:[tile],range:{minTx:45,maxTx:45,minTy:45,maxTy:45},zoom,objectRenderItems:[]});return context.getImageData(0,0,canvas.width,canvas.height).data;};
      const before=draw(false),after=draw(true);let alphaChanged=0,maxAlpha=0,interiorMax=0,interiorChanged=0,supportChanged=0,opaqueInteriorHoles=0,alphaBeyondEdge=0;const supportOutliers=[];
      for(let i=0;i<before.length;i+=4){const delta=Math.abs(before[i+3]-after[i+3]);if(delta)alphaChanged++;const x=(i/4)%canvas.width,y=Math.floor(i/4/canvas.width);let opaque=true,transparent=true;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const a=before[((y+dy)*canvas.width+x+dx)*4+3]??0;opaque&&=a===255;transparent&&=a===0;}if(delta&&(opaque||transparent))alphaBeyondEdge++;if((before[i+3]>0)!==(after[i+3]>0)){supportChanged++;supportOutliers.push({x,y,before:before[i+3],after:after[i+3]});}if(opaque&&after[i+3]<254)opaqueInteriorHoles++;maxAlpha=Math.max(maxAlpha,delta);if(before[i+3]===255&&after[i+3]===255){const d=Math.max(...[0,1,2].map(c=>Math.abs(before[i+c]-after[i+c])));if(d)interiorChanged++;interiorMax=Math.max(interiorMax,d);}}
      alphaRows.push({terrain,dpr,zoom,pan,alphaChanged,maxAlpha,interiorChanged,interiorMax,supportChanged,opaqueInteriorHoles,alphaBeyondEdge,supportOutliers});
    }
    return {rows,alphaRows};
  },state);
  await writeFile(output,JSON.stringify(result,null,2));
  if (result.rows.some(row => row.hotChanged || row.restoredChanged || row.max > 16 || row.mean > 0.2)
      || result.alphaRows.some(row => row.opaqueInteriorHoles || row.alphaBeyondEdge || row.interiorMax > 1
        || row.supportOutliers.some(pixel => Math.max(pixel.before,pixel.after) > 3))) {
    throw new Error('Terrain parity exceeded measured edge-AA envelope; inspect the saved report');
  }
  console.log(JSON.stringify({alphaCases:result.alphaRows.length,maxAlpha:Math.max(...result.alphaRows.map(r=>r.maxAlpha)),maxInterior:Math.max(...result.alphaRows.map(r=>r.interiorMax)),cases:result.rows.length,maxChanged:Math.max(...result.rows.map(x=>x.changed)),maxChannel:Math.max(...result.rows.map(x=>x.max)),maxMean:Math.max(...result.rows.map(x=>x.mean)),hotChanged:result.rows.reduce((n,r)=>n+r.hotChanged,0),restoredChanged:result.rows.reduce((n,r)=>n+r.restoredChanged,0)}));
}finally{await browser.close();}
