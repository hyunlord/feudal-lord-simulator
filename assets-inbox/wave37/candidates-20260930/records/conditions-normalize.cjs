const fs = require('fs');
const path = require('path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = __dirname;
const source = JSON.parse(fs.readFileSync(path.join(root,'records/conditions-generation.json')));
(async()=>{
 const records=[];
 for(const s of source){
  const rawPath=path.join(root,'raw',s.id+'.png'); fs.mkdirSync(path.dirname(rawPath),{recursive:true}); fs.copyFileSync(s.source,rawPath);
  fs.mkdirSync(path.join(root,'prompts'),{recursive:true}); fs.writeFileSync(path.join(root,'prompts',s.id+'.txt'),s.prompt+'\n');
  const {data,info}=await sharp(rawPath).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=info.width,y0=info.height,x1=0,y1=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){if(data[(y*info.width+x)*4+3]>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
  const crop={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};
  const scale=Math.min((s.width-8)/crop.width,(s.height-10)/crop.height);
  const w=Math.round(crop.width*scale),h=Math.round(crop.height*scale);
  const left=Math.floor((s.width-w)/2); const footLocal=(s.raw_foot[1]-y0)*h/crop.height;
  const top=Math.min(s.height-h-4,Math.max(4,Math.round(s.height-6-footLocal)));
  const resized=await sharp(rawPath).extract(crop).resize(w,h,{fit:'fill',kernel:'lanczos3'}).png().toBuffer();
  const out=path.join(root,'assets',s.id+'.png');fs.mkdirSync(path.dirname(out),{recursive:true});
  await sharp({create:{width:s.width,height:s.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:resized,left,top}]).png().toFile(out);
  records.push({id:s.id,prompt:s.prompt,references:[{path:'references/reference-3.jpg',role:'project-owned Wave27 style reference visually inspected; not uploaded to generation tool'},{path:'references/reference-0.jpg',role:'project-owned scale/style reference visually inspected; not uploaded to generation tool'}],raw_path:'raw/'+s.id+'.png',output_path:'assets/'+s.id+'.png',width:s.width,height:s.height,foot_x:+(left+(s.raw_foot[0]-x0)*w/crop.width).toFixed(2),foot_y:+(top+footLocal).toFixed(2),foot_method:'Visual raw-image selection of lowest physical pot base, bench leg, bucket base, stave/log ground contact, cart shaft ground contact or wheel contact; shadow excluded. Transformed through actual crop/resize.',foot_uncertainty_px:2,raw_foot:s.raw_foot,postprocess:{tool:'Sharp',alpha_bbox_threshold:8,crop,resize:[w,h],offset:[left,top],aspect_preserved:true,mirror:false},tool:'builtin image_gen.imagegen',model_version:null,seed:null,status:'candidate',generation_count:s.id==='condition_prosperous_bench'?2:1,limitations:s.id==='condition_prosperous_bench'?'First weathered paint output rejected and retained separately; clean painted revision selected.':s.id==='condition_newcomer_cart_a'?'Ground anchor uses forward shaft tip; wheel contact is further up-screen.':s.id==='condition_strained_firewood'?'Small pile reads clearly; exact five-log count is partially occluded.':null});
 }
 fs.writeFileSync(path.join(root,'records/conditions.json'),JSON.stringify(records,null,2)+'\n');
 const inputs=await Promise.all(records.map(async(r,i)=>({input:await sharp(path.join(root,r.output_path)).resize(r.width*3,r.height*3,{kernel:'nearest'}).png().toBuffer(),left:(i%4)*400+8,top:Math.floor(i/4)*320+8})));
 await sharp({create:{width:1600,height:640,channels:4,background:'#777568'}}).composite(inputs).png().toFile(path.join(root,'conditions-contact.png'));
 console.log(JSON.stringify(records.map(({id,foot_x,foot_y,width,height})=>({id,foot_x,foot_y,width,height})),null,2));
})();
