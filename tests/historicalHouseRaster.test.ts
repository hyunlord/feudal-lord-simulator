import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

for (const derivative of [false, true]) for (const compound of [false, true]) for (const failure of ["none", "null", "throw"] as const) {
  test(`${derivative ? "derived" : "original"} ${compound ? "compound" : "single"} house uses a bounded raster and settles after canvas ${failure}`, () => {
    const module = compound ? "houseCompoundAssets" : "historicalHouseAssets";
    const manifest = compound ? "houseCompoundAssetManifest" : "historicalHouseAssetManifest";
    const preload = compound ? "preloadHouseCompoundAssets" : "preloadHistoricalHouseAssets";
    const draw = compound ? "drawHouseCompoundSprite" : "drawHistoricalHouse";
    const script = `
      import assert from 'node:assert/strict';
      import { ${manifest} as manifest } from './src/render/${manifest}.generated.ts';
      import { ${preload} as preload, ${draw} as draw } from './src/render/${module}.ts';
      import { runtimeAssetDerivatives } from './src/render/runtimeAssetDerivatives.generated.ts';
      const thumbnails = [];
      const rasterCalls = [];
      globalThis.OffscreenCanvas = class {
        constructor(width, height) { if ('${failure}' === 'throw') throw new Error('canvas exhausted'); this.width=width; this.height=height; thumbnails.push(this); }
        getContext() { return '${failure}' === 'null' ? null : { getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0}), save(){}, restore(){}, drawImage(...args){rasterCalls.push(args);} }; }
      };
      globalThis.Image = class {
        set src(url) { const meta=manifest.find(m=>'/'+m.url===url); const derived=runtimeAssetDerivatives.find(d=>d.url===meta.url); this.naturalWidth=${derivative} ? derived.width : meta.width; this.naturalHeight=${derivative} ? derived.height : meta.height; queueMicrotask(()=>this.onload()); }
      };
      await preload();
      const calls=[];
      const context={imageSmoothingEnabled:false,getTransform:()=>({a:1,b:0,c:0,d:1,e:0,f:0}),save(){},restore(){},drawImage(...args){calls.push({args,smooth:this.imageSmoothingEnabled});}};
      for (const meta of manifest) {
        const building={id:'test',kind:'house',tx:2,ty:3,${compound ? "houseLot:meta.axis" : ""}};
        assert.equal(draw(context,building,meta.level),true);
      }
      assert.equal(calls.length,manifest.length);
      assert.ok(calls.every(call=>call.smooth));
      if ('${failure}' === 'none') {
        assert.equal(thumbnails.length,manifest.length);
        for (let index=0;index<manifest.length;index++) {
          const meta=manifest[index]; const derived=runtimeAssetDerivatives.find(d=>d.url===meta.url);
          const expectedWidth=meta.alphaBounds.width*(${derivative} ? derived.width/meta.width : 1);
          assert.ok(Math.abs(rasterCalls[index][3]-expectedWidth)<1e-8);
          assert.equal(calls[index].args[3],thumbnails[index].width);
        }
        assert.ok(calls.every(call=>thumbnails.includes(call.args[0])));
        assert.ok(thumbnails.every(canvas=>canvas.width>=112 && canvas.width<=170 && canvas.height>0 && canvas.height<512));
      } else assert.ok(calls.every(call=>call.args[0] instanceof Image));
    `;
    execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], { encoding: "utf8", timeout: 10000 });
    assert.ok(true);
  });
}
