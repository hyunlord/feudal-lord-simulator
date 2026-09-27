const fs=require('node:fs');
const path=require('node:path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=path.resolve(__dirname,'..');
async function main(){
 const rows=JSON.parse(fs.readFileSync(path.join(base,'records/metadata-rework-ch4_b.json'),'utf8'));
 for(const row of rows){
  await sharp(path.join(base,row.generationRecords.at(-1).rawFile)).resize(row.width,row.height,{fit:'cover',position:'centre',kernel:'lanczos3'}).ensureAlpha().png().toFile(path.join(base,row.file));
  const m=await sharp(path.join(base,row.file)).metadata();
  if(m.width!==row.width||m.height!==row.height||m.channels!==4)throw new Error(row.id);
 }
 const tiles=await Promise.all(rows.map(async(row,i)=>({input:await sharp(path.join(base,row.file)).resize(320,240,{fit:'contain',background:'#d3ccc0'}).png().toBuffer(),left:i%2*320,top:Math.floor(i/2)*240})));
 await sharp({create:{width:640,height:Math.ceil(rows.length/2)*240,channels:4,background:'#d3ccc0'}}).composite(tiles).png().toFile(path.join(base,'raw/rework-ch4_b/contact.png'));
 console.log('Verified '+rows.length+' assigned rework PNGs');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
