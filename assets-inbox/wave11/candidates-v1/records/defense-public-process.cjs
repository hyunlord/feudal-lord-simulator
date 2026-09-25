const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
async function main(){
const jobs=JSON.parse(fs.readFileSync(path.join(__dirname,'defense-public-generations.json')));
const metadata=[];
const anchors=JSON.parse(fs.readFileSync(path.join(__dirname,'defense-public-anchors.json')));
function affine(p,q){const [u,v,w]=p,[U,V,W]=q;const d=(v[0]-u[0])*(w[1]-u[1])-(w[0]-u[0])*(v[1]-u[1]);const a=((V[0]-U[0])*(w[1]-u[1])-(W[0]-U[0])*(v[1]-u[1]))/d;const c=((W[0]-U[0])*(v[0]-u[0])-(V[0]-U[0])*(w[0]-u[0]))/d;const b=((V[1]-U[1])*(w[1]-u[1])-(W[1]-U[1])*(v[1]-u[1]))/d;const f=((W[1]-U[1])*(v[0]-u[0])-(V[1]-U[1])*(w[0]-u[0]))/d;return[a,b,c,f,U[0]-a*u[0]-c*u[1],U[1]-b*u[0]-f*u[1]];}
for(const j of jobs){
const family=['gate','tower'].includes(j.kind)?'defense':'public';
const id=`kit_${family}/stage_${j.stage}_${j.kind}-v1`;
const source=`sources/defense-public/${j.kind}-${j.stage}-raw.png`;
fs.copyFileSync(j.path,path.join(root,source));
const im=await loadImage(j.path),c=createCanvas(j.w,j.h),ctx=c.getContext('2d');
const raw=createCanvas(im.width,im.height),rc=raw.getContext('2d');rc.drawImage(im,0,0);const pixels=rc.getImageData(0,0,im.width,im.height);let fringeRemoved=0;for(let i=0;i<pixels.data.length;i+=4){if(pixels.data[i]>180&&pixels.data[i+1]<90&&pixels.data[i+2]<90&&pixels.data[i+3]<180){pixels.data[i+3]=0;fringeRemoved++;}}rc.putImageData(pixels,0,0);
const src=anchors.sources[`${j.kind}_${j.stage}`],target=anchors.targets[j.kind];let transform=src?affine(src,target):[1,0,0,1,0,0];if(j.kind==='gate'&&src){const a=(target[2][0]-target[0][0])/(src[2][0]-src[0][0]);const b=((target[2][1]-target[0][1])-(src[2][1]-src[0][1]))/(src[2][0]-src[0][0]);transform=[a,b,0,1,target[0][0]-a*src[0][0],target[0][1]-b*src[0][0]-src[0][1]];}ctx.setTransform(...transform);
ctx.drawImage(raw,0,0,j.w,j.h);
if(j.kind==='keep'&&j.stage==='plot'){const lower=createCanvas(j.w,j.h);lower.getContext('2d').drawImage(c,0,0);ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,246,j.w,j.h-246);ctx.drawImage(lower,0,246,j.w,j.h-246,0,246,j.w,(j.h-246)*.65);}
ctx.setTransform(1,0,0,1,0,0);const cleaned=ctx.getImageData(0,0,j.w,j.h);for(let i=3;i<cleaned.data.length;i+=4)if(cleaned.data[i]<6)cleaned.data[i]=0;ctx.putImageData(cleaned,0,0);
const file=`assets/${id}.png`;fs.writeFileSync(path.join(root,file),c.toBuffer('image/png'));
metadata.push({id,file,width:j.w,height:j.h,role:'object',pivot:[0,0],pivotConvention:'reference-canvas top-left; reuse reference runtime pivot when integrating; attached PNGs contain no authored pivot metadata',suggestedGroundAnchor:j.kind==='gate'?[256,288]:j.kind==='tower'?[256,289]:j.kind==='church'?[116.5,200]:[133,238],generationRecords:[{prompt:j.prompt,references:[`references/astra-wave11/astra-wave11-reference-files/${j.ref}`],rawFile:source}],processing:{method:j.kind==='gate'?'Two outer ground endpoints; vertical axis preserved; middle point audited only. One raw resize. Red low-alpha contamination cleared.':'Three noncollinear ground contacts affine-registered; one raw resize. Red low-alpha contamination cleared.',sourceSize:[im.width,im.height],canvasSize:[j.w,j.h],sourceContacts:src,targetContacts:target,affine:transform,fringeRemoved},qa:{status:'candidate',registration:src?'manual ground anchors; approximately 1–3px tracing uncertainty':'pending visual coordinate audit',noPeople:true,noMaterialHeaps:true}});
}
for(const m of metadata){const [a,b,c,d,e,f]=m.processing.affine;m.processing.contactResidualPx=m.processing.sourceContacts.map(([x,y],i)=>{const q=m.processing.targetContacts[i];return Number(Math.hypot(a*x+c*y+e-q[0],b*x+d*y+f-q[1]).toFixed(3));});if(m.id==='kit_public/stage_plot_keep-v1')m.processing.forebuildingRegistration='Only projected forebuilding survey-stake zone below y246 compressed vertically0.65 to stay on same266canvas; main square footprint anchors retained, approximately1–3px tracing uncertainty.';m.processing.alphaCleanup='Alpha below6 cleared after resampling to remove isolated near-transparent edge pixels.';}
fs.writeFileSync(path.join(root,'metadata-defense-public.json'),JSON.stringify(metadata,null,2));
const c=createCanvas(1200,980),x=c.getContext('2d');x.fillStyle='#77846b';x.fillRect(0,0,1200,980);x.font='18px sans-serif';x.fillStyle='#fff';
const stages=['plot','foundation','frame','roof'];
for(let row=0;row<4;row++){const kind=['gate','tower','church','keep'][row];for(let col=0;col<4;col++){const j=jobs.find(a=>a.kind===kind&&a.stage===stages[col]);if(!j)continue;const family=row<2?'defense':'public',im=await loadImage(path.join(root,`assets/kit_${family}/stage_${j.stage}_${kind}-v1.png`));const scale=row<2?.45:.8;x.drawImage(im,20+col*300,45+row*240,im.width*scale,im.height*scale);x.fillText(`${kind} ${j.stage}`,20+col*300,28+row*240);}}
fs.writeFileSync(path.join(root,'records/defense-public-contact.png'),c.toBuffer('image/png'));
}
main();
