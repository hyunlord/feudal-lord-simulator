import {execFileSync} from 'node:child_process';
import test from 'node:test';
for(const failed of [false,true])test(`timber texture ${failed?'failure preserves fallback':'loads once'}`,()=>{
 execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',`
 import assert from 'node:assert/strict';
 import {preloadTimberWallAssets,timberWallTexture,timberWallAssetStatus} from './src/render/timberWallAssets.ts';
 let count=0;globalThis.Image=class {constructor(){count++;}set src(value){this.naturalWidth=1254;this.naturalHeight=1254;queueMicrotask(()=>${failed}?this.onerror():this.onload());}};
 const p=preloadTimberWallAssets();assert.equal(p,preloadTimberWallAssets());await p;
 assert.equal(count,1);assert.equal(timberWallTexture()!==null,${!failed});assert.equal(timberWallAssetStatus().status,'${failed?'missing':'ready'}');
 `]);
});
