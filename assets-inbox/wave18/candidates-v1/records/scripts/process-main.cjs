const fs=require('fs'),path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
const jobs=JSON.parse(fs.readFileSync(path.join(root,'records/jobs-main.json'),'utf8'));let metadata=[];
for(const j of jobs){
const raw=path.join(root,'raw/main',j.id+'.png');fs.copyFileSync(j.source,raw);
const im=sharp(raw); const m=await im.metadata();const {data,info}=await im.ensureAlpha().raw().toBuffer({resolveWithObject:true});let minx=info.width,miny=info.height,maxx=-1,maxy=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){minx=Math.min(minx,x);miny=Math.min(miny,y);maxx=Math.max(maxx,x);maxy=Math.max(maxy,y);}
if(maxx<0)throw Error('empty '+j.id);
const fitted=await sharp(raw).extract({left:minx,top:miny,width:maxx-minx+1,height:maxy-miny+1}).resize(84,84,{fit:'contain',kernel:'lanczos3',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
const dest=path.join(root,'assets/main',j.id+'.png');
await sharp(fitted).extend({top:6,bottom:6,left:6,right:6,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(dest);
const actual=await sharp(dest).metadata(); if(actual.width!==96||actual.height!==96||!actual.hasAlpha)throw Error('Invalid final dimensions/alpha '+j.id);
metadata.push({id:j.id,file:'assets/main/'+j.id+'.png',width:96,height:96,sceneDescription:j.subject,characters:j.id==='pill_population'?'two simplified civilian bust symbols':'none',historyNotes:'Candidate. Project-owned UI P0 style references. No game installation.',generationRecords:[{tool:'image_gen.imagegen',prompt:j.prompt,rawFile:'raw/main/'+j.id+'.png',referenceImages:j.refs,model:'not supplied by tool',seed:'not supplied by tool',rawWidth:m.width,rawHeight:m.height}],processing:'Preserved generated alpha; alpha > 8 bounding box crop; aspect-preserving Lanczos3 fit within 84 px and transparent padding to 96x96.',qa:{status:'pending visual review'}});
}
fs.writeFileSync(path.join(root,'records/metadata-main.json'),JSON.stringify(metadata,null,2));
const canvas=createCanvas(660,310),ctx=canvas.getContext('2d');ctx.fillStyle='#dfceb0';ctx.fillRect(0,0,660,310);ctx.font='12px sans-serif';ctx.fillStyle='#30251d';
for(let i=0;i<jobs.length;i++){let img=await loadImage(path.join(root,'assets/main',jobs[i].id+'.png'));for(let r=0;r<3;r++){const size=[24,32,48][r];ctx.drawImage(img,30+i*105+(48-size)/2,40+r*85,size,size);}ctx.fillText(jobs[i].id.replace('dock_','').replace('pill_',''),12+i*105,20);}
fs.writeFileSync(path.join(root,'raw/main/contact-main.png'),canvas.toBuffer('image/png'));
console.log(JSON.stringify(metadata.map(m=>({id:m.id,raw:m.generationRecords[0].rawWidth,size:[m.width,m.height]}))));
})();
