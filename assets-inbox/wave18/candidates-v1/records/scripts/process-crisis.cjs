const fs=require('fs');
const path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
 const records=JSON.parse(fs.readFileSync(path.join(root,'records/metadata-crisis.json')));
 let comps=[];
 for(let i=0;i<records.length;i++){
  const r=records[i]; const raw=path.join(root,r.generationRecords[0].rawFile);
  const crop=await sharp(raw).trim().resize(82,82,{fit:'inside'}).png().toBuffer();
  await sharp(crop).resize(96,96,{fit:'contain',background:'#00000000',withoutEnlargement:true}).ensureAlpha().png().toFile(path.join(root,r.file));
  const meta=await sharp(path.join(root,r.file)).metadata(); const stats=await sharp(path.join(root,r.file)).stats();
  r.qa={status:'candidate',dimensions:meta.width+'x'+meta.height,hasAlpha:meta.hasAlpha,alphaMin:stats.channels[3].min,alphaMax:stats.channels[3].max,visualReview:'pending'};
  for(let j=0;j<3;j++) {const size=[24,32,48][j]; comps.push({input:await sharp(path.join(root,r.file)).resize(size,size).png().toBuffer(),left:i*110+Math.floor((110-size)/2),top:j*80+20});}
 }
 await sharp({create:{width:660,height:240,channels:4,background:'#e7ddc6'}}).composite(comps).png().toFile(path.join(root,'proofs/crisis-size-contact.png'));
 fs.writeFileSync(path.join(root,'records/metadata-crisis.json'),JSON.stringify(records,null,2));
})();
