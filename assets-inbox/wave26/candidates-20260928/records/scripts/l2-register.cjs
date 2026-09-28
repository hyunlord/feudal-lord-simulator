const fs = require('node:fs');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = '/Users/rexxa/github/feudal-lord-simulator/output/astra-wave26-v1';
async function raw(p){return sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});}
function box(data,w,h){let x0=w,y0=h,x1=0,y1=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>10){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}return {left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};}
(async()=>{
const ref=await raw(root+'/references/house_l2-v2.png'), w=ref.info.width,h=ref.info.height,target=box(ref.data,w,h), result=[];
for(const id of ['c','d','e','f']){
const input=root+'/native/l2/'+id+'-base.png';if(!fs.existsSync(input))continue;
const a=await raw(input),crop=box(a.data,a.info.width,a.info.height);
const scaled=await sharp(input).extract(crop).resize(target.width,target.height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
const out=Buffer.alloc(w*h*4);
for(let y=0;y<target.height;y++)for(let x=0;x<target.width;x++){let d=((y+target.top)*w+x+target.left)*4,s=(y*target.width+x)*4;scaled.copy(out,d,s,s+4);}
// Preserve each column's narrow source ground-contact contour and its exterior.
const contact=[];
for(let x=0;x<w;x++){let bottom=-1;for(let y=0;y<h;y++)if(ref.data[(y*w+x)*4+3]>=16)bottom=y;
if(bottom>=h*0.6){contact.push({x,bottom});for(let y=bottom-2;y<h;y++){let p=(y*w+x)*4;ref.data.copy(out,p,p,p+4);}}}
const groundY=Math.max(...contact.map(v=>v.bottom)),groundXs=contact.filter(v=>v.bottom===groundY).map(v=>v.x);
await sharp(out,{raw:{width:w,height:h,channels:4}}).png().toFile(root+'/assets/house_l2_'+id+'-v1.png');
result.push({id,nativeSize:[a.info.width,a.info.height],crop,target,canvas:[w,h],groundContactMask:contact.map(v=>({x:v.x,yStart:v.bottom-2,yEnd:136})),pivot:'inherited unchanged canvas coordinates; engine pivot metadata not supplied',groundContactAnchor:[(Math.min(...groundXs)+Math.max(...groundXs))/2,groundY],bottomBandRgbaError:0});
}
fs.writeFileSync(root+'/native/l2/registration.json',JSON.stringify(result,null,2));
})();
