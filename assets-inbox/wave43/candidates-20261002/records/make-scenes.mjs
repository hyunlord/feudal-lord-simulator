import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';

const root = import.meta.dirname;
const groups = ['ground','trees_broadleaf','trees_other','orchard','props'];
const rows = [];
for (const group of groups) {
  const m = JSON.parse(await fs.readFile(path.join(root,group,'manifest.json')));
  for (const r of Array.isArray(m) ? m : m.assets) rows.push({...r,group,pivot:Array.isArray(r.pivot)?r.pivot:[r.pivot.x,r.pivot.y]});
}
const W=640,H=450;
const txt = (w,h,s,size=16) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eee9db"/><text x="10" y="${size+7}" font-family="sans-serif" font-size="${size}" fill="#302d25">${s.replaceAll('&','&amp;').replaceAll('<','&lt;')}</text></svg>`);
const seasonal = (r,season) => season==='spring' ? path.join(root,r.group,r.file) : r[`${season}_reference`] ? path.join(root,r.group,r[`${season}_reference`]) : null;
const ground = rows.filter(r=>r.group==='ground');
const placements=[];
async function tile(p,w,h) {
  const m=await sharp(p).metadata();
  const tw=Math.max(1,Math.round(m.width*.5)),th=Math.max(1,Math.round(m.height*.5));
  const b=await sharp(p).resize(tw,th).flatten({background:'#737957'}).png().toBuffer();
  const canvas=await sharp({create:{width:Math.ceil(w/tw)*tw,height:Math.ceil(h/th)*th,channels:3,background:'#737957'}}).composite(Array.from({length:Math.ceil(w/tw)*Math.ceil(h/th)},(_,i)=>({input:b,left:(i%Math.ceil(w/tw))*tw,top:Math.floor(i/Math.ceil(w/tw))*th}))).png().toBuffer();
  return sharp(canvas).extract({left:0,top:0,width:w,height:h}).png().toBuffer();
}
async function scene(season) {
  const base=ground.find(r=>r.id.startsWith('riverside'));
  const comps=[{input:await tile(seasonal(base,season),W,H),left:0,top:0}];
  const plots=[['coastal',0,0,180,190],['chalk',390,0,250,190],['woodland',0,230,300,220],['fen',420,230,220,220]];
  for(const [name,x,y,w,h] of plots){const r=ground.find(a=>a.id.startsWith(name));comps.push({input:await tile(seasonal(r,season),w,h),left:x,top:y});}
  async function place(r,x,y,scale) {
    const p=seasonal(r,season);
    if(!p) return;
    const meta=await sharp(p).metadata();
    const width=Math.max(1,Math.round(meta.width*scale)),height=Math.max(1,Math.round(meta.height*scale));
    const px=r.pivot[0]/r.width*meta.width,py=r.pivot[1]/r.height*meta.height;
    const left=Math.round(x-px*scale),top=Math.round(y-py*scale);
    if(left<0||top<0||left+width>W||top+height>H) throw new Error(`Scene bounds: ${r.id} ${season}`);
    comps.push({input:await sharp(p).resize(width,height).png().toBuffer(),left,top});
    if(season==='spring') placements.push({id:r.id,anchor:[x,y],scale,width,height,summer:r.summer_reference??null,winter:r.winter_reference??null});
  }
  const treePositions=[[60,135],[140,175],[220,145],[405,145],[490,185],[570,135]];
  const trees=rows.filter(r=>r.group.startsWith('trees'));
  for(let i=0;i<trees.length;i++) await place(trees[i],...treePositions[i],trees[i].renderScale??trees[i].worldRenderScale??64/trees[i].height);
  const orchards=rows.filter(r=>r.group==='orchard');
  for(let i=0;i<orchards.length;i++) await place(orchards[i],55+i*75,315,43/256);
  const fields=ground.filter(r=>r.id.startsWith('ridge'));
  for(let i=0;i<fields.length;i++) await place(fields[i],330,250+i*32,.18);
  const props=rows.filter(r=>r.group==='props');
  const positions=[['ewe_lamb_a',235,200,.32],['ewe_lamb_b',315,210,.32],['swollen_stream',85,390,.5],['hawthorn',230,415,.34],['nest',390,180,.28],['laundry',365,390,.35]];
  for(const [prefix,x,y,s] of positions){const r=props.find(a=>a.id.startsWith(prefix));if(!r)throw new Error(`Missing scene prop ${prefix}`);await place(r,x,y,r.suggested_world_width ? r.suggested_world_width/r.width : s);}
  return sharp({create:{width:W,height:H,channels:3,background:'#737957'}}).composite(comps).png().toBuffer();
}
await fs.mkdir(path.join(root,'proofs'),{recursive:true});
const scenes=[];
for(const season of ['winter','spring','summer']){const b=await scene(season);scenes.push(b);await fs.writeFile(path.join(root,'proofs',`same-scene-${season}.png`),b);}
for(const zoom of [1,.6]){
  const w=Math.round(W*zoom),h=Math.round(H*zoom),header=38,footer=65;
  const comps=[];
  for(let i=0;i<3;i++){
    comps.push({input:txt(w,header,['WINTER / reference','SPRING / Wave43 candidate','SUMMER / reference'][i]),left:i*w,top:0});
    comps.push({input:await sharp(scenes[i]).resize(w,h).png().toBuffer(),left:i*w,top:header});
  }
  comps.push({input:txt(w*3,footer,`OFFLINE fixed scene | zoom ${zoom.toFixed(1)} | same positions and scales | spring-only props absent in other seasons`,zoom===1?16:12),left:0,top:header+h});
  await sharp({create:{width:w*3,height:header+h+footer,channels:3,background:'#eee9db'}}).composite(comps).jpeg({quality:92}).toFile(path.join(root,'proofs',`same-scene-z${zoom.toFixed(1)}.jpg`));
}
await fs.writeFile(path.join(root,'records/scene-layout.json'),JSON.stringify({kind:'offline-composite-not-runtime',scene:[W,H],zoom:[1,.6],groundPatternScale:.5,plots:'fixed rectangular material study regions, not engine terrain masks',placements,cherry:'summer/winter geometry proxy; no existing cherry seasonal pair',fields:'winter fallow proxy, not identical crop state',props:'spring-only new decorations omitted when corresponding seasonal asset absent'},null,2)+'\n');
