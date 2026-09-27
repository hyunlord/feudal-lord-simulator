const fs=require('fs'),path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
const inputs=[...JSON.parse(fs.readFileSync(root+'/records/life-ground-inputs.json')),...JSON.parse(fs.readFileSync(root+'/records/life-ground-generated.json'))];
async function main(){
 for(const r of inputs){
  const raw='raw/life_ground/'+r.id+'-generated.png';fs.copyFileSync(r.source,root+'/'+raw);r.rawFile=raw;
  if(r.id.includes('walk_sheet'))continue;
  const flock=r.id.startsWith('chicken_flock');const w=flock?128:64,h=flock?96:64;
  let img=sharp(root+'/'+raw);if(r.id==='cat_idle_a'){const m=await img.metadata();img=sharp(await img.extract({left:Math.floor(m.width/4)*2,top:0,width:Math.floor(m.width/4),height:Math.floor(m.height/2)}).png().toBuffer());r.extraction='Generated unsolicited 4x2 sheet; select upper-row SW view column3 only.';}
  await img.trim({threshold:10}).resize(w-8,h-8,{fit:'inside'}).extend({top:4,bottom:4,left:4,right:4,background:'#00000000'}).resize(w,h,{fit:'contain',background:'#00000000'}).ensureAlpha().png().toFile(root+'/assets/life_ground/'+r.id+'.png');
 }
 fs.writeFileSync(root+'/records/life-ground-all-inputs.json',JSON.stringify(inputs,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
