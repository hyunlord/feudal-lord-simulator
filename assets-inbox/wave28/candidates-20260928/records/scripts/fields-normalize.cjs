const fs = require('node:fs');
const path = require('node:path');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
(async () => {
 const record = JSON.parse(fs.readFileSync(path.join(root, 'records/fields.json')));
 for (const item of record.assets) {
  const native = 'native/fields/' + item.id + '.png';
  fs.copyFileSync(item.source_path, path.join(root,native));
  fs.writeFileSync(path.join(root,'native/fields/'+item.id+'-prompt.txt'), item.prompt+'\n');
  const meta = await sharp(path.join(root,native)).metadata();
  const width = item.size === 'small' ? 128 : 256;
  const height = width / 2;
  const target = 'assets/' + item.id + '.png';
  await sharp(path.join(root,native)).ensureAlpha().resize(width,height,{fit:'contain',background:{r:0,g:0,b:0,alpha:0},kernel:'lanczos3'}).png().toFile(path.join(root,target));
  const {data,info} = await sharp(path.join(root,target)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let transparent=0, partial=0, opaque=0;
  for(let i=3;i<data.length;i+=4) {if(data[i]===0)transparent++;else if(data[i]===255)opaque++;else partial++;}
  Object.assign(item,{native_path:native,output_path:target,file:target,width,height,pivot:{x:width/2,y:height/2},native_dimensions:[meta.width,meta.height],dimensions:[width,height],anchor:[width/2,height/2],anchor_convention:'canvas-center ground placement; same per-size anchor for all seasons',transform:{operation:'uniform Lanczos3 contain resize with transparent padding',alpha:'generated alpha preserved; no keying or art painting',source:[meta.width,meta.height],destination:[width,height]},qa:{channels:info.channels,transparent_pixels:transparent,partial_alpha_pixels:partial,opaque_pixels:opaque,visual:'pending actual-size inspection'}});
 }
 fs.writeFileSync(path.join(root,'records/fields.json'),JSON.stringify(record,null,2)+'\n');
 console.log(JSON.stringify(record.assets.map(({id,dimensions,qa})=>({id,dimensions,qa})),null,2));
})();
