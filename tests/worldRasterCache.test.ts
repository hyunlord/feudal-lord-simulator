import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rasterCacheKey } from '../src/render/worldRasterCache';

test('raster key follows linear device transform and content but survives camera pan', () => {
  const base = { a:1,b:0,c:0,d:1,e:0,f:0 };
  const key = rasterCacheKey('wall:a', base);
  assert.notEqual(key, rasterCacheKey('wall:b', base));
  for (const name of ['a','b','c','d'] as const) {
    assert.notEqual(key, rasterCacheKey('wall:a', {...base,[name]:base[name]+.1}));
  }
  assert.equal(key, rasterCacheKey('wall:a', {...base,e:123.35,f:-456.7}));
});

test('whole-unit cache survives offscreen pan and resize, with bounded allocation and canvas fallback', () => {
  execFileSync(process.execPath, ['--import','tsx','--input-type=module','-e', `
    import assert from 'node:assert/strict';
    import {drawCachedWorldRaster} from './src/render/worldRasterCache.ts';
    let transforms=[], blits=[], allocations=[], paints=0, mode='ok';
    const paint={setTransform(...args){transforms.push(args)},drawImage(){},save(){},restore(){}};
    globalThis.document={createElement(){if(mode==='throw')throw new Error('canvas exhausted'); const canvas={width:0,height:0,getContext(){return mode==='null'?null:paint}};allocations.push(canvas);return canvas;}};
    let transform={a:1,b:0,c:0,d:1,e:-1000,f:0};
    const context={canvas:{width:100,height:100},globalAlpha:1,globalCompositeOperation:'source-over',imageSmoothingEnabled:true,imageSmoothingQuality:'low',getTransform:()=>transform,setTransform(){},drawImage(...args){blits.push(args)},save(){},restore(){}};
    const bounds={left:0,top:0,right:200,bottom:200};
    const draw=()=>paints++;
    drawCachedWorldRaster(context,'wall',bounds,draw);
    assert.equal(allocations[0].width,200);
    assert.equal(allocations[0].height,200);
    transform={...transform,e:.35,f:12.7};context.canvas.width=300;
    drawCachedWorldRaster(context,'wall',bounds,draw);
    assert.equal(paints,1);
    assert.deepEqual(blits.at(-1).slice(1),[0,13]);
    drawCachedWorldRaster(context,'wall',{...bounds,right:201},draw);assert.equal(paints,2);
    drawCachedWorldRaster(context,'large',{...bounds,right:10000,bottom:10000},draw);assert.equal(paints,3);assert.equal(allocations.length,2);
    mode='throw';drawCachedWorldRaster(context,'failed',bounds,draw);assert.equal(paints,4);
    mode='null';drawCachedWorldRaster(context,'failed',bounds,draw);assert.equal(paints,5);
    context.globalAlpha=.5;drawCachedWorldRaster(context,'wall',bounds,draw);assert.equal(paints,6);
  `], {encoding:'utf8'});
});

test('raster cache evicts complete entries without exceeding eight million device pixels', () => {
  execFileSync(process.execPath, ['--import','tsx','--input-type=module','-e', `
    import assert from 'node:assert/strict';
    import {drawCachedWorldRaster,worldRasterCacheDiagnostics} from './src/render/worldRasterCache.ts';
    const paint={setTransform(){},drawImage(){}};
    globalThis.document={createElement(){return {width:0,height:0,getContext:()=>paint}}};
    const context={canvas:{width:100,height:100},globalAlpha:1,globalCompositeOperation:'source-over',imageSmoothingEnabled:true,imageSmoothingQuality:'low',getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0}),setTransform(){},drawImage(){},save(){},restore(){}};
    const bounds={left:0,top:0,right:2000,bottom:2000};let calls=0;
    for(const key of ['a','b','c'])drawCachedWorldRaster(context,key,bounds,()=>calls++);
    assert.equal(calls,3);assert.equal(worldRasterCacheDiagnostics(context).pixels,8000000);
    assert.equal(worldRasterCacheDiagnostics(context).evictions,1);
    drawCachedWorldRaster(context,'c',bounds,()=>calls++);assert.equal(calls,3);
    drawCachedWorldRaster(context,'a',bounds,()=>calls++);assert.equal(calls,4);
    assert.equal(worldRasterCacheDiagnostics(context).pixels,8000000);
  `], {encoding:'utf8'});
});

test('SMOOTH-2R: a raster is trimmed to its recorded drawing plus a pixel of margin, without reading pixels', () => {
  execFileSync(process.execPath, ['--import','tsx','--input-type=module','-e', `
    import assert from 'node:assert/strict';
    import {drawCachedWorldRaster,worldRasterCacheDiagnostics} from './src/render/worldRasterCache.ts';
    const allocations=[], copies=[];
    const paint={setTransform(){},fillRect(){},drawImage(...args){copies.push(args)},filter:'none',getImageData(){throw new Error('pixel read')}};
    globalThis.document={createElement(){const canvas={width:0,height:0,getContext:()=>paint};allocations.push(canvas);return canvas;}};
    const blits=[];
    const context={canvas:{width:100,height:100},globalAlpha:1,globalCompositeOperation:'source-over',imageSmoothingEnabled:false,imageSmoothingQuality:'low',getTransform:()=>({a:2,b:0,c:0,d:2,e:5,f:7}),setTransform(){},drawImage(...args){blits.push(args)},save(){},restore(){}};
    // Padded bounds 0..100 at scale 2 (a 200 px raster); the drawing is the 10 x 5 rectangle at (40, 30): device 80..100, 60..70.
    drawCachedWorldRaster(context,'post',{left:0,top:0,right:100,bottom:100},ctx=>ctx.fillRect(40,30,10,5));
    assert.equal(allocations.length,2);
    // The antialiased edge pixel and the margin pixel on each side: 78..102, 58..72.
    assert.deepEqual([allocations[1].width,allocations[1].height],[24,14]);
    assert.deepEqual(copies.at(-1),[allocations[0],78,58,24,14,0,0,24,14]);
    assert.deepEqual(blits.at(-1).slice(1),[78+5,58+7]);
    assert.equal(worldRasterCacheDiagnostics(context).pixels,24*14);
  `], {encoding:'utf8'});
});
