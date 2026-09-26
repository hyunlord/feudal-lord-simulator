const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
const plans=JSON.parse(fs.readFileSync(path.join(__dirname,'walkers-generation.json'),'utf8'));
function bounds(d){let l=148,t=148,r=-1,b=-1;for(let y=0;y<148;y++)for(let x=0;x<148;x++)if(d[(y*148+x)*4+3]>64){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y)}return{x:l,y:t,w:r-l+1,h:b-t+1};}
(async()=>{const all=[];for(const p of plans){
const ti=await loadImage(path.join(root,'templates',p.template)),raw=await loadImage(path.join(root,p.rawSource));
const tc=createCanvas(592,296),gc=createCanvas(592,296),out=createCanvas(592,296);tc.getContext('2d').drawImage(ti,0,0);gc.getContext('2d').drawImage(raw,0,0,592,296);const t=tc.getContext('2d'),g=gc.getContext('2d'),o=out.getContext('2d'),cells=[];
for(let f=0;f<2;f++)for(let c=0;c<4;c++){
const x=c*148,y=f*148,td=t.getImageData(x,y,148,148),gd=g.getImageData(x,y,148,148),tb=bounds(td.data),gb=bounds(gd.data),cc=createCanvas(148,148),cx=cc.getContext('2d');cx.drawImage(gc,x+gb.x,y+gb.y,gb.w,gb.h,tb.x,tb.y,tb.w,tb.h);const d=cx.getImageData(0,0,148,148),protectedMask=[],bodyAlphaMask=[];let restored=0;
for(let j=0;j<148;j++)for(let i=0;i<148;i++){
const k=(j*148+i)*4,R=td.data[k],G=td.data[k+1],B=td.data[k+2],A=td.data[k+3];
const skin=R>85&&R>G*1.17&&G>B*1.14&&B>G*.52;
const face=(c===1||c===2)&&j>=12&&j<38&&Math.abs(i-(tb.x+tb.w*.5))<16&&skin;
const hand=j>=55&&j<90&&Math.abs(i-(tb.x+tb.w*.5))>15&&skin;
const feet=p.sex==='m'?j>=99:j>=126||(j>=117&&R<100&&G<70&&B<55);
if(j>=40){if(A&&d.data[k+3]<16){let found=false;for(let step=1;step<=16&&!found;step++)for(const sign of [-1,1]){const nx=i+step*sign, nk=(j*148+nx)*4;if(nx>=0&&nx<148&&d.data[nk+3]>64){for(let n=0;n<3;n++)d.data[k+n]=d.data[nk+n];found=true;break}}if(!found)for(let n=0;n<3;n++)d.data[k+n]=td.data[k+n];}d.data[k+3]=A;bodyAlphaMask.push(j*148+i);}
if(face||hand||feet){for(let n=0;n<4;n++)d.data[k+n]=td.data[k+n];protectedMask.push(j*148+i);restored++;}
if(!d.data[k+3]){d.data[k]=0;d.data[k+1]=0;d.data[k+2]=0;}
}
cx.putImageData(d,0,0);o.drawImage(cc,x,y);cells.push({direction:['NE','SE','SW','NW'][c],frame:f,templateBounds:tb,rawNormalizedBounds:gb,registration:{source:[gb.x,gb.y,gb.w,gb.h],target:[tb.x,tb.y,tb.w,tb.h],method:'per-cell bbox affine registration; may anisotropically resize edited cloth'},protectedPixelCount:restored,protectedPixelIndices:protectedMask,bodyAlphaConstraint:{startY:40,rule:'template alpha retained below local master y40; this is a mask constraint, not an independent pose measurement'},maskRules:{face:'front direction skin-colour pixels local y12..37 within16px ofbboxcentre',hands:'skin-colour pixels local y55..89 beyond15px ofbboxcentre',feet:p.sex==='m'?'all local y>=99':'all y>=126 plus darkbrown pixels y>=117'}});
}
const master='masters/'+p.id+'.png',final='assets/workers/'+p.id+'.png';fs.writeFileSync(path.join(root,master),out.toBuffer('image/png'));const fin=createCanvas(296,148);fin.getContext('2d').drawImage(out,0,0,296,148);fs.writeFileSync(path.join(root,final),fin.toBuffer('image/png'));
const rec={id:p.id,role:'walker_sheet',width:296,height:148,file:final,template:p.template,files:{master,final,raw:p.rawSource},generationRecords:[p],processing:{script:'records/walkers-process.cjs',masterSize:[592,296],finalSize:[296,148],downsample:.5,cells},qa:{status:'candidate; root overlay inspection pending',rawModelPixelExact:false,anatomy:'original classified face/hand/feet pixels restored; skin mask is heuristic and exact pixel equality alone does not prove all anatomical landmarks',constraintWarning:'body alpha is constrained by compositor; do not report this as independent generated pose accuracy',limitations:['Original foot pixels may retain a small original hem at ankle.','Same template body build retained, face anatomy not a new body design.','Raw edit is not pixel exact and is preserved for audit.']}};fs.writeFileSync(path.join(root,'records',p.id+'.json'),JSON.stringify(rec,null,2));all.push(rec);
}fs.writeFileSync(path.join(root,'records/walkers-reskins.json'),JSON.stringify(all,null,2));})();
