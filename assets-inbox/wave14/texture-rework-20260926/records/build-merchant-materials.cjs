const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),ref=path.join(root,'references/merchant');
const prompts=JSON.parse(fs.readFileSync(path.join(__dirname,'merchant-prompts.json')));
const combinations=JSON.parse(fs.readFileSync(path.join(ref,'merchant-combinations.json'))).combinations;
const clamp=(v,a=0,b=255)=>Math.max(a,Math.min(b,v));
async function png(raw,w=128,h=128){return sharp(raw,{raw:{width:w,height:h,channels:4}}).png().toBuffer()}
async function main(){
 const inkSrc=await sharp(path.join(root,'raw/merchant/ink-retention.png')).flatten({background:'#fff'}).greyscale().resize(128,128).raw().toBuffer();
 const woodSrc=await sharp(path.join(root,'raw/merchant/carved.png')).flatten({background:'#888'}).greyscale().resize(128,128).raw().toBuffer();
 const ink=Buffer.alloc(128*128*4),wood=Buffer.alloc(ink.length);
 for(let i=0;i<16384;i++){let v=clamp((inkSrc[i]-110)*255/145);v=Math.round(v);ink[i*4]=ink[i*4+1]=ink[i*4+2]=v;ink[i*4+3]=255;wood[i*4]=wood[i*4+1]=wood[i*4+2]=woodSrc[i];wood[i*4+3]=255;}
 await sharp(await png(ink)).toFile(path.join(root,'assets/merchant/merchant_ink_stamp_texture.png'));
 await sharp(await png(wood)).toFile(path.join(root,'assets/merchant/merchant_carved_texture.png'));
 const surfaces=[await sharp(path.join(ref,'grain_sacks.png')).extract({left:424,top:350,width:225,height:225}).resize(128,128).removeAlpha().ensureAlpha().raw().toBuffer(),await sharp(path.join(ref,'house_l0-v3.png')).extract({left:485,top:850,width:48,height:95}).resize(128,128).removeAlpha().ensureAlpha().raw().toBuffer(),await sharp(path.join(ref,'frame_chronicle_page.png')).extract({left:110,top:130,width:256,height:256}).resize(128,128).removeAlpha().ensureAlpha().raw().toBuffer()];
 const c=createCanvas(1840,1290),g=c.getContext('2d');g.fillStyle='#eee5d1';g.fillRect(0,0,c.width,c.height);g.fillStyle='#352a20';g.font='bold 29px sans-serif';g.fillText('MERCHANT MATERIALS / SAME 16 COMBINATIONS',28,42);g.font='17px sans-serif';g.fillText('Ink absorbed into sack and parchment / incised oak grain / 128 px + 48 px below',28,73);
 const final48=[],qa=[],beforeAfter=createCanvas(1160,430),bg=beforeAfter.getContext('2d');bg.fillStyle='#eee5d1';bg.fillRect(0,0,1160,430);bg.font='22px sans-serif';bg.fillStyle='#352a20';bg.fillText('Untextured / textured material comparison (same marks and surfaces)',20,30);
 for(let k=0;k<16;k++){
  const co=combinations[k],mask=new Uint8Array(16384);for(const n of [co.staff,co.branch,co.frame]){const b=await sharp(path.join(ref,`merchant_${n}-v1.png`)).raw().toBuffer();for(let p=0;p<16384;p++)mask[p]=Math.max(mask[p],b[p*4+3]);}
  const x=28+(k%4)*454,y=105+Math.floor(k/4)*282;g.fillStyle='#ddd0b7';g.fillRect(x,y,430,264);g.fillStyle='#352a20';g.font='bold 17px sans-serif';g.fillText(String(k+1).padStart(2,'0'),x+12,y+24);
  const alpha48=[];let changed=0,delta=0,total=0,drop=0;
  for(let material=0;material<3;material++){
   const raw=Buffer.from(surfaces[material]),flat=Buffer.from(raw),maskOut=Buffer.alloc(16384*4);
   const at=(xx,yy)=>xx<0||yy<0||xx>127||yy>127?0:mask[yy*128+xx]/255;
   for(let p=0;p<16384;p++){
    const xx=p%128,yy=Math.floor(p/128),a=mask[p]/255;
    if(material!==1){const retention=ink[p*4]/255;let near=Math.max(at(xx-1,yy),at(xx+1,yy),at(xx,yy-1),at(xx,yy+1));const bleed=Math.max(0,near-a)*.12*retention;const coverage=a*retention*.88+bleed;maskOut[p*4+3]=Math.round(coverage*255);for(let ch=0;ch<3;ch++){raw[p*4+ch]=Math.round(raw[p*4+ch]*(1-coverage*.82));flat[p*4+ch]=Math.round(flat[p*4+ch]*(1-a*.88*.82));}if(material===0&&a>.5){total++;if(retention<.4)drop++;}}
    else {const v=wood[p*4]/255;const edgeNW=Math.max(0,a-at(xx-1,yy-1)),edgeSE=Math.max(0,a-at(xx+1,yy+1));const shade=clamp(.28+.40*v-.24*edgeNW+.65*edgeSE,.14,1.22);maskOut[p*4+3]=mask[p];for(let ch=0;ch<3;ch++){raw[p*4+ch]=Math.round(clamp(raw[p*4+ch]*(1-a+a*shade)));flat[p*4+ch]=Math.round(flat[p*4+ch]*(1-a+a*.47));}}
    for(let ch=0;ch<3;ch++){const d=Math.abs(raw[p*4+ch]-flat[p*4+ch]);delta+=d;if(d>3)changed++;}
   }
   const im=await loadImage(await png(raw));g.drawImage(im,x+10+material*140,y+37);g.drawImage(im,x+50+material*140,y+178,48,48);g.fillStyle='#55432f';g.font='13px sans-serif';g.fillText(['SACK / INK','OAK / INCISED','PARCHMENT / INK'][material],x+10+material*140,y+249);
   if(k===0){const aimg=await loadImage(await png(flat));bg.drawImage(aimg,28+material*370,75,160,160);bg.drawImage(im,201+material*370,75,160,160);bg.fillStyle='#352a20';bg.font='15px sans-serif';bg.fillText(['Sack','Oak','Parchment'][material],28+material*370,264);bg.fillText('Before                 After',28+material*370,289);bg.drawImage(aimg,56+material*370,325,48,48);bg.drawImage(im,229+material*370,325,48,48);}
   if(material===0)alpha48.push(await sharp(await png(maskOut)).resize(48,48).raw().toBuffer());
  }
  final48.push(alpha48[0]);qa.push({index:k+1,changedRGBChannelsAbove3:changed,meanAbsoluteRGBDelta:delta/(16384*3*3),inkDropoutFractionInsideMark:drop/total});
 }
 let min=Infinity,pair=null;for(let a=0;a<16;a++)for(let b=a+1;b<16;b++){let n=0;for(let i=3;i<final48[a].length;i+=4)if(Math.abs(final48[a][i]-final48[b][i])>32)n++;if(n<min){min=n;pair=[a+1,b+1]}}
 g.fillStyle='#352a20';g.font='17px sans-serif';g.fillText('Offline candidate composite using project paintings. Labels are proof annotations only. No game installation.',28,1270);
 fs.writeFileSync(path.join(root,'proofs/02-merchant-materials.png'),c.toBuffer('image/png'));fs.writeFileSync(path.join(root,'records/merchant-before-after.png'),beforeAfter.toBuffer('image/png'));
 const metrics={same16Combinations:true,materials:3,examples:48,minimum48pxAlphaDifferenceAbove32:min,closestPair:pair,combinations:qa,inkRawRejectedReason:'First generated image had max alpha 11/255, mean alpha 0.935/255; regenerated opaque coverage field.',inkCoverageMean:ink.filter((_,i)=>i%4===0).reduce((a,b)=>a+b,0)/16384/255};fs.writeFileSync(path.join(root,'records/merchant-material-qa.json'),JSON.stringify(metrics,null,2));
 const common={width:128,height:128,status:'candidate',pivot:{x:64,y:64},qa:{noText:true,gameInstalled:false,proof:'proofs/02-merchant-materials.png',minimum48pxAlphaDifferenceAbove32:min}};
 const meta=[{...common,id:'merchant_ink_stamp_texture',file:'assets/merchant/merchant_ink_stamp_texture.png',role:'grayscale ink retention data, multiply into merchant alpha mask',generationRecords:[{tool:'builtin image_gen',prompt:prompts.ink,rawFile:'raw/merchant/ink-retention.png',referenceImages:['references/merchant/grain_sacks.png'],model:'not supplied',seed:'not supplied'}],processing:{resize:'128x128 Lanczos3',channels:'R=G=B=retention; A=255 data-domain coverage. White retains ink, black removes it. Do not alpha-over as a square.',contrast:'clamp((generated_luminance-110)*255/145)',composition:'maskAlpha*R/255; tint ink using substrate multiply, optional 1px neighbour bleed with amplitude 0.12, no white RGB compositing.'}}, {...common,id:'merchant_carved_texture',file:'assets/merchant/merchant_carved_texture.png',role:'grayscale incised wood grain shaded height field, clipped to mark',generationRecords:[{tool:'builtin image_gen',prompt:prompts.carved,rawFile:'raw/merchant/carved.png',referenceImages:['references/merchant/house_l0-v3.png'],model:'not supplied',seed:'not supplied'}],processing:{resize:'128x128 Lanczos3',channels:'R=G=B=generated grayscale cut grain; A=255 data-domain coverage. Higher grayscale=lit facet, lower=groove.',composition:'Multiply substrate inside mark by 0.28+0.40*R; clipped 1px NW rim -0.24, SE rim +0.65, bounded 0.14..1.22. No marks outside source coverage. No automatic RGB rectangle.'}}];
 fs.writeFileSync(path.join(root,'records/metadata-merchants.json'),JSON.stringify(meta,null,2));console.log(JSON.stringify(metrics));
}
main().catch(e=>{console.error(e);process.exit(1)});
