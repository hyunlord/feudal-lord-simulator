const path=require('node:path'),fs=require('node:fs');
let sharp;try{sharp=require('sharp');}catch{sharp=require(process.env.MAPKIT_SHARP||'/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp');}
const root=path.resolve(__dirname,'..');
(async()=>{
 const entries=JSON.parse(fs.readFileSync(path.join(root,'overlays/manifest.json')));
 const layers=[];
 for(let i=0;i<entries.length;i++){
  const m=entries[i],x=50+(i%3)*500,y=65+Math.floor(i/3)*425;
  layers.push({input:Buffer.from(`<svg width="450" height="340"><rect width="450" height="340" rx="5" fill="#eadcb9" fill-opacity=".82"/><text x="20" y="34" font-family="serif" font-size="22" fill="#3e2e20">${m.id}</text><text x="20" y="315" font-family="serif" font-size="15" fill="#3e2e20">Original PNG / separate overlay</text></svg>`),left:x,top:y});
  layers.push({input:path.join(root,m.path),left:x+Math.round((450-m.width)/2),top:y+Math.round((340-m.height)/2)});
 }
 await sharp(path.join(root,'maps/open_field-01.jpg')).composite(layers).jpeg({quality:88}).toFile(path.join(root,'proofs/overlay-reuse.jpg'));
})();
