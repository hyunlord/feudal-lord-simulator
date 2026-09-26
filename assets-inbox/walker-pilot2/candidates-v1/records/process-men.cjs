const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
function bbox(ctx,x,y,w,h){let d=ctx.getImageData(x,y,w,h).data,l=w,t=h,r=-1,b=-1;for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(d[(j*w+i)*4+3]>64){l=Math.min(l,i);r=Math.max(r,i);t=Math.min(t,j);b=Math.max(b,j)}return {x:l,y:t,w:r-l+1,h:b-t+1};}
(async()=>{for(const id of ['P1','P4']){
const raw=await loadImage(root+'/sources/'+id+'-sheet-edit.png'),template=await loadImage(root+'/templates/masters/'+id+'.png');
let tc=createCanvas(592,296),t=tc.getContext('2d');t.drawImage(template,0,0);let gc=createCanvas(592,296),g=gc.getContext('2d');g.drawImage(raw,0,0,592,296);const rows=[];
for(let f=0;f<2;f++)for(let c=0;c<4;c++){const x=c*148,y=f*148; rows.push({cell:[c,f],template:bbox(t,x,y,148,148),edited:bbox(g,x,y,148,148)});}
fs.writeFileSync(root+'/records/reskin-'+id+'-bounds.json',JSON.stringify(rows,null,2));
}})();
(async()=>{for(const id of ['P1','P4']){
const raw=await loadImage(root+'/sources/'+id+'-sheet-edit.png'),ti=await loadImage(root+'/templates/masters/'+id+'.png');
let tc=createCanvas(592,296),t=tc.getContext('2d');t.drawImage(ti,0,0);let gc=createCanvas(592,296),g=gc.getContext('2d');g.drawImage(raw,0,0,592,296);let out=createCanvas(592,296),o=out.getContext('2d');const records=[];
for(let f=0;f<2;f++)for(let c=0;c<4;c++){
let x=c*148,y=f*148,tb=bbox(t,x,y,148,148),gb=bbox(g,x,y,148,148);
let cc=createCanvas(148,148),q=cc.getContext('2d');q.drawImage(gc,x+gb.x,y+gb.y,gb.w,gb.h,tb.x,tb.y,tb.w,tb.h);
// Only headwear/clothing is edited: retain original legs/boots. Hands are checked visually after registration.
let td=t.getImageData(x,y,148,148),d=q.getImageData(0,0,148,148);let protectedPixels=0;
for(let j=0;j<148;j++)for(let i=0;i<148;i++){const k=(j*148+i)*4;const skin=td.data[k]>td.data[k+1]*1.15&&td.data[k+1]>td.data[k+2]*1.1&&td.data[k]>65;const hand=j>58&&j<89&&Math.abs(i-(tb.x+tb.w/2))>16&&skin; if(j>=99){for(let n=0;n<4;n++)d.data[k+n]=td.data[k+n];protectedPixels++;}}
q.putImageData(d,0,0);o.drawImage(cc,x,y);records.push({direction:['NE','SE','SW','NW'][c],frame:f,templateBounds:tb,rawNormalizedBounds:gb,registration:{source:[x+gb.x,y+gb.y,gb.w,gb.h],destination:[tb.x,tb.y,tb.w,tb.h]},protectedPixels,protectedRegion:'all local y>=99; hands remain image-edited and registered'});
}
fs.mkdirSync(root+'/masters',{recursive:true});fs.mkdirSync(root+'/assets/workers',{recursive:true});const name=id==='P1'?'wk_reskin_P1_merchant_m-v1':'wk_reskin_P4_labour_m-v1';fs.writeFileSync(root+'/masters/'+name+'.png',out.toBuffer('image/png'));let fin=createCanvas(296,148),fc=fin.getContext('2d');fc.drawImage(out,0,0,296,148);fs.writeFileSync(root+'/assets/workers/'+name+'.png',fin.toBuffer('image/png'));
fs.writeFileSync(root+'/records/reskin-'+id+'.json',JSON.stringify({id,status:'candidate',source:'sources/'+id+'-sheet-edit.png',generationRecord:'records/generation-'+id+'.json',method:'Imagegen template-sheet edit, per-cell bounding-box registration, original lower legs/boots pixels retained; final 50% resize. This is controlled compositing, NOT proof that raw imagegen preserved pixels.',rawPrecision:'not pixel exact; see rawNormalizedBounds',headFootValidation:'root final audit pending',frames:records},null,2));
}})();
