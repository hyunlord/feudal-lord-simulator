const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=path.resolve(__dirname,'..');
(async()=>{const rows=JSON.parse(fs.readFileSync(path.join(base,'records/rework-ch5_events-sources.json'))),meta=[],contact=[];
for(const [i,r] of rows.entries()){
const rawFile='raw/rework-ch5_events/'+r.id+'-v1.png',file='assets/ch5_events/'+r.id+'.png';fs.copyFileSync(r.source,path.join(base,rawFile));
let selected=r.source; if(r.edit){const editRaw='raw/rework-ch5_events/'+r.id+'-v2.png';fs.copyFileSync(r.edit.source,path.join(base,editRaw));selected=r.edit.source;}
await sharp(selected).resize(960,540,{fit:'cover'}).ensureAlpha().png().toFile(path.join(base,file));
meta.push({id:r.id,file,width:960,height:540,description:r.composition,historyNotes:'잉글랜드 남부1400–1450. 단일장면 재구성; 빈문서·가상인장·무굴뚝. 표식·홉·유혈·문자 금지.',generationRecords:[{prompt:r.prompt,rawFile,referenceImages:['references/previous/'+r.id+'.png'],tool:'image_gen.imagegen',model:null,seed:null}],processing:'Full imagegen composition redraw; targeted correction where recorded; Sharp centre-cover resize960x540 and RGBA PNG.',qa:{status:'pass_visual',review:'Six finals inspected at target size and contact; distinctive scene silhouettes and no visible lettering or domestic stacks.'},sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(base,file))).digest('hex')});
if(r.edit)meta[meta.length-1].generationRecords.push({prompt:r.edit.prompt,rawFile:'raw/rework-ch5_events/'+r.id+'-v2.png',referenceImages:[rawFile],tool:'image_gen.imagegen',model:null,seed:null});
contact.push({input:await sharp(path.join(base,file)).resize(480,270).png().toBuffer(),left:i%2*480,top:Math.floor(i/2)*270});
}
await sharp({create:{width:960,height:Math.ceil(rows.length/2)*270,channels:4,background:'#ded8cc'}}).composite(contact).png().toFile(path.join(base,'raw/rework-ch5_events/contact.png'));
fs.writeFileSync(path.join(base,'records/metadata-rework-ch5_events.json'),JSON.stringify(meta,null,2)+'\n');})();
