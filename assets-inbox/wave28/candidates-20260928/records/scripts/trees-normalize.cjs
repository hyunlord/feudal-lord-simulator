const fs = require('fs');
const path = require('path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const recordPath = path.join(root, 'records/trees.json');
const records = JSON.parse(fs.readFileSync(recordPath));
const anchors = {oak_solitary:[720,1030],willow_pollard:[662,1095],roadside_cross:[704,920]};
async function bounds(file) {
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let l=info.width,t=info.height,r=-1,b=-1,zero=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(a===0)zero++;if(a>8){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}}
 return {left:l,top:t,right:r,bottom:b,width:r-l+1,height:b-t+1,transparent_pixels:zero};
}
(async()=>{
 for(const family of Object.keys(anchors)){
  const rows=records.assets.filter(a=>a.family===family);
  const [ax,ay]=anchors[family];const target=rows[0];const bb=[];
  for(const a of rows)bb.push(await bounds(path.join(root,a.native_file)));
  const l=Math.min(...bb.map(b=>b.left))-2,t=Math.min(...bb.map(b=>b.top))-2,r=Math.max(...bb.map(b=>b.right))+2,b=Math.max(...bb.map(b=>b.bottom))+2;
  const scale=Math.min((target.pivot.x-6)/(ax-l),(target.width-target.pivot.x-6)/(r-ax),(target.pivot.y-6)/(ay-t),(target.height-target.pivot.y-5)/(b-ay));
  const crop={left:l,top:t,width:r-l+1,height:b-t+1};
  const rw=Math.round(crop.width*scale),rh=Math.round(crop.height*scale);
  const left=Math.round(target.pivot.x-(ax-l)*scale),top=Math.round(target.pivot.y-(ay-t)*scale);
  for(let i=0;i<rows.length;i++){
   const a=rows[i];const native=path.join(root,a.native_file);const m=await sharp(native).metadata();
   const sprite=await sharp(native).extract(crop).resize(rw,rh,{fit:'fill',kernel:'lanczos3'}).png().toBuffer();
   await sharp({create:{width:a.width,height:a.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,left,top}]).png().toFile(path.join(root,a.file));
   a.source_resolution={width:m.width,height:m.height};a.source_alpha_bounds=bb[i];a.source_ground_anchor={x:ax,y:ay};
   a.transform={method:'Shared family crop and uniform family scale, transparent padding; no painted pixels',crop,scale,resized:{width:rw,height:rh},offset:{x:left,y:top},kernel:'lanczos3'};
   a.output_alpha_bounds=await bounds(path.join(root,a.file));a.qa_status='offline visual inspected; transparent RGBA and size verified';
   a.qa_note='Season edits preserve major structure visually; generated texture pixels are not guaranteed identical. Pivot is a visual authoring anchor, not runtime integration proof.';
   console.log(a.id,JSON.stringify(a.output_alpha_bounds));
  }
 }
 fs.writeFileSync(recordPath,JSON.stringify(records,null,2)+'\n');
})().catch(e=>{console.error(e);process.exit(1);});
