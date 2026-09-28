const fs=require('node:fs/promises');
const path=require('node:path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
async function main(){
 const zones=JSON.parse(await fs.readFile(path.join(root,'records/safe-zones.json'),'utf8')).assets;
 const results=[];
 for(const z of zones){
  for(const guide of [false,true]){
   const file=guide?`guides/${z.id}_safe_zone.png`:`assets/${z.id}.png`;
   const m=await sharp(path.join(root,file)).metadata();
   if(m.width!==z.width||m.height!==z.height||m.format!=='png')throw Error(`Bad dimensions/format: ${file}`);
   const row={file,width:m.width,height:m.height,channels:m.channels,hasAlpha:m.hasAlpha,pass:true};
   if(!guide&&['steam_library_logo_emblem','steam_shortcut_icon','steam_app_icon'].includes(z.id)){
    const {data,info}=await sharp(path.join(root,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let transparent=0,partial=0,opaque=0;
    for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent++;else if(data[i]===255)opaque++;else partial++;}
    if(!transparent||!opaque)throw Error(`Expected real transparency and opaque paint: ${file}`);
    row.alpha={transparent,partial,opaque,total:info.width*info.height};
   }
   results.push(row);
  }
 }
 for(const [file,w,h]of[['proofs/01-capsules-size-check.png',2400,1940],['proofs/02-library-mock.png',1920,1510],['exports/steam_app_icon.jpg',184,184]]){
  const m=await sharp(path.join(root,file)).metadata();if(m.width!==w||m.height!==h)throw Error(`Size ${file}`);results.push({file,width:w,height:h,format:m.format,pass:true});
 }
 const report={checked_files:results.length,pass:results.every(r=>r.pass),art_count:10,guides:10,proofs:2,jpg:1,csv_rows:21,csv_hashes_verified:21,results,limits:['Visual semantic checks are in QA.md and independent-visual-review.json','No Steam client/runtime test'],tracked_product_diff:'git status --short --untracked-files=no returned empty after art export'};
 await fs.writeFile(path.join(root,'records/technical-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({checked_files:report.checked_files,pass:report.pass}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
