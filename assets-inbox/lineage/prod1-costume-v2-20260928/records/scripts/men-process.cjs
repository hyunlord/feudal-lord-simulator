const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base = path.resolve('output/astra-lineage-prod1-costume-v2');
const rawRoot = '/Users/rexxa/feudal-lord-analysis/astra-raw/lineage-prod1-costume-v2/men';
const prompts = JSON.parse(fs.readFileSync(path.join(base,'records/men-prompts.json')));
const files = JSON.parse(fs.readFileSync(path.join(base,'records/men-generated.json')));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async () => {
 const records=[];
 for (const [i,item] of prompts.entries()) {
  const source=path.resolve('output/astra-lineage-prod1-v1/assets/L4',item.id+'.png');
  const rawFile=path.join(rawRoot,item.id+'-attempt1.png');
  fs.copyFileSync(files[i],rawFile);
  const file='assets/L4/'+item.id+'.png';
  fs.mkdirSync(path.join(base,'assets/L4'),{recursive:true});
  await sharp(rawFile).resize(256,256,{fit:'fill'}).ensureAlpha().png().toFile(path.join(base,file));
  records.push({id:item.id,file,source,sourceSHA256:hash(source),clothing:'Wealthy merchant fine wool in subdued blue or purple, visible brown fur collar and lowered hood; waist accessories constrained by original bust crop',prompt:item.prompt,referenceImages:[source],rawFile,tool:'image_gen.imagegen',model:null,seed:null,processing:'Sharp resize to256x256 and ensureAlpha for RGBA export; no painting, compositing or face restoration',rawDimensions:await sharp(rawFile).metadata().then(m=>({width:m.width,height:m.height,channels:m.channels})),sha256:hash(path.join(base,file)),qa:{status:'pending_visual_review',limitations:['Generated edit is not pixel-identical outside clothing','Belt and purse may be beyond original bust crop; no zoomout allowed']}});
 }
 fs.writeFileSync(path.join(base,'records/men.json'),JSON.stringify(records,null,2)+'\n');
 const composites=[];
 for(const [i,r] of records.entries()){
  composites.push({input:await sharp(r.source).resize(96,96).toBuffer(),left:0,top:i*100});
  composites.push({input:await sharp(path.join(base,r.file)).resize(96,96).toBuffer(),left:100,top:i*100});
 }
 await sharp({create:{width:196,height:1100,channels:3,background:'#ddd6ca'}}).composite(composites).png().toFile(path.join(rawRoot,'men-before-after-96.png'));
 console.log(JSON.stringify({count:records.length,board:path.join(rawRoot,'men-before-after-96.png')}));
})();
