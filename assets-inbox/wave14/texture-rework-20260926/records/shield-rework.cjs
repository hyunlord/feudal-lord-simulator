const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),refs=path.join(root,'references/original-wave14'),her=path.join(refs,'heraldry');
const raw=async f=>sharp(f).ensureAlpha().raw().toBuffer();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function sample(b,x,y){x=Math.max(0,Math.min(255,x));y=Math.max(0,Math.min(255,y));const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(255,x0+1),y1=Math.min(255,y0+1),fx=x-x0,fy=y-y0;return (b[(y0*256+x0)*4]*(1-fx)+b[(y0*256+x1)*4]*fx)*(1-fy)+(b[(y1*256+x0)*4]*(1-fx)+b[(y1*256+x1)*4]*fx)*fy;}
(async()=>{
const metadata=[];
for(const mode of ['multiply','screen']){
 const input=path.join(root,'raw/shield-'+mode+'.png'),file='assets/shield_surface_texture_'+mode+'.png';
 const img=await sharp(input).resize(256,256).greyscale().toColourspace('srgb').ensureAlpha().png().toBuffer();fs.writeFileSync(path.join(root,file),img);
 metadata.push({id:'shield_surface_texture_'+mode,file,width:256,height:256,status:'candidate',role:mode+' surface texture',blendContract:{mode,strength:mode==='screen'?.48:.80,neutral:mode==='screen'?'black':'white',space:'sRGB',mapping:'normalized fill row UV',clip:'fill; preserve outline/alpha',order:mode==='screen'?2:1},generationRecords:[{tool:'builtin image_gen',prompt:fs.readFileSync(path.join(root,'prompts/shield-'+mode+'.txt'),'utf8'),rawFile:'raw/shield-'+mode+'.png',referenceImages:['references/house_l3-v2.png'],model:'not supplied',seed:'not supplied'}],processing:{resize:'256x256 lanczos3',color:'neutral grayscale RGBA opaque blend data; white multiply neutral / black screen neutral',mapping:'normalized fill row UV; see SHIELD_TEXTURE_COMPOSITION.md'},qa:{}});
}
const mul=await raw(path.join(root,metadata[0].file)),scr=await raw(path.join(root,metadata[1].file)),old=await raw(path.join(her,'shield_surface_texture.png')),chiefMask=await raw(path.join(her,'ordinary_chief.png'));
const manifest=JSON.parse(fs.readFileSync(path.join(refs,'heraldry-combinations.json'))),images=[],deltas=[];
fs.mkdirSync(path.join(__dirname,'heraldry-textured'),{recursive:true});
const compare=createCanvas(1536,850),cc=compare.getContext('2d');cc.fillStyle='#e8ddc5';cc.fillRect(0,0,1536,850);cc.fillStyle='#33291e';cc.font='24px sans-serif';cc.fillText('Before / new multiply + screen · same masks and colors',24,36);
for(const item of manifest.combinations){
 const s=await raw(path.join(her,'shield_'+item.shield+'.png')),p=await raw(path.join(her,'partition_'+item.partition+'.png'));
 const charge=await sharp(path.join(refs,'charges',item.charge)).resize(116,116,{fit:'contain'}).extend({left:70,right:70,top:77,bottom:63,background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer();
 const bounds=[];let ymin=255,ymax=0;
 for(let y=0;y<256;y++){let l=256,r=-1;for(let x=0;x<256;x++){let i=(y*256+x)*4;if(s[i]>127&&s[i+3]>127){l=Math.min(l,x);r=x;}}bounds[y]=[l,r];if(r>=l){ymin=Math.min(ymin,y);ymax=y;}}
 const out=Buffer.alloc(s.length),before=Buffer.alloc(s.length);let sum=0,count=0,alphaMismatch=0,edgeChange=0,edgeN=0;
 for(let i=0;i<s.length;i+=4){const x=i/4%256,y=Math.floor(i/4/256),a=s[i+3]/255,fill=a*s[i]/255,outline=a-fill,m=p[i+3]/255,ca=charge[i+3]/255,ch=item.ordinary?chiefMask[i+3]/255:0;
 let rgb=item.fieldColors[0].map((c,k)=>(c*(1-m)+item.fieldColors[1][k]*m)*(1-ca)+item.chargeMetal[k]*ca);rgb=rgb.map((c,k)=>c*(1-ch)+item.chargeMetal[k]*ch);
 const [l,r]=bounds[y],u=r>l?(x-l)/(r-l):0.5,v=(y-ymin)/Math.max(1,ymax-ymin);
 // A shared UV domain lets generated edge abrasion follow all three shield shapes.
 // sRGB blend contract: multiply strength .80, screen strength .48. Alpha is original silhouette.
 const mt=sample(mul,u*255,v*255)/255,st=sample(scr,u*255,v*255)/255;
 for(let k=0;k<3;k++){const flat=rgb[k],dark=flat*(.20+.80*mt),lit=255-(255-dark)*(1-.48*st);out[i+k]=a?Math.round((lit*fill+18*outline)/a):0;const ot=old[i+3]/255;before[i+k]=a?Math.round(((flat*(1-ot)+old[i]*ot)*fill+18*outline)/a):0;if(fill>.98){sum+=Math.abs(out[i+k]-before[i+k]);count++;if(u<.08||u>.92||v<.08||v>.92){edgeChange+=Math.abs(out[i+k]-before[i+k]);edgeN++;}}}
 out[i+3]=before[i+3]=s[i+3];if(out[i+3]!==s[i+3])alphaMismatch++;
 }
 const png=await sharp(out,{raw:{width:256,height:256,channels:4}}).png().toBuffer();images.push(png);fs.writeFileSync(path.join(__dirname,'heraldry-textured',String(item.index).padStart(2,'0')+'.png'),png);
 const small=await sharp(out,{raw:{width:256,height:256,channels:4}}).resize(96,96).raw().toBuffer(),smallBefore=await sharp(before,{raw:{width:256,height:256,channels:4}}).resize(96,96).raw().toBuffer();let sum96=0,n96=0;for(let k=0;k<small.length;k+=4)if(small[k+3]>250){for(let c=0;c<3;c++){sum96+=Math.abs(small[k+c]-smallBefore[k+c]);n96++;}}
 deltas.push({index:item.index,meanAbsoluteRGBDelta:sum/count,meanAbsoluteRGBDeltaAt96:sum96/n96,edgeMeanAbsoluteRGBDelta:edgeChange/edgeN,alphaMismatch,sha256:sha(png)});
 if(item.index<=6){const bi=await sharp(before,{raw:{width:256,height:256,channels:4}}).png().toBuffer(),col=(item.index-1)%3,row=Math.floor((item.index-1)/3),xx=col*512,yy=55+row*390;cc.drawImage(await loadImage(bi),xx,yy);cc.drawImage(await loadImage(png),xx+256,yy);cc.drawImage(await loadImage(bi),xx+68,yy+270,96,96);cc.drawImage(await loadImage(png),xx+324,yy+270,96,96);}
}
fs.writeFileSync(path.join(__dirname,'shield-before-after.png'),compare.toBuffer('image/png'));
const canvas=createCanvas(1728,1880),ctx=canvas.getContext('2d');ctx.fillStyle='#e6dcc5';ctx.fillRect(0,0,1728,1880);ctx.fillStyle='#30281e';ctx.font='bold 28px sans-serif';ctx.fillText('HERALDRY 24 / NEW PAINT TEXTURE / 256px + 96px',24,40);ctx.font='17px sans-serif';ctx.fillText('Original seed 140926 compositions · multiply 0.80 then screen 0.48 · shape-clipped UV',24,69);
for(let n=0;n<24;n++){let x=24+n%6*284,y=96+Math.floor(n/6)*442;ctx.fillStyle=n%2?'#292b2a':'#faf5e9';ctx.fillRect(x,y,272,416);const im=await loadImage(images[n]);ctx.drawImage(im,x+8,y+8);ctx.drawImage(im,x+16,y+282,96,96);ctx.fillStyle=n%2?'#efe4cd':'#34291b';ctx.font='16px sans-serif';ctx.fillText(String(n+1).padStart(2,'0'),x+126,y+320);ctx.font='12px sans-serif';ctx.fillText(manifest.combinations[n].partition,x+118,y+344);}
fs.writeFileSync(path.join(root,'proofs/01-heraldry-textured.png'),canvas.toBuffer('image/png'));
for(const [j,m]of metadata.entries()){const data=j? scr:mul;let alpha=0,value=0;for(let i=0;i<data.length;i+=4){alpha+=data[i+3]/255;value+=data[i];}m.qa={averageAlpha:alpha/(256*256),averageGrayscale:value/(256*256),effectiveBlendFactorMean:j?1-.48*value/(256*256)/255:.20+.80*value/(256*256)/255,blendStrength:j?.48:.80,preservesOriginalSilhouetteAlpha:true,viewedAt:[256,96]};}
fs.writeFileSync(path.join(__dirname,'metadata-shield.json'),JSON.stringify(metadata,null,2));
fs.writeFileSync(path.join(__dirname,'shield-texture-qa.json'),JSON.stringify({combinations:24,originalSeed:manifest.seed,unchangedColorsAndMasks:true,uniqueOutputs:new Set(deltas.map(d=>d.sha256)).size,alphaMismatchTotal:deltas.reduce((n,d)=>n+d.alphaMismatch,0),deltas,assets:metadata.map(m=>({id:m.id,...m.qa}))},null,2));console.log(JSON.stringify({count:24,deltaRange:[Math.min(...deltas.map(d=>d.meanAbsoluteRGBDelta)),Math.max(...deltas.map(d=>d.meanAbsoluteRGBDelta))]}));
})();
