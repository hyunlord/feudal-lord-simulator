const fs = require('node:fs');
const path = require('node:path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const seasons = ['summer','autumn','winter'];
async function main() {
  const rows=[];
  for (const [family,w,h] of [['skep_row',96,64],['boundary_stone',48,64]]) {
    const inputs=[];
    for (const season of seasons) {
      const id=family+'_'+season;
      const file=path.join(root,'native/smallprops',id+'.png');
      const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      let x0=info.width,y0=info.height,x1=-1,y1=-1;
      for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
      if(x1<0)throw new Error('Empty '+id);
      inputs.push({id,season,file,info,box:{left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}});
    }
    for(const item of inputs){
      const scale=Math.min((w-8)/item.box.width,(h-8)/item.box.height);
      const rw=Math.round(item.box.width*scale),rh=Math.round(item.box.height*scale);
      const left=Math.floor((w-rw)/2),top=h-4-rh;
      const png=await sharp(item.file).extract(item.box).resize(rw,rh,{kernel:'lanczos3'}).toBuffer();
      const output=path.join(root,'assets',item.id+'.png');
      await sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:png,left,top}]).png().toFile(output);
      rows.push({id:item.id,season:item.season,file:path.relative(root,output),status:'candidate',native:'native/smallprops/'+item.id+'.png',nativeSize:[item.info.width,item.info.height],canvas:[w,h],width:w,height:h,pivot:{x:w/2,y:h-4},anchor:[w/2,h-4],crop:item.box,scale,resized:[rw,rh],offset:[left,top],transforms:['alpha > 8 bounding box','aspect-preserving Lanczos3 downsample','bottom-center placement on transparent RGBA canvas'],limitations:['Generated seasonal edits preserve intended geometry; exact pixel-identical silhouettes are not asserted.','Offline candidate QA only; no game installation.']});
    }
  }
  const sources=JSON.parse(fs.readFileSync(path.join(root,'native/smallprops/generation-sources.json'),'utf8'));
  for(const row of rows){
    row.prompt=fs.readFileSync(path.join(root,'native/smallprops',row.id+'-prompt.txt'),'utf8').trim();
    row.promptFile='native/smallprops/'+row.id+'-prompt.txt';
    row.sourceGeneratedPath=sources[row.id];
    row.references=row.season==='summer'?['references/Wave15_사계절.jpg','references/Wave23_규격.jpg']:['native/smallprops/'+row.id.replace(/_(autumn|winter)$/,'_summer')+'.png'];
    row.generation={tool:'built-in image_gen.imagegen',callsForAsset:1,model:null,seed:null};
    row.review={actualSizeBoard:'native/smallprops/actual-size-qa.png',visual:'PASS: three straw skeps on low plank; rough uncarved stone; muted seasons; no visible glow on green background',geometry:'Common canvas and bottom-center ground pivot; seasonal edits have small organic detail differences, not pixel-identical silhouettes.'};
    row.supersededConcept={file:'native/smallprops/superseded-sheet.png',prompt:'native/smallprops/prompt.txt',status:'not used for final assets'};
  }
  fs.writeFileSync(path.join(root,'records/smallprops.json'),JSON.stringify(rows,null,2)+'\n');
  console.log(JSON.stringify(rows));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
