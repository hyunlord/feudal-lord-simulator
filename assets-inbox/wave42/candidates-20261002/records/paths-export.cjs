const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('/tmp/astra-wave39-work-20260930/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const records = JSON.parse(fs.readFileSync(path.join(__dirname,'paths-generations.json')));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async()=>{
 const metrics=[]; const crops={}; const panels=[];
 for(const r of records){
  const raw=path.join(root,'raw','paths-'+r.id+'.png'); fs.copyFileSync(r.generated_path,raw);
  const {data,info}=await sharp(raw).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const key=r.id.replace(/_(summer|winter)$/,'');
  if(r.id.endsWith('summer')){let top=info.height,bottom=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>32){top=Math.min(top,y);bottom=Math.max(bottom,y);}crops[key]={left:0,top,width:info.width,height:bottom-top+1};}
  const resized=await sharp(raw).extract(crops[key]).resize(512,48,{fit:'fill'}).ensureAlpha().raw().toBuffer();
  const out=Buffer.alloc(512*64*4);
  for(let y=0;y<48;y++)for(let x=0;x<512;x++){const s=(y*512+x)*4,d=((y+8)*512+x)*4;for(let c=0;c<3;c++)out[d+c]=resized[s+c];out[d+3]=Math.round(resized[s+3]*Math.min(1,(y+1)/8,(48-y)/8));}
  for(let y=0;y<64;y++)for(let c=0;c<4;c++){const mean=(out[y*512*4+c]+out[(y*512+511)*4+c])/2;for(let k=0;k<24;k++){const w=(1-k/24)**2;for(const x of [k,511-k]){const i=(y*512+x)*4+c;out[i]=Math.round(out[i]*(1-w)+mean*w);}}}
  for(let i=0;i<out.length;i+=4)if(out[i+3]===0)out.fill(0,i,i+4);
  const relative='assets/paths/'+r.id+'.png',dest=path.join(root,relative);
  await sharp(out,{raw:{width:512,height:64,channels:4}}).png({compressionLevel:9}).toFile(dest);
  const season=r.id.endsWith('winter')?'winter':'summer';
  const fill='/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill/public/assets/'+(season==='summer'?'terrain/grass.png':'wave15/terrain/grass_winter_fill-v1.png');
  const tile=await sharp(fill).extract({left:0,top:0,width:256,height:96}).png().toBuffer();
  const tiled=await sharp({create:{width:1536,height:96,channels:4,background:'#a5a68a'}}).composite(Array.from({length:6},(_,i)=>({input:tile,left:i*256,top:0})).map(p=>p)).png().toBuffer().catch(async()=>await sharp(fill).resize(1536,96).png().toBuffer());
  const repeated=await sharp(tiled).composite([0,512,1024].map(left=>({input:dest,left,top:16}))).jpeg({quality:92}).toBuffer();
  fs.writeFileSync(path.join(root,'proofs','paths-'+r.id+'-repeat.jpg'),repeated);
  panels.push({input:repeated,left:0,top:metrics.length*96});
  let edgeMax=0,marginMax=0;for(let y=0;y<64;y++)for(let c=0;c<4;c++)edgeMax=Math.max(edgeMax,Math.abs(out[y*512*4+c]-out[(y*512+511)*4+c]));for(let y=0;y<64;y++)if(y<8||y>=56)for(let x=0;x<512;x++)marginMax=Math.max(marginMax,out[(y*512+x)*4+3]);
  const dir=r.dir.toUpperCase();
  metrics.push({id:r.id,path:relative,width:512,height:64,channels:4,pivot:[256,32],season,state:r.state,orientation:dir,source_geometry:'unwrapped horizontal UV strip; direction is renderer transform, not diagonal source',ports:[[0,32],[512,32]],repeat_axis:'X',repeat_pitch_uv:512,repeat_pitch_world:dir==='NE'?[256,-128]:[256,128],du:dir==='NE'?[0.5,-0.25]:[0.5,0.25],dv:dir==='NE'?[0.5,0.25]:[-0.5,0.25],core_width_uv:32,connect_rule:'same state+season+direction end to start; clear may connect compatible corner/fork port; other states need transition blend; no flipX',flipX:false,crop:crops[key],endpointRGBAMax:edgeMax,Y8pxAlphaMax:marginMax,sha256:sha(dest)});
  Object.assign(r,{raw_copy:'raw/paths-'+r.id+'.png',raw_sha256:sha(raw),input_sha256:sha(r.input_path),output_sha256:sha(dest),postprocess:'Summer crop shared with corresponding winter; one resize to512x48; Y8 transparent +8 inward fade; X24 endpoint blend; zero RGB at alpha0; no mirrors/rotations'});
 }
 await sharp({create:{width:1536,height:records.length*96,channels:3,background:'#eee4d0'}}).composite(panels).jpeg({quality:90}).toFile(path.join(root,'proofs/paths-all-repeat.jpg'));
 fs.writeFileSync(path.join(__dirname,'paths-generations.json'),JSON.stringify(records,null,2));
 fs.writeFileSync(path.join(__dirname,'paths-metrics.json'),JSON.stringify(metrics,null,2));
 console.log(JSON.stringify({count:metrics.length,allSeamsZero:metrics.every(m=>m.endpointRGBAMax===0),allMarginsZero:metrics.every(m=>m.Y8pxAlphaMax===0)}));
})();
