const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const R=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const load=async p=>(await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
(async()=>{
 const contracts=JSON.parse(fs.readFileSync(R+'/records/source-contract.json')).assets,rows=[];
 fs.mkdirSync(R+'/native/before-final-contact',{recursive:true});
 for(const c of contracts){
  const src=await load(R+'/'+c.reference),mask=await load(R+'/'+c.contact_mask),n=c.width*c.height;
  for(const v of ['c','d','e']){
   const stem=`house_pair_l${c.level}_${c.direction}_${v}`,basePath=R+'/assets/'+stem+'-v1.png';
   const b=await load(basePath);if(b.info.width!==c.width||b.info.height!==c.height)throw Error('canvas '+stem);
   const backup=R+'/native/before-final-contact/'+path.basename(basePath);if(!fs.existsSync(backup))fs.copyFileSync(basePath,backup);
   let changed=0,protectedPixels=0;
   for(let i=0;i<n;i++)if(mask.data[i*4+3]>0){protectedPixels++;for(let k=0;k<4;k++){if(b.data[i*4+k]!==src.data[i*4+k])changed++;b.data[i*4+k]=src.data[i*4+k];}}
   await sharp(b.data,{raw:{width:c.width,height:c.height,channels:4}}).png({compressionLevel:9}).toFile(basePath);
   let mismatch=0;for(let i=0;i<n;i++)if(mask.data[i*4+3]>0)for(let k=0;k<4;k++)mismatch+=b.data[i*4+k]!==src.data[i*4+k];
   rows.push({file:path.basename(basePath),family:c.family,variant:v,state:'base',width:c.width,height:c.height,pivot:c.pivot,crop:c.normalized_crop,protectedPixels,channelsRestored:changed,contactMismatch:mismatch,sha256:sha(fs.readFileSync(basePath))});
   for(const state of ['weathered','fresh','snow','boarded']){
    const p=R+'/assets/'+stem+'_'+state+'-v1.png',o=await load(p);
    if(o.info.width!==c.width||o.info.height!==c.height)throw Error('overlay canvas '+p);
    const bak=R+'/native/before-final-contact/'+path.basename(p);if(!fs.existsSync(bak))fs.copyFileSync(p,bak);
    let clipped=0,visible=0;for(let i=0;i<n;i++){if(mask.data[i*4+3]>0||b.data[i*4+3]===0){if(o.data[i*4+3])clipped++;o.data.fill(0,i*4,i*4+4);}if(o.data[i*4+3])visible++;}
    if(!visible)throw Error('empty overlay '+p);
    await sharp(o.data,{raw:{width:c.width,height:c.height,channels:4}}).png({compressionLevel:9}).toFile(p);
    rows.push({file:path.basename(p),family:c.family,variant:v,state,width:c.width,height:c.height,pivot:c.pivot,crop:c.normalized_crop,clippedPixels:clipped,visiblePixels:visible,contactMismatch:0,outsideBase:0,sha256:sha(fs.readFileSync(p))});
   }
  }
 }
 fs.writeFileSync(R+'/records/final-contract-qa.json',JSON.stringify({method:'Source-contact mask restoration and alpha-only clipping; no roof recoloring or silhouette resynthesis. Original pre-pass assets retained outside lite ZIP.',rows},null,2));console.log('Final contact contract',rows.length,'assets');
})().catch(e=>{console.error(e);process.exit(1)});
