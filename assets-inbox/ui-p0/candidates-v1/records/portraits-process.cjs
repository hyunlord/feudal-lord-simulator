const fs=require('node:fs');
const path=require('node:path');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
const inputs=JSON.parse(fs.readFileSync(path.join(__dirname,'portraits-input.json'),'utf8'));
const reference='references/portrait-style-P1.png';
fs.copyFileSync(path.resolve(root,'../astra-ui-pilot-candidates-v1/references/astra-ui-pilot-reference-files/04_초상화_화풍_P1.png'),path.join(root,reference));
(async()=>{
 const records=[];
 for(const input of inputs){
  const raw='sources/portraits/steward-'+input.expression+'-raw.png';
  fs.copyFileSync(input.source,path.join(root,raw));
  const im=await loadImage(path.join(root,raw));
  const c=createCanvas(192,192),ctx=c.getContext('2d');
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(im,0,0,192,192);
  const id='ui/advisor_steward_portrait_'+input.expression;
  const file='assets/'+id+'.png';fs.writeFileSync(path.join(root,file),c.toBuffer('image/png'));
  const refs=input.expression==='neutral'?[reference]:['sources/portraits/steward-neutral-raw.png'];
  records.push({id,file,width:192,height:192,status:'candidate',role:'청지기 초상 '+input.expression,generationRecords:[{tool:'image_gen.imagegen',model:null,seed:null,prompt:input.prompt,raw,refs,originalWidth:im.width,originalHeight:im.height}],processing:'Full-square uniform downsample to192×192. No crop, warp, color replacement, or expression compositing.',qa:{identity:'same steward across three expression edits',accessories:'no hat; purse and two keys present',text:'none',alignment:'Manual landmarks in records/portraits-alignment.md; uncertainty ±1 px at192px, not automated face-tracking.',runtime:'not installed'}});
 }
 fs.writeFileSync(path.join(__dirname,'portraits.json'),JSON.stringify(records,null,2));
 const c=createCanvas(576,192),ctx=c.getContext('2d');for(let i=0;i<records.length;i++)ctx.drawImage(await loadImage(path.join(root,records[i].file)),i*192,0);
 fs.writeFileSync(path.join(__dirname,'portraits-inspection.png'),c.toBuffer('image/png'));
 console.log(JSON.stringify(records.map(({id,width,height})=>({id,width,height}))));
})();
