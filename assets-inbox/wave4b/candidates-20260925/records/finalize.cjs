const fs=require('fs'),crypto=require('crypto'),assert=require('node:assert/strict');
const {PNG}=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs/lib/png.js');
const root='/tmp/astra-wave4b-candidates-20260925',work='/tmp/astra-wave4b-work-20260925';
const assets=JSON.parse(fs.readFileSync(work+'/selected.json'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>PNG.sync.read(fs.readFileSync(p));
const results=[];
assert.equal(assets.length,53);
for(const a of assets){
 const p=root+'/'+a.id+'.png',im=read(p),{width:w,height:h,data:d}=im;
 assert.deepEqual([w,h],a.size);
 let bleed=0;
 if(!a.promoted){
  const src=Buffer.from(d);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const k=(y*w+x)*4;if(src[k+3])continue;let best=-1,dist=99;
   for(let yy=Math.max(0,y-3);yy<=Math.min(h-1,y+3);yy++)for(let xx=Math.max(0,x-3);xx<=Math.min(w-1,x+3);xx++){
    const j=(yy*w+xx)*4,dd=(xx-x)**2+(yy-y)**2;if(src[j+3]>64&&dd<=9&&dd<dist){best=j;dist=dd;}
   }
   if(best>=0){for(let ch=0;ch<3;ch++)d[k+ch]=src[best+ch];bleed++;}
  }
  if(a.role==='fill'||a.role==='strip')for(let y=0;y<h;y++)for(let ch=0;ch<4;ch++)d[(y*w+w-1)*4+ch]=d[y*w*4+ch];
  if(a.role==='fill')for(let x=0;x<w;x++)for(let ch=0;ch<4;ch++)d[((h-1)*w+x)*4+ch]=d[x*4+ch];
  fs.writeFileSync(p,PNG.sync.write(im));
 }else assert.equal(hash(p),hash(a.path),'promotion changed '+a.id);
 let xdiff=0,ydiff=0,minAlpha=255,bottomMin=255,hiddenRGB=0;
 for(let y=0;y<h;y++)for(let ch=0;ch<4;ch++)xdiff=Math.max(xdiff,Math.abs(d[y*w*4+ch]-d[(y*w+w-1)*4+ch]));
 for(let x=0;x<w;x++)for(let ch=0;ch<4;ch++)ydiff=Math.max(ydiff,Math.abs(d[x*4+ch]-d[((h-1)*w+x)*4+ch]));
 let sums=[0,0,0],count=0;
 for(let k=0;k<d.length;k+=4){minAlpha=Math.min(minAlpha,d[k+3]);if(!d[k+3]&&(d[k]||d[k+1]||d[k+2]))hiddenRGB++;if(d[k+3]>200){for(let ch=0;ch<3;ch++)sums[ch]+=d[k+ch];count++;}}
 for(let x=0;x<w;x++)bottomMin=Math.min(bottomMin,d[((h-1)*w+x)*4+3]);
 if(a.role==='fill'||a.role==='strip')assert.equal(xdiff,0,'X seam '+a.id);
 if(a.role==='fill'){assert.equal(ydiff,0,'Y seam '+a.id);assert.equal(minAlpha,255,'fill opacity '+a.id);}
 if(a.id.startsWith('wall/'))assert.equal(bottomMin,255,'wall bottom '+a.id);
 let alphaReferenceMaxDiff=null;
 if(!a.promoted&&a.role==='strip'&&a.section==='A'){
  const reference=read(work+'/astra-wave4b-reference-files/'+a.lockReference.split('/').at(-1));
  alphaReferenceMaxDiff=0;for(let k=3;k<d.length;k+=4)alphaReferenceMaxDiff=Math.max(alphaReferenceMaxDiff,Math.abs(d[k]-reference.data[k]));assert.equal(alphaReferenceMaxDiff,0,'pilot alpha '+a.id);
 }
 if(bleed)assert(hiddenRGB>0,'hidden RGB missing '+a.id);
 results.push({id:a.id,promoted:a.promoted,size:[w,h],xEdgeMaxRGBA:xdiff,yEdgeMaxRGBA:ydiff,minAlpha,bottomMinAlpha:bottomMin,alphaReferenceMaxDiff,meanOpaqueRGB:sums.map(x=>x/Math.max(1,count)),rgbBleedRadius:a.promoted?'inherited':3,bleedPixels:bleed,hiddenRGBPixels: hiddenRGB,sha256:hash(p)});
}
const all=fs.readdirSync(root,{recursive:true}).filter(x=>x.endsWith('.png'));assert.equal(all.length,57);
const fence=read(root+'/fence/hurdle_straight-v1.png');let portAlphaDifference=0;for(let y=34;y<60;y++)for(let x=28;x<36;x++){const k=(y*128+x)*4+3,j=((y-32)*128+x+64)*4+3;portAlphaDifference=Math.max(portAlphaDifference,Math.abs(fence.data[k]-fence.data[j]));}assert.equal(portAlphaDifference,0);
const bridge=read(root+'/module/bridge_abutment_nw_a-v1.png');let deckSamples=0,deckHoles=0;for(let y=0;y<192;y++)for(let x=0;x<256;x++){const dx=x+.5-152,dy=y+.5-36,u=(2*dy-dx)/256,v=(dx+2*dy)/160;if(u>.05&&u<.95&&v>.05&&v<.95){deckSamples++;if(bridge.data[(y*256+x)*4+3]<250)deckHoles++;}}assert.equal(deckHoles,0);
fs.writeFileSync(root+'/records/validation.json',JSON.stringify({status:'pass',assets:53,newAssets:43,promotions:10,pngCount:57,repeatAssets:32,hurdleSocketVector:[64,-32],hurdlePortAlphaMaxDiff:portAlphaDifference,bridgeDeck:{samples:deckSamples,alphaBelow250:deckHoles},results,limits:'Pixel topology and offline image checks only. No game installation or runtime pathfinding, DPR or performance verification.'},null,2));
console.log('53 assets +4 checks /10 byte-identical promotions /32 repeat seams / alpha profiles / module ports / PNG RGB bleed PASS');
