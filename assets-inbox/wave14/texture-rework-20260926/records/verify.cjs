const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),old=path.resolve(root,'../astra-wave14-candidates-v1');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function main(){
 const baseline=JSON.parse(fs.readFileSync(root+'/records/original-asset-hashes.json'));
 for(const a of baseline)if(hash(old+'/'+a.file)!==a.sha256)throw Error('Original changed '+a.file);
 const all=['shield','merchants'].flatMap(n=>JSON.parse(fs.readFileSync(`${root}/records/metadata-${n}.json`)));
 if(all.length!==4||new Set(all.map(a=>a.file)).size!==4)throw Error('Need4uniqueassets');
 const checks=[],rows=[];
 for(const a of all){
  const p=root+'/'+a.file,m=await sharp(p).metadata();
  const size=/shield/.test(a.id)?256:128;
  if(m.width!==size||m.height!==size||m.channels!==4)throw Error('Size/RGBA '+a.file);
  const {data}=await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let alpha=0,visible=0,lo=255,hi=0,grayErrors=0;
  for(let i=0;i<data.length;i+=4){alpha+=data[i+3];if(data[i+3]){visible++;lo=Math.min(lo,data[i]);hi=Math.max(hi,data[i]);if(data[i]!==data[i+1]||data[i+1]!==data[i+2])grayErrors++;}}
  if(!visible||hi===lo)throw Error('Empty or flat texture '+a.file);
  if(!a.generationRecords?.length)throw Error('Missing generation records '+a.file);
  for(const r of a.generationRecords)if(!r.prompt||!r.rawFile||!fs.existsSync(root+'/'+r.rawFile))throw Error('Missing full prompt/raw '+a.file);
  checks.push({id:a.id,file:a.file,width:size,height:size,channels:4,meanAlpha:alpha/(size*size*255),visiblePixels:visible,grayMin:lo,grayMax:hi,nongrayPixels:grayErrors,sha256:hash(p)});
  rows.push({asset_id:a.id,status:'candidate',file:a.file,width:size,height:size,role:a.role||'material texture',sha256:hash(p),generation_records:JSON.stringify(a.generationRecords),processing:JSON.stringify(a.processing||{}),blend_contract:JSON.stringify(a.blendContract||a.channelContract||a.composition||{}),accepted:'pending user review',qa:JSON.stringify(a.qa||{})});
 }
 if(fs.readdirSync(root+'/assets',{recursive:true}).filter(f=>f.endsWith('.png')).length!==4)throw Error('Unexpectedassetcount');
 const proofs=fs.readdirSync(root+'/proofs').filter(f=>f.endsWith('.png'));
 if(proofs.length!==2)throw Error('Need2proofs');
 fs.writeFileSync(root+'/records/asset-rows.json',JSON.stringify(rows,null,2));
 fs.writeFileSync(root+'/records/technical-qa.json',JSON.stringify({originalAssetsUnchanged:baseline.length,assets:4,proofs:2,checks},null,2));
 fs.writeFileSync(root+'/IMAGE_LINKS.md','# 이미지 링크\n\n'+proofs.map(f=>`- [${f}](proofs/${f})`).join('\n')+'\n\n'+rows.map(a=>`- [${a.asset_id}](${a.file})`).join('\n')+'\n');
 console.log('PASS:4textures,2proofs,71originalassetsunchanged,provenancevalid');
}
main().catch(e=>{console.error(e);process.exitCode=1});
