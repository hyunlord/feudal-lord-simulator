const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
async function run() {
  const [root, id, source, destination, sw, sh] = process.argv.slice(2);
  const width = Number(sw), height = Number(sh);
  fs.copyFileSync(source, path.join(root, 'raw', id + '.png'));
  const {data, info} = await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=info.width, y0=info.height, x1=-1, y1=-1;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) if(data[(y*info.width+x)*4+3]>8) {
    x0=Math.min(x0,x); y0=Math.min(y0,y); x1=Math.max(x1,x); y1=Math.max(y1,y);
  }
  if(x1<0) throw new Error('empty generated alpha');
  const crop={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};
  const buffer=await sharp(source).extract(crop).resize(width-4,height-4,{fit:'fill'}).extend({top:2,bottom:2,left:2,right:2,background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer();
  for(let i=0;i<buffer.length;i+=4) if(buffer[i+3]===0) buffer[i]=buffer[i+1]=buffer[i+2]=0;
  const output=path.join(root,destination);fs.mkdirSync(path.dirname(output),{recursive:true});
  await sharp(buffer,{raw:{width,height,channels:4}}).png({compressionLevel:9}).toFile(output);
  console.log(JSON.stringify({id,source,raw:'raw/'+id+'.png',file:destination,width,height,crop,raw_sha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),sha256:crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex'),processing:'alpha>8 bounding box; rectangular resize to specified delivery canvas with 2px transparent perimeter; alpha0 RGB sanitized; no painted content replaced'}));
}
run().catch(e=>{console.error(e);process.exit(1)});
