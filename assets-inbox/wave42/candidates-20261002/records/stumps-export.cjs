const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('/tmp/astra-wave39-work-20260930/node_modules/sharp');
const base = path.resolve(__dirname, '..');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function bounds(data, width, height, threshold = 0) {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > threshold) {
      x0 = Math.min(x0,x); y0 = Math.min(y0,y); x1 = Math.max(x1,x); y1 = Math.max(y1,y);
    }
  }
  if (x1 < 0) throw Error('Empty alpha');
  return {left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};
}
(async () => {
  const rows = JSON.parse(fs.readFileSync(path.join(__dirname,'stumps-generations.json')));
  const measurements = [];
  for (const row of rows) {
    const raw = path.join(base,'raw',row.id+'.png');
    fs.copyFileSync(row.generated_path,raw);
    row.raw_path = path.relative(base,raw); row.raw_sha256 = sha(raw);
    row.inputs = row.references.map(p => ({path:p,sha256:sha(p)}));
    const {data,info} = await sharp(raw).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const crop = bounds(data,info.width,info.height,8);
    const width = row.id.includes('_oak_') ? 70 : 50;
    const height = Math.round(crop.height*width/crop.width);
    const sprite = await sharp(raw).extract(crop).resize(width,height,{kernel:'lanczos3'}).png().toBuffer();
    const output = path.join(base,'assets/stumps',row.id+'.png');
    const left = Math.round(64-width/2), top = 109-height;
    await sharp({create:{width:128,height:128,channels:4,background:'#00000000'}}).composite([{input:sprite,left,top}]).png({compressionLevel:9,palette:false}).toFile(output);
    const final = await sharp(output).ensureAlpha().raw().toBuffer();
    const alpha = Array.from({length:128*128},(_,i)=>final[i*4+3]);
    const bbox = bounds(final,128,128);
    const edgeAlpha = Math.max(...Array.from({length:128},(_,i)=>Math.max(final[i*4+3],final[((127*128)+i)*4+3],final[(i*128)*4+3],final[(i*128+127)*4+3])));
    if (edgeAlpha !== 0 || Math.min(...alpha)!==0 || Math.max(...alpha)!==255) throw Error('Invalid alpha '+row.id);
    row.final_path=path.relative(base,output); row.final_sha256=sha(output);
    row.export={canvas:[128,128],pivot:[64,108],crop,resize:[width,height],placement:[left,top],flip:false,rotation:0,resize_count:1};
    measurements.push({id:row.id,path:row.final_path,sha256:row.final_sha256,width:128,height:128,pivot:[64,108],alphaBounds:bbox,alphaMin:0,alphaMax:255,edgeAlpha,status:'candidate'});
  }
  fs.writeFileSync(path.join(__dirname,'stumps-generations.json'),JSON.stringify(rows,null,2)+'\n');
  fs.writeFileSync(path.join(__dirname,'stumps-metrics.json'),JSON.stringify(measurements,null,2)+'\n');
  const composite=[];
  rows.forEach((row,i)=>{
    const col=i%4, r=Math.floor(i/4);
    composite.push({input:path.join(base,row.final_path),left:col*190+31,top:r*190+40});
    composite.push({input:path.join(base,row.final_path),left:col*190+31,top:r*190+430});
  });
  const svg=Buffer.from(`<svg width="760" height="800"><rect width="760" height="400" fill="#eadfc8"/><rect y="400" width="760" height="400" fill="#26342c"/>${rows.map((r,i)=>`<text x="${i%4*190+8}" y="${Math.floor(i/4)*190+25}" font-size="11" fill="#332c24">${r.id.replace('stump_','')}</text><text x="${i%4*190+8}" y="${Math.floor(i/4)*190+425}" font-size="11" fill="#eee7d4">${r.id.replace('stump_','')}</text>`).join('')}</svg>`);
  await sharp(svg).composite(composite).png().toFile(path.join(base,'proofs/stumps-actual-size.png'));
  await sharp(path.join(base,'proofs/stumps-actual-size.png')).jpeg({quality:88}).toFile(path.join(base,'proofs/stumps-actual-size.jpg'));
  console.log(JSON.stringify({count:rows.length,measurements},null,2));
})();
