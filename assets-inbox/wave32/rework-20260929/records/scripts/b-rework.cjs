const fs=require('fs');
const crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {createCanvas,loadImage}=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=__dirname+'/..',v1=root+'/../astra-wave32-v1';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function registered(s){const p=await sharp(root+'/native/b/'+s+'.png').resize(1322,1190,{fit:'fill'}).png().toBuffer();return sharp(p).extract({left:230,top:21,width:874,height:1093}).resize(99,126,{fit:'fill'}).extend({left:31,right:30,top:3,bottom:15,background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer();}
(async()=>{
const base=await sharp(v1+'/assets/granary_b-v1.png').ensureAlpha().raw().toBuffer();
const roof=await sharp(root+'/records/masks/b-roof.png').ensureAlpha().raw().toBuffer();
const contact=await sharp(v1+'/records/masks/contact.png').ensureAlpha().raw().toBuffer();
const prompts=JSON.parse(fs.readFileSync(root+'/native/b/prompts.json'));
const rows=[];
for(const s of ['snow','boarded']){
const d=await registered(s),out=Buffer.alloc(base.length),mask=Buffer.alloc(base.length);let rp=0,sp=0;
for(let y=0;y<144;y++)for(let x=0;x<160;x++){
const i=(y*160+x)*4,roofPixel=roof[i+3]>=128;
if(roofPixel)rp++;
let keep=s==='snow'?roofPixel&&d[i]>140&&d[i+1]>140&&d[i+2]>140&&d[i+2]>=d[i]-10&&d[i+3]>128:x>=50&&x<=70&&y>=55&&y<=87&&d[i+3]>128;
keep=keep&&base[i+3]>0&&contact[i+3]===0;
if(keep){for(let j=0;j<3;j++)out[i+j]=d[i+j];out[i+3]=Math.min(d[i+3],base[i+3]);if(s==='snow'){sp++;mask[i]=mask[i+1]=mask[i+2]=mask[i+3]=255;}}
}
const file='assets/granary_b_'+s+'-v1.png';await sharp(out,{raw:{width:160,height:144,channels:4}}).png().toFile(root+'/'+file);
const row={file,state:s,variant:'b',status:'candidate_rework',width:160,height:144,pivot:[80,128],prompt:prompts[s],ref:['../astra-wave32-v1/native/b/base.png'],nativeOutput:'native/b/'+s+'.png',baseUnchangedSha256:hash(v1+'/assets/granary_b-v1.png'),registration:{nativeNormalization:[1322,1190],nativeCrop:[230,21,874,1093],targetRect:[31,3,99,126]},postprocess:'Mechanical registration, snow color segmentation or loading door crop, clipped to unchanged base alpha and zeroed contact stripe. No procedural drawing.'};
if(s==='snow'){const roofMask='records/masks/b-roof.png',snowMask='records/masks/b-snow.png';await sharp(mask,{raw:{width:160,height:144,channels:4}}).png().toFile(root+'/'+snowMask);Object.assign(row,{roofMask,snowMask,roofPixels:rp,snowPixels:sp,coveragePercent:100*sp/rp,coverage:{roofPixels:rp,snowPixels:sp,percent:100*sp/rp,roofMask,snowMask},roofMaskSha256:hash(root+'/'+roofMask),roofMaskMatchesOriginal:hash(root+'/'+roofMask)===hash(v1+'/'+roofMask)});}
rows.push(row);
}
const c=createCanvas(480,320),ctx=c.getContext('2d');ctx.fillStyle='#91947e';ctx.fillRect(0,0,c.width,c.height);const b=await loadImage(v1+'/assets/granary_b-v1.png');for(let k=0;k<3;k++){ctx.drawImage(b,k*160,5);if(k)ctx.drawImage(await loadImage(root+'/'+rows[k-1].file),k*160,5);}ctx.font='13px sans-serif';ctx.fillStyle='black';['unchanged base','snow rework','boarded X rework'].forEach((s,i)=>ctx.fillText(s,i*160+20,160));ctx.imageSmoothingEnabled=false;ctx.drawImage(c,160,5,320,139,0,180,480,139);fs.writeFileSync(root+'/native/b/qa-composites.png',c.toBuffer('image/png'));
fs.writeFileSync(root+'/records/b-rework.json',JSON.stringify({assets:rows,qa:{scope:'Only B snow and boarded replaced. Other assets and original v1 untouched.',snowClassifier:'RGB each >140, blue>=red-10, alpha>128 inside identical original fixed roof mask alpha>=128. Base alpha clip and contact zero applied.',visual:'Native generation inspected: continuous organic piled snow obscures multiple tile joints; upper loading door has two thick pale crossing diagonal planks forming X. Actual size composite inspected separately.'}},null,2));console.log(rows.map(r=>({file:r.file,coverage:r.coverage})));
})();
