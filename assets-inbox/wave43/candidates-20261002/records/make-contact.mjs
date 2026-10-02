import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';
const root=import.meta.dirname;
const rows=JSON.parse(await fs.readFile(path.join(root,'records/asset-catalog.json')));
const cellW=300,cellH=205,cols=4;
const comps=[];
for(let i=0;i<rows.length;i++){
  const r=rows[i],left=(i%cols)*cellW,top=Math.floor(i/cols)*cellH;
  const input=await sharp(path.join(root,r.file)).resize(280,163,{fit:'contain',background:'#a8ac97'}).flatten({background:'#a8ac97'}).png().toBuffer();
  comps.push({input,left:left+10,top:top+28});
  comps.push({input:Buffer.from(`<svg width="300" height="28"><text x="8" y="19" font-family="sans-serif" font-size="12">${i+1}. ${r.id}</text></svg>`),left,top});
}
await sharp({create:{width:cellW*cols,height:cellH*Math.ceil(rows.length/cols),channels:3,background:'#eee9db'}}).composite(comps).jpeg({quality:92}).toFile(path.join(root,'proofs/contact-24.jpg'));
