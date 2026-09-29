const fs = require('node:fs');
const path = require('node:path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
async function main() {
  const jobs = JSON.parse(fs.readFileSync(path.join(root, 'native/props/jobs.json'), 'utf8'));
  const rows = [];
  const thumbs = [];
  for (const [index, job] of jobs.entries()) {
    const nativeOutput = 'native/props/' + job.id + '.png';
    const native = path.join(root, nativeOutput);
    if (!fs.existsSync(native)) fs.copyFileSync(job.source, native);
    fs.writeFileSync(path.join(root, 'native/props/' + job.id + '-prompt.txt'), job.prompt + '\n');
    const { data, info } = await sharp(native).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 0) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
    }
    if (x1 < 0) throw new Error('Empty alpha: ' + job.id);
    const resized = await sharp(native).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1})
      .resize(job.width-4, job.height-4, {fit:'inside',kernel:'lanczos3'}).toBuffer();
    const size = await sharp(resized).metadata();
    const left = Math.floor((job.width-size.width)/2), top = job.height-2-size.height;
    const file = 'assets/' + job.id + '.png';
    await sharp({create:{width:job.width,height:job.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
      .composite([{input:resized,left,top}]).png().toFile(path.join(root,file));
    const meta = await sharp(path.join(root,file)).metadata();
    const stats = await sharp(path.join(root,file)).stats();
    if (!meta.hasAlpha || meta.width !== job.width || meta.height !== job.height || stats.channels[3].min !== 0) throw new Error('Invalid sprite: '+file);
    rows.push({file,state:'prop',variant:'shared',roof:'n/a',shape:job.shape,wall:'n/a',width:job.width,height:job.height,
      pivot:{x:job.width/2,y:job.height},ref:['references/barn.png','references/farmstead.png'],
      referenceUse:'Visual style review only; no reference file submitted to imagegen',
      prompt:job.prompt,nativeOutput,source:job.source,generationTool:'builtin imagegen',model:null,seed:null,
      postprocess:{alphaBounds:{left:x0,top:y0,width:x1-x0+1,height:y1-y0+1},method:'alpha-only bounding crop, proportional Lanczos3 downsample, transparent padding',placement:{left,top}},
      alpha:{min:stats.channels[3].min,max:stats.channels[3].max},status:'candidate',alignment:'standalone bottom-center pivot; barn alignment not claimed'});
    thumbs.push({input:await sharp(path.join(root,file)).toBuffer(),left:20+index*84,top:84-job.height});
  }
  fs.writeFileSync(path.join(root,'records/props.json'),JSON.stringify(rows,null,2)+'\n');
  await sharp({create:{width:440,height:100,channels:4,background:'#8b917e'}}).composite(thumbs).png().toFile(path.join(root,'native/props/actual-size-review.png'));
  console.log(JSON.stringify(rows.map(({file,width,height,alpha})=>({file,width,height,alpha})),null,2));
}
main().catch(error=>{console.error(error);process.exit(1);});
