const fs=require('fs');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {createCanvas,loadImage}=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas');
const root=__dirname+'/..';
async function registered(state){const source=await sharp(root+'/native/b/'+state+'.png').resize(1322,1190,{fit:'fill'}).png().toBuffer();return sharp(source).extract({left:230,top:21,width:874,height:1093}).resize(99,126,{fit:'fill'}).extend({left:31,right:30,top:3,bottom:15,background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer();}
function inside(x,y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){if(((p[i][1]>y)!=(p[j][1]>y))&&(x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0]))c=!c;}return c;}
(async()=>{
const base=await registered('base');
await sharp(base,{raw:{width:160,height:144,channels:4}}).png().toFile(root+'/assets/granary_b-v1.png');
const roof=await sharp(root+'/records/masks/b-roof.png').ensureAlpha().raw().toBuffer();
const contact=await sharp(root+'/records/masks/contact.png').ensureAlpha().raw().toBuffer();
const prompts=JSON.parse(fs.readFileSync(root+'/native/b/prompts.json'));
const rows=[{file:'assets/granary_b-v1.png',state:'base',variant:'b',roof:'muted clay tile',shape:'original barn raised rectangular gabled granary',wall:'oak planks with large diagonal cross braces',prompt:fs.readFileSync(root+'/native/b/base-prompt.txt','utf8').trim(),ref:['references/barn.png','references/farmstead.png'],nativeOutput:'native/b/base.png'}];
let coverage;
for(const s of ['full','half','empty','snow','boarded','weathered']){
const d=await registered(s),out=Buffer.alloc(base.length),snow=Buffer.alloc(base.length);let rp=0,sp=0;
for(let y=0;y<144;y++)for(let x=0;x<160;x++){
const i=(y*160+x)*4, roofPixel=roof[i+3]>=128;
if(roofPixel)rp++;
const snowPixel=d[i]>140&&d[i+1]>140&&d[i+2]>140&&d[i+2]>=d[i]-10&&d[i+3]>128;
if(s==='snow'&&roofPixel&&snowPixel){sp++;snow[i]=snow[i+1]=snow[i+2]=snow[i+3]=255;}
let changed=Math.max(Math.abs(d[i]-base[i]),Math.abs(d[i+1]-base[i+1]),Math.abs(d[i+2]-base[i+2]))>8;
let keep=s==='snow'?roofPixel&&snowPixel:changed;
if(['full','half','empty','boarded'].includes(s))keep=inside(x,y,[[37,45],[73,54],[80,119],[53,128],[35,114]])&&d[i+3]>64;
if(['snow','weathered','boarded'].includes(s))keep=keep&&base[i+3]>64;
if(y>=128||contact[i+3]>0)keep=false;
if(keep){for(let j=0;j<4;j++)out[i+j]=d[i+j];}
}
const file='assets/granary_b_'+s+'-v1.png';await sharp(out,{raw:{width:160,height:144,channels:4}}).png().toFile(root+'/'+file);
const row={file,state:s,variant:'b',roof:'muted clay tile',shape:'original barn registered',wall:'diagonal braced timber',prompt:prompts[s],ref:['native/b/base.png'],nativeOutput:'native/b/'+s+'.png'};
if(s==='snow'){coverage=100*sp/rp;Object.assign(row,{roofMask:'records/masks/b-roof.png',snowMask:'records/masks/b-snow.png',roofPixels:rp,snowPixels:sp,coveragePercent:coverage});await sharp(snow,{raw:{width:160,height:144,channels:4}}).png().toFile(root+'/records/masks/b-snow.png');}
rows.push(row);
}
fs.writeFileSync(root+'/records/b.json',JSON.stringify({assets:rows,registration:{nativeCrop:[230,21,874,1093],targetRect:[31,3,99,126],referenceAlphaThreshold:64,anchor:[80,128]},qa:{snowCoveragePercent:coverage,snowPass:coverage>=60&&coverage<=80}},null,2));
const c=createCanvas(1120,180),ctx=c.getContext('2d');ctx.fillStyle='#92927d';ctx.fillRect(0,0,1120,180);let k=0;
for(const row of rows){const b=await loadImage(root+'/assets/granary_b-v1.png');ctx.drawImage(b,k*160,20);if(row.state!=='base')ctx.drawImage(await loadImage(root+'/'+row.file),k*160,20);ctx.fillStyle='black';ctx.font='12px sans-serif';ctx.fillText(row.state,k*160+50,175);k++;}
fs.writeFileSync(root+'/native/b/actual-size-composites.png',c.toBuffer('image/png'));console.log({coverage});
})();
