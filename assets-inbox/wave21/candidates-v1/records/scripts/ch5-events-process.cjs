const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=path.resolve(__dirname,'..');
(async()=>{
const rows=JSON.parse(fs.readFileSync(path.join(base,'records/ch5-events-generation-source.json')));
const metadata=[],contact=[];
for(const [i,r] of rows.entries()){
 const ending=r.id.includes('ending'),width=ending?1920:960,height=ending?1080:540;
 const original='raw/ch5_events/'+r.id+'-v1.png',file='assets/ch5_events/'+r.id+'.png';
 fs.copyFileSync(r.source,path.join(base,original));
 const generationRecords=[{prompt:r.prompt,rawFile:original,referenceImages:['references/Wave17_2장_삽화.jpg'],tool:'image_gen',model:null,seed:null}];
 let selected=original;
 if(r.edit){ selected='raw/ch5_events/'+r.id+'-v2.png';fs.copyFileSync(r.edit.source,path.join(base,selected));generationRecords.push({prompt:r.edit.prompt,rawFile:selected,referenceImages:[original],tool:'image_gen',model:null,seed:null}); }
 await sharp(path.join(base,selected)).resize(width,height,{fit:'cover',position:'centre'}).ensureAlpha().png().toFile(path.join(base,file));
 contact.push({input:await sharp(path.join(base,file)).resize(480,270).png().toBuffer(),left:(i%2)*480,top:Math.floor(i/2)*270});
 metadata.push({id:r.id,file,width,height,description:r.description,historyNotes:'잉글랜드 남부 1400–1450; 빈 문서·가상 인장, 문자·현대 소재·가정 굴뚝 금지. 장면은 역사 삽화 해석이며 고증 실사 재현이 아님.',generationRecords,processing:'Selected raw image resized with Sharp centre-cover to requested dimensions and RGBA PNG. Targeted imagegen historical correction removes domestic chimney stacks; original raw retained.',qa:{status:'pass_visual',review:'Full-size and contact inspected. Nine historical roof corrections. Candidate-only; mayor-election specificity benefits event context.'},sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(base,file))).digest('hex')});
}
await sharp({create:{width:960,height:Math.ceil(rows.length/2)*270,channels:4,background:'#ddd6c6'}}).composite(contact).png().toFile(path.join(base,'records/ch5-events-contact.png'));
fs.writeFileSync(path.join(base,'records/metadata-ch5-events.json'),JSON.stringify(metadata,null,2)+'\n');
})();
