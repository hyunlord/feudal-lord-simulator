const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require('/tmp/astra-wave39-work-20260930/node_modules/sharp');
const root=path.resolve(__dirname,'..');
const project='/Users/rexxa/orca/workspaces/feudal-lord-simulator/krill/public/assets';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const records=[];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const text=(x,y,s,size=15)=>`<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" fill="#e8dfca">${esc(s)}</text>`;
function metric(id){for(const f of ['stumps-metrics.json','regrowth-metrics.json','abandoned-metrics.json']) {if(!fs.existsSync(path.join(__dirname,f)))continue;const a=JSON.parse(fs.readFileSync(path.join(__dirname,f)));const r=a.find(x=>x.id===id);if(r)return r;}throw Error('Missing metrics '+id);}
async function asset(id,x,y){const r=metric(id), file=path.join(root,r.file||r.path||`assets/abandoned/${id}.png`);records.push({id,path:file,sha256:sha(file),pivot:r.pivot,proofPosition:[x,y]});return {input:file,left:Math.round(x-r.pivot[0]),top:Math.round(y-r.pivot[1])};}
async function ground(season,x,y){const file=path.join(project,season==='summer'?'terrain/grass.png':'wave15/terrain/grass_winter_fill-v1.png');const mask=Buffer.from('<svg width="128" height="64"><path d="M64 0L128 32L64 64L0 32Z" fill="white"/></svg>');const b=await sharp(file).resize(128,64).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).png().toBuffer();records.push({role:'project grass comparison underlay',path:file,sha256:sha(file),proofOnly:true});return {input:b,left:x-64,top:y-32};}
async function mature(season,x,y){const file=path.join(project,season==='summer'?'foliage/tree_oak_large.png':'wave15/foliage/tree_oak_large_winter_snow-v1.png');const b=await sharp(file).trim().resize({height:176}).png().toBuffer();const m=await sharp(b).metadata();records.push({role:'mature reference, Bible minimum5H with H35.2 productionpx; comparison only, not runtime scale',path:file,sha256:sha(file),proofResize:[m.width,176]});return {input:b,left:Math.round(x-m.width/2),top:y-176};}
async function save(name,w,h,labels,layers){const bg=Buffer.from(`<svg width="${w}" height="${h}"><rect width="100%" height="100%" fill="#26352d"/>${labels}</svg>`);const buf=await sharp(bg).composite(layers).png().toBuffer();await sharp(buf).png().toFile(path.join(root,'proofs',name+'-native.png'));await sharp(buf).jpeg({quality:90}).toFile(path.join(root,'proofs',name+'-native.jpg'));await sharp(buf).resize(w*2,h*2,{kernel:'nearest'}).jpeg({quality:91}).toFile(path.join(root,'proofs',name+'-2x.jpg'));}
(async()=>{
  let layers=[], labels=text(22,28,'한 필지의 변화 · 1349 → 1352 → 1360 → 1375',20)+text(22,52,'요청 연도는 미술 비교 연출이며 엔진 임계년도가 아닙니다. 동일 1칸 / 반전 없음.',13);
  const years=['1349','1352','1360','1375'];
  const names=['버려진 밭이랑 · 무너진 울타리','풀 무성','덤불 · 가시나무','덤불 속 어린나무'];
  for(const [ri,season] of ['summer','winter'].entries())for(let i=0;i<4;i++){
    const x=160+i*300,y=260+ri*230;layers.push(await ground(season,x,y));
    labels+=text(x-125,y-158,`${years[i]} · ${names[i]}`,15);
    if(i===0){layers.push(await asset('abandoned_overgrown_furrows_'+season,x,y));layers.push(await asset('abandoned_collapsed_fence_'+season,x,y));}
    else layers.push(await asset('abandoned_'+['','grass','bramble','saplings'][i]+'_'+season,x,y));
    labels+=text(x-60,y+43,season==='summer'?'여름':'겨울',13);
  }
  labels+=text(22,582,'원본 크기 합성. 접지·필지 중심 고정. 엔진 현재 단계: 첫해 풀 / 2년 덤불 / 3년 어린나무.',13);
  await save('01-abandonment-timeline',1220,610,labels,layers);
  layers=[];labels=text(22,28,'벌목 자리의 재생 · 그루터기 → 묘목 → 어린나무 → 어린숲 → 성숙 참나무',20)+text(22,52,'미술 단계 비교. 엔진 연령 임계값 및 실제 게임 줌을 재현한 화면이 아닙니다.',13);
  const ids=['stump_oak_large_fresh','sapling_1to3','sapling_4to8','young_wood_a',null];
  const stageNames=['갓 벤 그루터기','묘목 1–3년','어린나무 4–8년','어린 숲 덩어리','기존 성숙 참나무 참고'];
  for(const [ri,season] of ['summer','winter'].entries())for(let i=0;i<5;i++){
    const x=150+i*300,y=300+ri*270;layers.push(await ground(season,x,y));
    labels+=text(x-115,y-207,stageNames[i],15);
    layers.push(ids[i]?await asset(ids[i]+'_'+season,x,y):await mature(season,x,y));
    labels+=text(x-55,y+43,season==='summer'?'여름':'겨울',13);
  }
  labels+=text(22,690,'앞 네 단계: 납품 PNG 실제 크기. 성숙 참나무: 기존 원본을 바이블 최소 5H 높이로 비교 배치.',13)+text(22,712,'H=35.2 제작px, 1칸=128×64. 2× 판은 비교 확대이며 납품 아트 원본이 아닙니다.',13);
  await save('02-forest-recovery',1500,740,labels,layers);
  fs.writeFileSync(path.join(__dirname,'stage-proofs-sources.json'),JSON.stringify({note:'Offline art comparison, not engine-year thresholds or runtime validation',sources:records},null,2)+'\n');
  console.log('Two seasonal stage proof sets written.');
})();
