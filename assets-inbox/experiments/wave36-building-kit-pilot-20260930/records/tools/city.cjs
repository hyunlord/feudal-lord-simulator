const fs=require('fs'),path=require('path'),sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
async function main(){const original=path.join(root,'references/reference-0.jpg'),background=await sharp(path.join(root,'raw/context/city-cleanplate.png')).resize(1200,750).ensureAlpha().raw().toBuffer(),mask=await sharp(Buffer.from('<svg width="1200" height="750"><polygon points="632,88 720,86 844,145 839,297 800,324 688,267 637,207" fill="white"/></svg>')).ensureAlpha().raw().toBuffer();
for(let i=0;i<1200*750;i++)background[i*4+3]=mask[i*4+3];
const plate=await sharp(background,{raw:{width:1200,height:750,channels:4}}).png().toBuffer();
const inserts=[['C001',644,109,118],['C085',702,154,118],['C161',747,192,118]],layers=[{input:plate,left:0,top:0}];
for(const[id,x,y,size]of inserts)layers.push({input:await sharp(path.join(root,'renders/base',id+'.png')).resize(size,size).toBuffer(),left:x,top:y});
const after=await sharp(original).composite(layers).png().toBuffer();
await sharp(after).jpeg({quality:94}).toFile(path.join(root,'qa/city-context-after.jpg'));
await sharp({create:{width:1200,height:1500,channels:3,background:'#77806d'}}).composite([{input:original,left:0,top:0},{input:after,left:0,top:750}]).jpeg({quality:93}).toFile(path.join(root,'qa/city-before-after.jpg'));
fs.writeFileSync(path.join(root,'records/city-context.json'),JSON.stringify({status:'offline composite, not installed',input:'references/reference-0.jpg',background:'imagegen reconstructed ground limited to recorded polygon; outside retained from screenshot',polygon:[[632,88],[720,86],[844,145],[839,297],[800,324],[688,267],[637,207]],inserts,note:'L2 role inferred visually, no runtime building-level data supplied. Reconstructed ground is a controlled compositing aid, not engine output.'},null,2));}
main().catch(e=>{console.error(e);process.exit(1)});
