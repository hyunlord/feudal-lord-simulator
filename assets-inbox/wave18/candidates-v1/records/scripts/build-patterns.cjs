const fs = require('node:fs');
const path = require('node:path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base = path.resolve(__dirname, '..');
const sources = JSON.parse(fs.readFileSync(path.join(base, 'records/pattern-sources.json')));
const mod = (v,n) => ((v%n)+n)%n;
const dist = (v,n) => Math.min(mod(v,n),n-mod(v,n));
const clamp = v => Math.max(0,Math.min(1,v));
const metadata = [];
const patterns = [];
(async () => {
for (const [index,s] of sources.entries()) {
  const rawFile = `raw/patterns/${s.id}-generated.png`;
  fs.copyFileSync(s.source,path.join(base,rawFile));
  fs.writeFileSync(path.join(base,`raw/patterns/${s.id}-prompt.txt`),s.prompt+'\n');
  const raw = await sharp(s.source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const ink=[];
  for(let i=0;i<raw.data.length;i+=4) if(raw.data[i+3]>200 && raw.data[i]<150 && raw.data[i+1]<130) ink.push([raw.data[i],raw.data[i+1],raw.data[i+2]]);
  if(!ink.length) throw Error('No generated ink pixels');
  const average=[0,1,2].map(c=>Math.round(ink.reduce((a,p)=>a+p[c],0)/ink.length));
  const w=index===3?128:64,h=index===3?16:32;
  const data=Buffer.alloc(w*h*4);
  const coverage=(x,y) => {
    if(index===0) return clamp((1.28-Math.hypot(dist(x-4,8),dist(y-4,8)))*2);
    if(index===1) return clamp((1.02-dist(x+y-2,8)/Math.SQRT2)*2);
    if(index===2) return Math.max(clamp((0.87-dist(x+y-2,8)/Math.SQRT2)*2),clamp((0.87-dist(x-y-2,8)/Math.SQRT2)*2));
    return clamp((1.5-Math.hypot(Math.max(0,dist(x-8,16)-3),y-8))*2);
  };
  for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
    const p=(y*w+x)*4;
    if(index<3 && Math.abs(x+.5-32)/32+Math.abs(y+.5-16)/16>1) continue;
    const grain=ink[(mod(y,8)*8+mod(x,8))*137%ink.length];
    for(let c=0;c<3;c++) data[p+c]=Math.round(average[c]*.92+grain[c]*.08);
    data[p+3]=Math.round(coverage(x+.5,y+.5)*(index===0?165:225));
  }
  const file=`assets/patterns/${s.id}.png`;
  await sharp(data,{raw:{width:w,height:h,channels:4}}).png().toFile(path.join(base,file));
  const alphas=Array.from({length:w*h},(_,i)=>data[i*4+3]);
  let periodFailures=0;
  for(let y=-32;y<32;y++) for(let x=-32;x<32;x++) if(index<3 && (Math.abs(coverage(x+.5,y+.5)-coverage(x+32.5,y+16.5))>1e-8 || Math.abs(coverage(x+.5,y+.5)-coverage(x-31.5,y+16.5))>1e-8)) periodFailures++;
  if(periodFailures)throw Error('Lattice mismatch');
  const slopeErrors = {};
  for(const [name,dx,dy] of [['diagonalDown',1,1],['diagonalUp',1,-1],['horizontal',1,0]]) {
    let error=0;
    if(index<3) for(let y=8;y<24;y++)for(let x=24;x<40;x++) error+=Math.abs(data[(y*w+x)*4+3]-data[((y+dy)*w+x+dx)*4+3]);
    if(index<3)slopeErrors[name]=error/256;
  }
  const qa={alphaMin:Math.min(...alphas),alphaMax:Math.max(...alphas),meanAlpha:alphas.reduce((a,b)=>a+b,0)/alphas.length,nonzeroPixels:alphas.filter(a=>a>0).length,inkRGB:average,periodFailures,slopeErrors,grayscaleShape:index===0?'isolated circular dots':index===1?'one diagonal line family':index===2?'two crossing diagonal line families':'separated horizontal dashes',outsideDiamondAlphaZero:true};
  patterns.push({id:s.id,data,w,h});
  metadata.push({id:s.id,file,width:w,height:h,sceneDescription:qa.grayscaleShape,characters:'none',historyNotes:'Original generated texture retained; exact periodic production geometry reconstructed from generated ink colour and brush grain to enforce tiling.',generationRecords:[{tool:'image_gen.imagegen',prompt:s.prompt,rawFile,referenceImages:['references/icon_layer_mode_sheet.png'],model:'not provided by tool',seed:'not provided by tool'}],processing:{method:'Sharp RGBA raster assembly, no Python. Generated ink pixels provide colour and subtle periodic grain; exact analytical masks provide tile-safe geometry and transparency.',alphaUsage:'Transparent between ink marks and outside diamond. Draw with source-over or multiply over a separate coloured placement fill; do not replace alpha with opaque diamond fill.',lattice:index===3?'Horizontal repeat (128,0), internal dash period 16px':'Isometric translation basis (32,16),(-32,16); screen-space texture period 8px; top vertex (32,0), right (64,16), bottom (32,32), left (0,16).'},qa});
}
const proofW=768,proofH=240;
const proof=Buffer.alloc(proofW*proofH*4);
for(let i=0;i<proof.length;i+=4){proof[i]=218;proof[i+1]=218;proof[i+2]=218;proof[i+3]=255;}
for(let k=0;k<3;k++)for(let a=0;a<3;a++)for(let b=0;b<3;b++){
 const p=patterns[k],ox=k*256+96+(a-b)*32,oy=24+(a+b)*16;
 for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){
 const si=(y*p.w+x)*4,di=((oy+y)*proofW+ox+x)*4,alpha=p.data[si+3]/255;
 const gray=Math.round(.2126*p.data[si]+.7152*p.data[si+1]+.0722*p.data[si+2]);
 for(let c=0;c<3;c++)proof[di+c]=Math.round(proof[di+c]*(1-alpha)+gray*alpha);
 }
}
const p=patterns[3];for(let n=0;n<5;n++)for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){
 const si=(y*p.w+x)*4,di=((190+y)*proofW+64+n*128+x)*4,alpha=p.data[si+3]/255;
 const gray=Math.round(.2126*p.data[si]+.7152*p.data[si+1]+.0722*p.data[si+2]);
 for(let c=0;c<3;c++)proof[di+c]=Math.round(proof[di+c]*(1-alpha)+gray*alpha);
}
await sharp(proof,{raw:{width:proofW,height:proofH,channels:4}}).png().toFile(path.join(base,'raw/patterns/patterns-3x3-grayscale-proof.png'));
fs.writeFileSync(path.join(base,'records/metadata-patterns.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify(metadata.map(m=>({id:m.id,qa:m.qa})),null,2));
})();
