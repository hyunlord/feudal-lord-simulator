/* Browser-only observation. No game module or rendered pixels are replaced. */
(() => {
  const records = new WeakMap();
  const masks = new Map();
  const original = CanvasRenderingContext2D.prototype.drawImage;
  function instrument(proto) {
    const draw = proto.drawImage, clear = proto.clearRect, fill = proto.fillRect;
    proto.fillRect = function(x,y,w,h) {
      const m=this.getTransform();
      if(x===0 && y===0 && w*m.a>=this.canvas.width && h*m.d>=this.canvas.height && this.globalAlpha===1) records.set(this.canvas,[]);
      return fill.call(this,x,y,w,h);
    };
    proto.clearRect = function(...args) {
      if(args[2] >= this.canvas.width && args[3] >= this.canvas.height) records.set(this.canvas, []);
      return clear.apply(this,args);
    };
    proto.drawImage = function(image,...args) {
      const result = draw.call(this,image,...args);
      const w=image.width,h=image.height;
      if(!w || !h) return result;
      const [sx,sy,sw,sh,dx,dy,dw,dh] = args.length===8 ? args : args.length===4 ? [0,0,w,h,...args] : [0,0,w,h,...args,w,h];
      if(!sw || !sh || !dw || !dh) return result;
      const matrix=this.getTransform();
      const url=image.currentSrc || image.src;
      const callsite = url && /walker|workers|people|villagers/.test(url) ? (new Error().stack || '').split('\n').slice(1,16).join(' ') : '';
      const src = url ? [{callsite,asset:new URL(url,location.href).pathname,rect:[sx,sy,sw,sh],image,source:[sx,sy,sw,sh]}] : records.get(image) || [];
      if(!src.length) return result;
      let out=records.get(this.canvas); if(!out) {out=[];records.set(this.canvas,out);}
      for(const item of src) {
        if(out.length>=12000) break;
        const [ix,iy,iw,ih]=item.rect;
        const l=Math.max(ix,sx),t=Math.max(iy,sy),r=Math.min(ix+iw,sx+sw),b=Math.min(iy+ih,sy+sh);
        if(r<=l || b<=t) continue;
        const corners=[[l,t],[r,t],[l,b],[r,b]].map(([x,y])=>matrix.transformPoint({x:dx+(x-sx)*dw/sw,y:dy+(y-sy)*dh/sh}));
        const xx=Math.min(...corners.map(p=>p.x)),yy=Math.min(...corners.map(p=>p.y));
        const ww=Math.max(...corners.map(p=>p.x))-xx,hh=Math.max(...corners.map(p=>p.y))-yy;
        out.push({...item,rect:[xx,yy,ww,hh],alpha:this.globalAlpha*(item.alpha??1)});
      }
      return result;
    };
  }
  instrument(CanvasRenderingContext2D.prototype);
  if(typeof OffscreenCanvasRenderingContext2D!=='undefined') instrument(OffscreenCanvasRenderingContext2D.prototype);
  window.__visionSnapshot = () => {
    const canvas=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0];
    if(!canvas) throw Error('world canvas absent');
    const items=records.get(canvas)||[];
    return items.filter(i=>i.rect[0]+i.rect[2]>0&&i.rect[1]+i.rect[3]>0&&i.rect[0]<canvas.width&&i.rect[1]<canvas.height)
      .map((i,order)=>({asset:i.asset,box:{x:Math.floor(i.rect[0]),y:Math.floor(i.rect[1]),width:Math.max(1,Math.ceil(i.rect[2])),height:Math.max(1,Math.ceil(i.rect[3]))},order,source:i.source,callsite:i.callsite||"",alpha:i.alpha??1}));
  };
})();
