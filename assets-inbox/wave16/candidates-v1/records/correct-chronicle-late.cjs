const fs=require('node:fs'),path=require('node:path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
async function main(){
 const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'metadata-chronicle-late.json'),'utf8'));
 const corrections=JSON.parse(fs.readFileSync(path.join(__dirname,'chronicle-late-corrections.json'),'utf8'));
 for(const row of rows){
  const correction=corrections[row.id];if(!correction)continue;
  const rawFile=`raw/chronicle-late/${row.id}-no-chimneys.png`;
  fs.copyFileSync(correction.path,path.join(root,rawFile));
  await sharp(path.join(root,rawFile)).resize(384,384,{fit:'cover',kernel:'lanczos3'}).ensureAlpha().png().toFile(path.join(root,row.file));
  if(!row.generationRecords.some(g=>g.rawFile===rawFile))row.generationRecords.push({tool:'builtin image_gen',prompt:correction.prompt,rawFile,referenceImages:[row.generationRecords[0].rawFile],model:'not supplied',seed:'not supplied'});
  row.processing.selectedRaw=rawFile;row.qa.correction='Background domestic chimneys removed by image edit; initial version preserved as raw.';
 }
 fs.writeFileSync(path.join(__dirname,'metadata-chronicle-late.json'),JSON.stringify(rows,null,2));
 const panels=await Promise.all(rows.map(async(r,i)=>({input:await sharp(path.join(root,r.file)).resize(192,192).toBuffer(),left:(i%4)*192,top:Math.floor(i/4)*192})));
 await sharp({create:{width:768,height:384,channels:4,background:'#ddd4bd'}}).composite(panels).png().toFile(path.join(__dirname,'contact-chronicle-late.png'));
}
main().catch(e=>{console.error(e);process.exit(1)});
