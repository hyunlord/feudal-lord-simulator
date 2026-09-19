import { execFileSync } from 'node:child_process';
import test from 'node:test';
for (const mode of ['ready','error','wrong_size','constructor_throw','src_throw','string_throw']) {
 test(`gate parts settle with procedural fallback when ${mode}`,()=>{
  execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',`
   import assert from 'node:assert/strict';
   import {preloadGateAssets,gateAssetStatuses} from './src/render/gateArtAssets.ts';
   import {drawRegisteredGate} from './src/render/gateArtRenderer.ts';
   let count=0;
   globalThis.Image=class {
    constructor(){count++;if('${mode}'==='constructor_throw')throw new Error('unavailable');}
    set src(value){this.url=value;if('${mode}'==='src_throw')throw new Error('unavailable');if('${mode}'==='string_throw')throw 'unavailable';this.naturalWidth='${mode}'==='wrong_size'?10:1254;this.naturalHeight=1254;queueMicrotask(()=> '${mode}'==='error'?this.onerror():this.onload());}
   };
   const pending=preloadGateAssets();assert.equal(pending,preloadGateAssets());await pending;
   assert.equal(count,8);assert.ok(gateAssetStatuses().every(a=>a.status===('${mode}'==='ready'?'ready':'missing')));
   const drawn=[];const context={save(){},restore(){},transform(){},getTransform(){return {a:1,b:0,c:0,d:1,e:0,f:0};},drawImage(image){drawn.push(image.url);}};
   const node={point:{x:4,y:4},neighbors:[{x:3,y:4},{x:5,y:4}],kind:'gate'};
   assert.equal(drawRegisteredGate(context,node,'stone'),'${mode}'==='ready');
   assert.ok(drawn.every(url=>!url.includes('closed')));
   if('${mode}'==='ready'){assert.ok(drawn.some(url=>url.includes('stone_arch')));assert.ok(drawn.some(url=>url.includes('doors_open')));}
  `],{timeout:5000});
 });
}
