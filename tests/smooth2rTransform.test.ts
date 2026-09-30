import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

import type { Walker } from "../src/agents/walker.types";
import { drawWalker } from "../src/render/drawWalkers";
import { drawCroppedWorldSprite } from "../src/render/worldSprite";

// SMOOTH-2R ③: getTransform() allocates a DOMMatrix per call; the world pass reads it once and passes it down.
const TRANSFORM = { a: 1.7, b: 0, c: 0, d: 1.7, e: 0.3, f: -0.4 };
const SOURCE = { x: 10, y: 20, width: 100, height: 110 };
const DESTINATION = { x: 12.3, y: 24.7, width: 84.48, height: 91.3 };

/** A context that logs every call and property write, and counts getTransform(). */
function recordingContext() {
  const log: string[] = [];
  let reads = 0;
  const target: Record<string | symbol, unknown> = { imageSmoothingEnabled: true, globalAlpha: 1 };
  const context = new Proxy(target, {
    get(object, key) {
      if (key === "getTransform") return () => { reads++; return { ...TRANSFORM }; };
      if (key in object) return object[key];
      return (...args: unknown[]) => { log.push(`${String(key)}(${JSON.stringify(args)})`); };
    },
    set(object, key, value) { log.push(`${String(key)}=${JSON.stringify(value)}`); object[key] = value; return true; },
  });
  return { context, log, reads: () => reads };
}

test("an unsnapped cropped sprite does not read the transform", () => {
  const { context, log, reads } = recordingContext();
  drawCroppedWorldSprite(context as never, {} as HTMLImageElement, SOURCE, DESTINATION, false, true);
  assert.equal(reads(), 0);
  assert.ok(log.includes(`drawImage(${JSON.stringify([{}, 10, 20, 100, 110, 12.3, 24.7, 84.48, 91.3])})`), log.join("\n"));
});

test("a snapped cropped sprite with the transform passed draws what getTransform() gave, without reading it", () => {
  const read = recordingContext();
  drawCroppedWorldSprite(read.context as never, {} as HTMLImageElement, SOURCE, DESTINATION, true, false);
  const passed = recordingContext();
  drawCroppedWorldSprite(passed.context as never, {} as HTMLImageElement, SOURCE, DESTINATION, true, false, TRANSFORM);
  assert.equal(read.reads(), 1);
  assert.equal(passed.reads(), 0);
  assert.deepEqual(passed.log, read.log);
});

test("a walker with the frame's transform passed draws the same calls without reading it", () => {
  const walker = {
    id: "carter-a", kind: "carter", homeBuildingId: "logging-camp", destination: { kind: "building", buildingId: "storehouse" },
    mission: "deliver", phase: "outbound", position: { tx: 2.5, ty: 1 }, path: [{ tx: 2, ty: 1 }, { tx: 3, ty: 1 }],
    pathIndex: 0, previousTile: null, cargo: { resource: "logs", amount: 4 }, spawnedTick: 10, reservation: null, cancellation: null,
  } as unknown as Walker;
  const read = recordingContext();
  drawWalker(read.context as never, walker, 2);
  const passed = recordingContext();
  drawWalker(passed.context as never, walker, 2, "normal", null, TRANSFORM);
  assert.equal(read.reads(), 1);
  assert.equal(passed.reads(), 0);
  assert.deepEqual(passed.log, read.log);
});

test("the wall raster cache with the transform passed blits where getTransform() put it, without reading it", () => {
  execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import {drawCachedWorldRaster} from './src/render/worldRasterCache.ts';
    const paint={setTransform(){},drawImage(){},save(){},restore(){}};
    globalThis.document={createElement(){return {width:0,height:0,getContext:()=>paint}}};
    const transform={a:1.5,b:0,c:0,d:1.5,e:10.4,f:-3.6};
    const run=(pass)=>{
      let reads=0; const blits=[];
      const context={canvas:{width:100,height:100},globalAlpha:1,globalCompositeOperation:'source-over',imageSmoothingEnabled:true,imageSmoothingQuality:'low',
        getTransform:()=>{reads++;return {...transform}},setTransform(){},drawImage(...args){blits.push(args.slice(1))},save(){},restore(){}};
      for (let frame=0; frame<2; frame++) drawCachedWorldRaster(context,'wall',{left:0,top:0,right:40,bottom:30},()=>{},pass?transform:undefined);
      return {reads,blits};
    };
    const read=run(false), passed=run(true);
    assert.equal(read.reads,2); assert.equal(passed.reads,0);
    assert.deepEqual(passed.blits,read.blits); assert.deepEqual(read.blits[0],[10,-4]);
  `], { encoding: "utf8" });
});
