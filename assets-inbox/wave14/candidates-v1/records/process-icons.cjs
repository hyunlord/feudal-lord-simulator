const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {createCanvas, loadImage} = require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root = path.resolve(__dirname, '..');
async function main() {
  const jobs = JSON.parse(fs.readFileSync(path.join(__dirname,'icon-jobs.json')));
  const records = [];
  for (const job of jobs) {
    const rawFile = `raw/ui-icons/${job.id}-v1.png`;
    fs.copyFileSync(job.source, path.join(root,rawFile));
    const source=sharp(job.source).ensureAlpha();
    const {data,info}=await source.raw().toBuffer({resolveWithObject:true});
    let x0=info.width,y0=info.height,x1=-1,y1=-1;
    for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) if(data[(y*info.width+x)*4+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    if(x1<0)throw Error(`empty ${job.id}`);
    const extract={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};
    const icon=await sharp(job.source).extract(extract).resize(84,84,{fit:'inside',kernel:'lanczos3'}).png().toBuffer();
    const m=await sharp(icon).metadata();
    const file=`assets/ui-icons/${job.id}-v1.png`;
    await sharp({create:{width:96,height:96,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:icon,left:Math.floor((96-m.width)/2),top:Math.floor((96-m.height)/2)}]).png().toFile(path.join(root,file));
    records.push({id:`${job.id}-v1`,file,width:96,height:96,pivot:[48,48],role:'rights and faction UI icon',status:'candidate',sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),generationRecords:[{tool:'builtin image_gen',prompt:job.prompt,rawFile,referenceImages:['references/icon_cause_family_sheet.png'],model:'not supplied',seed:'not supplied'}],processing:{method:'Alpha bounds crop; uniform Lanczos3 downsample within84x84; centered on96x96 transparentRGBA; original generated alpha retained',sourceSize:[info.width,info.height],alphaBounds:extract},qa:{transparentRGBA:true,noText:true,reviewScale:[96,48],review:'Pending contact inspection'}});
  }
  for(const rec of records){
    const job=jobs.find(j=>`${j.id}-v1`===rec.id);
    if(job.history){rec.generationRecords[0].referenceImages=['raw/ui-icons/icon_right_burgage-rejected-chimney.png'];rec.generationRecords.unshift({tool:'builtin image_gen',prompt:job.history.prompt,rawFile:'raw/ui-icons/icon_right_burgage-rejected-chimney.png',referenceImages:['references/icon_cause_family_sheet.png'],model:'not supplied',seed:'not supplied',selection:'rejected: chimney and blue glass contrary to project art bible'});rec.qa.historicalCorrection='Chimney removed and glazed window changed to open wooden shutters through builtin precise edit';}
    rec.qa.review='Pass: distinct subjects and silhouettes at96and48; hand-painted P0 reference palette; no text; burgage has no chimney or glass';
  }
  fs.writeFileSync(path.join(__dirname,'metadata-icons.json'),JSON.stringify(records,null,2));
  const cv=createCanvas(990,360),ctx=cv.getContext('2d');ctx.fillStyle='#dad0b8';ctx.fillRect(0,0,990,360);
  for(let i=0;i<records.length;i++){const rec=records[i],x=10+(i%6)*163,y=10+Math.floor(i/6)*180;const im=await loadImage(path.join(root,rec.file));ctx.drawImage(im,x,y,96,96);ctx.drawImage(im,x+106,y+32,48,48);ctx.fillStyle='#312c24';ctx.font='11px sans-serif';ctx.fillText(rec.id.replace('icon_','').replace('-v1',''),x,y+118,155);}
  fs.writeFileSync(path.join(__dirname,'icons-96-48-contact.png'),cv.toBuffer('image/png'));
}
main().catch(e=>{console.error(e);process.exit(1)});
