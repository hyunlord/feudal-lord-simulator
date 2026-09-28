const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=path.resolve('output/astra-lineage-prod1-costume-v2');
const inputs=JSON.parse(fs.readFileSync(base+'/records/input-children.json'));
const progress=JSON.parse(fs.readFileSync(base+'/records/children-progress.json'));
const rawRoot='/Users/rexxa/feudal-lord-analysis/astra-raw/lineage-prod1-costume-v2/children';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const records=[],tiles=[];
 for(let i=0;i<inputs.length;i++){
  const a=inputs[i],p=progress.find(x=>x.id===a.id),source=path.resolve('output/astra-lineage-prod1-v1',a.file),rawFile=rawRoot+'/'+a.id+'-attempt1.png',out=base+'/'+a.file;
  fs.copyFileSync(p.generated,rawFile);
  await sharp(rawFile).resize(256,256).ensureAlpha().png({palette:false}).toFile(out);
  const m=await sharp(rawFile).metadata();
  records.push({id:a.id,file:a.file,source,sourceSHA256:hash(source),clothing:a.stage==='baby'?'Fine muted '+(i%2?'purple':'blue')+' wool swaddle with subtle outer fur edging; existing linen infant bonnet preserved':'Fine muted '+(i%2?'purple':'blue')+' wool child garment with subtle fur collar; uncovered original hair and linen neckline',prompt:p.prompt,referenceImages:[source],rawFile,tool:'image_gen.imagegen',model:null,seed:null,originalWidth:m.width,originalHeight:m.height,processing:'Sharp resize to 256x256, ensureAlpha(), non-paletted RGBA PNG; opaque alpha added without changing decoded RGB; no repaint, crop, face masking, recolor or compositing of final assets',qa:{status:'candidate_artist_review_complete_independent_review_pending',clothingReview:'Muted blue/purple wool and subtle fur present; no adult accessories on babies; no veils on girls',identityReview:'Face, identifying marks, hair, pose and age visually compared to source; generative editing is not pixel-exact preservation',ageReview:a.stage==='baby'?'Original infant anatomy and swaddle/bonnet maintained':'Original primary-school child face and narrow shoulders maintained',review96:'pending'},sha256:hash(out)});
  for(let j=0;j<2;j++) tiles.push({input:await sharp(j?out:source).resize(96,96).png().toBuffer(),left:(i%4)*208+j*100,top:Math.floor(i/4)*124+24});
 }
 await sharp({create:{width:832,height:496,channels:3,background:'#ddd5c4'}}).composite(tiles).png().toFile(rawRoot+'/children-before-after-96.png');
 fs.writeFileSync(base+'/records/children.json',JSON.stringify(records,null,2)+'\n');
 console.log(JSON.stringify({count:records.length,unique:new Set(records.map(x=>x.id)).size,dimensions:'256x256',rawCount:fs.readdirSync(rawRoot).filter(x=>x.endsWith('-attempt1.png')).length,board:rawRoot+'/children-before-after-96.png'}));
})();
