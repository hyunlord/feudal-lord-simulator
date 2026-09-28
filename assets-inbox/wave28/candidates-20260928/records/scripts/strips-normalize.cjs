const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
const rows = JSON.parse(fs.readFileSync(path.join(root, 'native/strips/generation.json')));
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function main() {
 const records = [];
 const panels = [];
 for (const row of rows) {
  const key = row.id + '_' + row.season;
  const native = 'native/strips/' + key + '.png';
  const nativePath = path.join(root, native);
  if (!fs.existsSync(nativePath)) fs.copyFileSync(row.path, nativePath);
  const metadata = await sharp(nativePath).metadata();
  const raw = await sharp(nativePath).ensureAlpha().raw().toBuffer();
  let top = metadata.height, bottom = -1;
  for (let y=0; y<metadata.height; y++) for(let x=0; x<metadata.width; x++) if(raw[(y*metadata.width+x)*4+3]>8) { top=Math.min(top,y); bottom=Math.max(bottom,y); }
  if(bottom<top) throw Error('Empty alpha: '+key);
  const height = Math.min(52, Math.round((bottom-top+1)*512/metadata.width));
  const sprite = await sharp(nativePath).extract({left:0,top,width:metadata.width,height:bottom-top+1}).resize(512,height,{fit:'fill'}).png().toBuffer();
  const buf = await sharp({create:{width:512,height:64,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,left:0,top:56-height}]).raw().toBuffer();
  const before = Buffer.from(buf);
  // Pair opposite edge samples with decreasing weight across eight pixels.
  for(let y=0;y<64;y++) for(let d=0;d<8;d++) {
   const a=(y*512+d)*4, b=(y*512+511-d)*4, w=(8-d)/8;
   for(let c=0;c<4;c++) { const avg=(before[a+c]+before[b+c])/2; buf[a+c]=Math.round(before[a+c]*(1-w)+avg*w);buf[b+c]=Math.round(before[b+c]*(1-w)+avg*w); }
  }
  const file='assets/'+key+'.png';
  await sharp(buf,{raw:{width:512,height:64,channels:4}}).png().toFile(path.join(root,file));
  let max=0,mismatches=0,transparent=0,partial=0;
  for(let y=0;y<64;y++) for(let c=0;c<4;c++) {const diff=Math.abs(buf[y*512*4+c]-buf[(y*512+511)*4+c]);max=Math.max(max,diff);if(diff)mismatches++;}
  for(let p=3;p<buf.length;p+=4){if(buf[p]===0)transparent++;else if(buf[p]<255)partial++;}
  records.push({id:key,family:row.id,season:row.season,file,width:512,height:64,pivot:{x:256,y:56},status:'candidate',native,prompt:row.prompt,references:row.season==='summer'?['references/Wave23_규격.jpg']:['native/strips/'+row.id+'_summer.png'],generation:{tool:'builtin image_gen',calls:1,model:'not provided',seed:'not provided',original_path:row.path},native_dimensions:{width:metadata.width,height:metadata.height},native_sha256:hash(nativePath),sha256:hash(path.join(root,file)),processing:{alpha:'Generated alpha preserved, resized and pair-blended at seam',crop:{left:0,top,width:metadata.width,height:bottom-top+1},resize:{width:512,height},placement:{left:0,top:56-height},baseline:56,seam:'8-pixel opposing-edge weighted average on all RGBA channels, edge weight 1'},qa:{x_edge_max_rgba_difference:max,x_edge_mismatched_channels:mismatches,transparent_pixels:transparent,partial_alpha_pixels:partial,repeat_review:'native/strips/repeat-x3.png',limitations:row.id.startsWith('hedgerow')&&row.season==='winter'?'Frosted dense branch silhouette; fine bare-twig openness is subdued at final scale.':'Offline candidate only; runtime placement untested.'}});
  for(let n=0;n<3;n++) panels.push({input:path.join(root,file),left:n*512,top:records.length*72-72});
 }
 await sharp({create:{width:1536,height:rows.length*72,channels:4,background:'#74785b'}}).composite(panels).png().toFile(path.join(root,'native/strips/repeat-x3.png'));
 fs.writeFileSync(path.join(root,'records/strips.json'),JSON.stringify({builtin_calls:12,assets:records},null,2)+'\n');
 console.log(JSON.stringify(records.map(r=>({id:r.id,native:r.native_dimensions,crop:r.processing.crop,qa:r.qa}))));
}
main().catch(e=>{console.error(e);process.exit(1);});
