/* Observe the native transform; the historical camera lives in an effect closure. */
(() => {
  const cameras = new WeakMap();
  const awaitingWorldScale = new WeakSet();
  for (const operation of ['fillRect', 'clearRect']) {
    const original = CanvasRenderingContext2D.prototype[operation];
    CanvasRenderingContext2D.prototype[operation] = function(x,y,w,h) {
      const result = original.call(this,x,y,w,h);
      const m=this.getTransform();
      if(this.canvas instanceof HTMLCanvasElement && x===0 && y===0 &&
         m.b===0 && m.c===0 && m.e===0 && m.f===0 &&
         w*m.a>=this.canvas.width-1 && h*m.d>=this.canvas.height-1 &&
         (operation==='clearRect' || this.globalAlpha===1)) {
        awaitingWorldScale.add(this.canvas);
      }
      return result;
    };
  }
  const scale = CanvasRenderingContext2D.prototype.scale;
  CanvasRenderingContext2D.prototype.scale = function(x, y) {
    const before = this.getTransform();
    const result = scale.call(this, x, y);
    if (awaitingWorldScale.has(this.canvas) && this.canvas instanceof HTMLCanvasElement && x === y && x > 0 &&
        before.b === 0 && before.c === 0 && before.a === before.d && before.a > 0) {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = rect.width ? this.canvas.width / rect.width : 0;
      if (dpr > 0 && Math.abs(before.a - dpr) < 0.01) {
        awaitingWorldScale.delete(this.canvas);
        cameras.set(this.canvas, {zoom:x, panX:before.e/dpr, panY:before.f/dpr});
      }
    }
    return result;
  };
  window.__visionLegacyAttach = async () => {
    const canvas = [...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0];
    if (!canvas) throw Error('World canvas absent');
    const key = Object.keys(canvas).find(k=>k.startsWith('__reactFiber'));
    let store = null;
    for (let fiber=canvas[key]; fiber; fiber=fiber.return) {
      const value = fiber.memoizedProps?.value;
      if (value?.getState && value?.setSpeed) {store=value;break;}
    }
    if (!store) throw Error('GameStore provider absent');
    const {platformServices} = await import('/src/platform/platform.ts');
    const camera = () => {
      const result = cameras.get(canvas);
      if (!result) throw Error('Native world camera transform not observed');
      return {...result};
    };
    const viewport = () => {
      const rect=canvas.getBoundingClientRect();
      return {width:Math.round(rect.width),height:Math.round(rect.height)};
    };
    window.__vision = {store,input:platformServices().input,probe:()=>({camera,viewport})};
    return {camera:camera(),viewport:viewport()};
  };
})();
