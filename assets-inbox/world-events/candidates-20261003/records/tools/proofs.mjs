import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=async p=>JSON.parse(await fs.readFile(path.join(root,p),'utf8'));
const rows=[];
for(const name of ['ceremony','crisis','response']){const j=await read(`provenance/${name}.json`);rows.push(...(Array.isArray(j)?j:j.assets));}
const reused=(await read('provenance/reused-manifest.json')).assets;
const output=path.join(root,'proofs');await fs.mkdir(output,{recursive:true});
const names={wedding:'혼인',funeral:'장례',baptism:'세례',market:'장날',fair:'정기시',famine:'기근 구휼',plague:'흑사병',fire:'화재',flood:'홍수',levy:'징집',revolt:'반란',pilgrimage:'순례',royal_envoy:'국왕 사신',judgment:'판결 집행'};
const placements={wedding:[850,625],funeral:[250,470],baptism:[850,625],pilgrimage:[116,529],famine:[850,625],market:[918,712],fair:[260,830],plague:[235,488],fire:[268,534],flood:[379,869],levy:[60,430],revolt:[1040,588],royal_envoy:[240,490],judgment:[270,465]};
const manifest=[];
for(const event of Object.keys(names)) for(const season of ['summer','winter']) for(const zoom of [1,.6]){
 const suffix=zoom===1?'1.0':'0.6',capture=`church-${season}-z${suffix}`;
 const background=path.join(root,`references/${capture}.png`);
 const overlays=[],used=[];const origin=placements[event];
 const pos=(dx,dy)=>[Math.round(800+(origin[0]+dx-800)*zoom),Math.round(500+(origin[1]+dy-500)*zoom)];
 async function put(file,scale,pivot,dx=0,dy=0,extract=null){
  let buf=await fs.readFile(path.join(root,file));if(extract)buf=await sharp(buf).extract(extract).toBuffer();
  const meta=await sharp(buf).metadata();const w=Math.max(1,Math.round(meta.width*scale)),h=Math.max(1,Math.round(meta.height*scale));
  const [x,y]=pos(dx,dy);const left=Math.round(x-pivot[0]*w/meta.width),top=Math.round(y-pivot[1]*h/meta.height);
  const input=await sharp(buf).resize(w,h).png().toBuffer();overlays.push({input,left,top});used.push({file,left,top,width:w,height:h,pivot,extract});
 }
 async function group(id,dx=0,dy=0){const a=rows.find(r=>(r.file||r.output||'').endsWith(`${id}-${season}.png`));if(!a)throw new Error(`Missing ${id}-${season}`);const pivot=Array.isArray(a.pivot)?a.pivot:[a.pivot.x,a.pivot.y];await put(a.file||a.output,17.6*Math.max(zoom,.65)/a.adultHeightPx,pivot,dx,dy);}
 async function prop(name,width,dx=0,dy=0,pivot=null,extract=null){const a=reused.find(r=>path.basename(r.file)===name);const fw=extract?.width??a.width,fh=extract?.height??a.height;await put(a.file,width*zoom/fw,pivot||[fw/2,fh*.85],dx,dy,extract);}
 async function actor(name,dx,dy,{bow=false}={}){
  const a=reused.find(r=>path.basename(r.file)===name);const frame=a.perFrameAnchors.find(f=>f.direction==='SE'&&f.gaitFrame===0);
  let buf=await sharp(path.join(root,a.file)).extract({left:74,top:0,width:74,height:74}).toBuffer();
  if(bow){const b=await sharp(path.join(root,'assets/reused/held_longbow_se-v1.png')).resize(21,21).toBuffer();buf=await sharp(buf).composite([{input:b,left:35,top:24}]).png().toBuffer();}
  const temp=`proofs/.actor-${name}`;await fs.writeFile(path.join(root,temp),buf);
  await put(temp,17.6*Math.max(zoom,.65)/frame.figureHeight,[frame.foot.x,frame.foot.y],dx,dy);used.at(-1).file=a.file;used.at(-1).extract={left:74,top:0,width:74,height:74};await fs.unlink(path.join(root,temp));
 }
 if(['wedding','baptism','pilgrimage','fair','revolt'].includes(event))await group(event);
 if(event==='funeral'){
  await actor('wk_priest_m_01-v1.png',-33,-17);
  for(const [x,y] of [[-12,-8],[12,4],[-12,4],[8,16]])await actor('wk_funeral_bearers-v1.png',x,y);
  await prop('bier_shroud_ne-v1.png',42,-2,-3,[32,16]);
  for(const [x,y] of [[31,13],[40,20],[49,27]])await actor('wk_priest_m_01-v1.png',x,y);
 }
 if(event==='pilgrimage'){await actor('wk_priest_m_01-v1.png',14,-23);await actor('wk_priest_m_01-v1.png',23,-32);}
 if(event==='market'){
  // The live background already has a complete market. Add buyers and animals beside it, not a second stall on a wall.
  await prop('cattle_pair-v1.png',30,32,-8);await prop('crowd_manor_gate-v1.png',58,-8,0,[96,106]);
 }
 if(event==='famine'){
  await group('relief-table',0,0);await prop('hungry_queue-v1.png',42,15,10,[30,10],{left:60,top:0,width:40,height:38});
  await prop('empty_stall-v1.png',30,50,25);
 }
 if(event==='plague'){
  await group('plague-cart',0,0);await group('plague-marker-brazier',40,-10);
  await prop('empty_stall-v1.png',38,-45,-5);
 }
 if(event==='fire'){
  await group('bucket-brigade',0,0);
  await put('assets/new/fire-flicker-all.png',.72*zoom,[32,88],72,-45,{left:0,top:0,width:64,height:96});
  await prop('black_smoke_column_sheet-v1.png',40,72,-60,[48,186],{left:0,top:0,width:96,height:192});
 }
 if(event==='flood'){
  const layer=`references/flood-layer-${season}-z${suffix}.png`;const input=await fs.readFile(path.join(root,layer));
  overlays.push({input,left:0,top:0});
  const raw=await sharp(input).ensureAlpha().raw().toBuffer();let l=1600,t=1000,r=0,b=0;
  for(let y=0;y<1000;y++)for(let x=0;x<1600;x++)if(raw[(y*1600+x)*4+3]>1){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
  used.push({file:layer,left:l,top:t,width:r-l+1,height:b-t+1,compositionOrigin:[0,0],rule:'actual engine affine clipped field renderer'});
  await group('sandbags',48,12);
 }
 if(event==='levy'){
  await group('expedition-wagon',28,18);
  for(let k=0;k<6;k++)await actor('wk_levy_archer-v1.png',-28+(k%3)*13,-15+Math.floor(k/3)*15,{bow:true});
 }
 if(event==='royal_envoy'){
  await actor('wk_royal_messenger-v1.png',0,0);await actor('wk_priest_m_01-v1.png',14,7);
  await actor('wk_levy_archer-v1.png',-16,8,{bow:true});await actor('wk_levy_archer-v1.png',0,16,{bow:true});
  await prop('scroll_royal_ne-v1.png',9,2,-7,[16,16]);
 }
 if(event==='judgment'){await group('judgment-bailiff',0,-12);await prop('crowd_manor_gate-v1.png',70,-25,28,[96,106]);}
 const id=`${event}-${season}-z${suffix}`;
 await sharp(background).jpeg({quality:88}).toFile(path.join(output,`${capture}-before.jpg`));
 await sharp(background).composite(overlays).jpeg({quality:88}).toFile(path.join(output,`${id}-after.jpg`));
 const bounds={left:Math.max(0,Math.min(...used.map(a=>a.left))-35),top:Math.max(0,Math.min(...used.map(a=>a.top))-35)};
 bounds.width=Math.min(1600-bounds.left,Math.max(...used.map(a=>a.left+a.width))-bounds.left+35);bounds.height=Math.min(1000-bounds.top,Math.max(...used.map(a=>a.top+a.height))-bounds.top+35);
 await sharp(path.join(output,`${id}-after.jpg`)).extract(bounds).png().toFile(path.join(output,`${id}-detail.png`));
 manifest.push({id,event,season,zoom,capture,after:`proofs/${id}-after.jpg`,before:`proofs/${capture}-before.jpg`,detail:`proofs/${id}-detail.png`,detailBounds:bounds,overlays:used,adultTarget:17.6*Math.max(zoom,.65),scaleRule:'Bible H17.6 with current renderer floor .65; current runtime adult is16. No oversized proof sprites.'});
}
await fs.writeFile(path.join(output,'placements.json'),JSON.stringify(manifest,null,2));
console.log(`Rendered ${manifest.length} pairs plus native pixel detail crops`);
