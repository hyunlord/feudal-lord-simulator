'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {createCanvas, loadImage} = require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const base = path.resolve(__dirname, '..');
const seed = 20260928;
const crop = {x: 0.25, y: 0.08, width: 0.50, height: 0.50};
const core = ['L1','L2'].flatMap(l => ['101','102','201','202','203','204','301','302','303','304'].map(n => ({identity: `${l}_${n}`, stage: n[0] === '1' ? 'mature' : 'young', lineage: l})));
const stageLabels = {baby:'Baby 0-2',child:'Child 6-9',young:'Young 18-25',mature:'Mature 40-50',old:'Old 65-75'};
const images = new Map();
function rng(initial) {let a=initial>>>0; return () => {a+=0x6D2B79F5; let t=a; t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function shuffle(values) {const out=[...values],random=rng(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function canvas(w,h) {const c=createCanvas(w,h),ctx=c.getContext('2d');ctx.fillStyle='#eeeae0';ctx.fillRect(0,0,w,h);ctx.fillStyle='#292c2c';return {c,ctx};}
function text(ctx,s,x,y,size=20) {ctx.fillStyle='#292c2c';ctx.font=`${size}px sans-serif`;ctx.fillText(s,x,y);}
function line(ctx,points) {ctx.strokeStyle='#6f756f';ctx.lineWidth=3;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
function pic(ctx,id,stage,x,y,size=96,face=false) {const im=images.get(`${id}_${stage}`);if(!im)throw Error(`Missing ${id}_${stage}`);if(face)ctx.drawImage(im,im.width*crop.x,im.height*crop.y,im.width*crop.width,im.height*crop.height,x,y,size,size);else ctx.drawImage(im,x,y,size,size);}
function save(c,rel) {fs.writeFileSync(path.join(base,rel),c.toBuffer('image/png'));}
function card(ctx,id,stages,x,y,w=520) {ctx.fillStyle='#ddd8cb';ctx.fillRect(x-8,y-27,w,157);text(ctx,id,x,y-6,20);stages.forEach((s,i)=>{pic(ctx,id,s,x+i*126,y+8);text(ctx,stageLabels[s],x+i*126,y+123,14);});}
function blind() {const frozen=path.join(base,'records/blind-core-hashes.json');if(fs.existsSync(frozen)){const crypto=require('node:crypto');for(const r of JSON.parse(fs.readFileSync(frozen))){const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(base,r.file))).digest('hex');if(hash!==r.sha256)throw Error(`Frozen blind core changed: ${r.file}`);}}const order=shuffle(core);const key=order.map((r,i)=>({number:i+1,...r,file:`assets/lineage${r.lineage.slice(1)}/${r.identity}_${r.stage}.png`}));for(const face of [false,true]){const {c,ctx}=canvas(824,774);text(ctx,face?'Anonymous portraits - face crop':'Anonymous portraits - full',24,32,22);key.forEach((r,i)=>{const x=24+(i%5)*160,y=64+Math.floor(i/5)*176;pic(ctx,r.identity,r.stage,x,y,128,face);text(ctx,String(r.number),x+57,y+151,20);});save(c,`records/blind-${face?'face':'full'}.png`);}fs.writeFileSync(path.join(base,'records/blind-answer-key.json'),JSON.stringify({seed,algorithm:'Mulberry32 Fisher-Yates; input L1 then L2, identities 101,102,201..204,301..304',coreCount:20,founderStageException:'Four founders use mature; no founder young stages exist',faceCrop:crop,entries:key},null,2));fs.mkdirSync('/tmp/lineage-blind',{recursive:true});fs.copyFileSync(path.join(base,'records/blind-full.png'),'/tmp/lineage-blind/full.png');fs.copyFileSync(path.join(base,'records/blind-face.png'),'/tmp/lineage-blind/faces.png');}
function trees() {const {c,ctx}=canvas(2240,2380);text(ctx,'Candidate lineage pilot | actual parents and age stages',30,36,30);text(ctx,'Every portrait below is 96 x 96 px. External spouses are shown separately; cousins are not full siblings.',30,67,20);['L1','L2'].forEach((l,index)=>{const y=118+index*1110;text(ctx,`${l} / ${index===0?'Gentry family':'Merchant family'}`,30,y,27);const xs=[40,590,1140,1690];card(ctx,`${l}_101`,['mature','old'],680,y+55,260);card(ctx,`${l}_102`,['mature','old'],1250,y+55,260);line(ctx,[[948,y+113],[1242,y+113]]);line(ctx,[[1095,y+113],[1095,y+246]]);line(ctx,[[285,y+246],[1945,y+246]]);xs.forEach((x,i)=>{line(ctx,[[x+245,y+246],[x+245,y+275]]);card(ctx,`${l}_20${i+1}`,['baby','child','young','mature'],x,y+300);});
// Spouses sit beneath their actual partner, with connectors that bypass unrelated children.
card(ctx,`${l}_2S1`,['young'],390,y+530,150);text(ctx,'External spouse',385,y+690,18);line(ctx,[[285,y+430],[285,y+585],[382,y+585]]);card(ctx,`${l}_2S2`,['young'],1480,y+530,150);text(ctx,'External spouse',1475,y+690,18);line(ctx,[[1385,y+430],[1385,y+585],[1472,y+585]]);
line(ctx,[[335,y+585],[335,y+742],[810,y+742]]);line(ctx,[[220,y+742],[335,y+742]]);line(ctx,[[1430,y+585],[1430,y+742],[1910,y+742]]);line(ctx,[[1320,y+742],[1430,y+742]]);
xs.forEach((x,i)=>{line(ctx,[[x+180,y+742],[x+180,y+785]]);card(ctx,`${l}_30${i+1}`,['baby','child','young'],x,y+812,395);});text(ctx,`Parents: ${l}_201 + ${l}_2S1`,40,y+1010,21);text(ctx,`Parents: ${l}_2S2 + ${l}_203`,1140,y+1010,21);});save(c,'proofs/01-family-trees.png');}
function siblings() {const {c,ctx}=canvas(1840,1160);text(ctx,'Parents and four siblings | 256 px and actual 96 px',28,40,29);['L1','L2'].forEach((l,j)=>{const y=100+j*525;text(ctx,`${l}: parents at left; their four children at right`,28,y,24);['101','102','201','202','203','204'].forEach((n,i)=>{const id=`${l}_${n}`,s=n[0]==='1'?'mature':'young',x=28+i*303;text(ctx,id,x,y+33,20);pic(ctx,id,s,x,y+49,256);pic(ctx,id,s,x+80,y+323,96);text(ctx,stageLabels[s],x,y+455,18);});});save(c,'proofs/03-siblings.png');}
function ages() {const {c,ctx}=canvas(1030,2000);text(ctx,'Four lineage children | baby > child > young',30,42,28);['L1_201','L1_203','L2_201','L2_203'].forEach((id,j)=>{const y=90+j*470;text(ctx,id,30,y,24);['baby','child','young'].forEach((s,i)=>{const x=30+i*330;pic(ctx,id,s,x,y+18,256);pic(ctx,id,s,x+80,y+293,96);text(ctx,stageLabels[s],x,y+426,20);});});save(c,'proofs/04-age-chains.png');}
async function resultProof() {
  const crypto = require('node:crypto');
  const key = JSON.parse(fs.readFileSync(path.join(base,'records/blind-answer-key.json')));
  const results = JSON.parse(fs.readFileSync(path.join(base,'records/blind-results.json'))).results;
  const {c,ctx} = canvas(1756,1520);
  text(ctx,'Blind family grouping | independent agent experiment, not a human study',24,40,29);
  text(ctx,'Unmarked source boards above; answer key and measured results below. One attempt per board.',24,76,22);
  for (const [i,board] of ['full','face'].entries()) {
    const file = path.join(base,`records/blind-${board}.png`);
    const result = results.find(r=>r.board===board);
    const response = JSON.parse(fs.readFileSync(path.join(base,`records/blind-${board}-response.json`)));
    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if(hash!==result.boardSHA256 || hash!==response.boardSHA256) throw Error(`${board} judged source SHA mismatch`);
    const numbered = [...response.groupsA,...response.groupsB];
    if(numbered.length!==20 || new Set(numbered).size!==20 || numbered.some(n=>!key.entries.find(e=>e.number===n))) throw Error(`${board} invalid grouping`);
    const wrong=key.entries.filter(e=>(response.groupsA.includes(e.number)?result.Aassigned:(result.Aassigned==='L1'?'L2':'L1'))!==e.lineage);
    if(20-wrong.length!==result.correct || JSON.stringify(wrong.map(e=>e.number))!==JSON.stringify(result.wrong.map(e=>e.number))) throw Error(`${board} result mismatch`);
    ctx.drawImage(await loadImage(file),24+i*884,110);
    text(ctx,`${board==='full'?'Full portrait':'Clothing-reduced face crop'}: ${result.correct}/20 = ${result.accuracy*100}% | threshold ${result.threshold*100}% | ${result.pass?'PASS':'FAIL'}`,24+i*884,930,25);
    text(ctx,`Wrong: ${wrong.map(e=>`#${e.number} ${e.identity}`).join('; ')}`,24+i*884,967,21);
    text(ctx,`Judge confidence: ${response.confidence}; attempt ${response.attempt}`,24+i*884,1000,20);
  }
  text(ctx,'ANSWER KEY | L1 = gentry family; L2 = merchant family',24,1050,25);
  key.entries.forEach((e,i)=>text(ctx,`${String(e.number).padStart(2,'0')}   ${e.identity}   ${e.stage}${results[0].wrong.some(w=>w.number===e.number)?'   <- wrong in both tests':''}`,24+Math.floor(i/10)*884,1088+(i%10)*29,21));
  text(ctx,'Scoring allows A/B label exchange; both judges mapped A to L1. Each was required to form two groups of ten.',24,1410,21);
  text(ctx,'Four founders use mature portraits; the other sixteen use young portraits. No young founders were invented.',24,1444,21);
  text(ctx,'Crop is uniform for all 20. Remaining hats, veils, hair and small collars may still bias grouping.',24,1478,21);
  save(c,'proofs/02-blind-family-test.png');
  console.log('Proof02 written; judged board hashes verified; both scores independently recomputed.');
}

(async()=>{const mode=process.argv[2]||'all';if(mode==='results'){await resultProof();return;}const required=mode==='blind'?core:['L1','L2'].flatMap(l=>['101','102','201','202','203','204','301','302','303','304','2S1','2S2'].flatMap(n=>(n[0]==='1'?['mature','old']:n.includes('S')?['young']:n[0]==='2'?['baby','child','young','mature']:['baby','child','young']).map(stage=>({identity:`${l}_${n}`,lineage:l,stage}))));const missing=[];for(const r of required){const file=path.join(base,`assets/lineage${r.lineage.slice(1)}/${r.identity}_${r.stage}.png`);if(!fs.existsSync(file)){missing.push(file);continue;}images.set(`${r.identity}_${r.stage}`,await loadImage(file));}if(missing.length)throw Error(`${missing.length} required assets missing:\n${missing.join('\n')}`);blind();if(mode!=='blind'){trees();siblings();ages();if(fs.existsSync(path.join(base,'records/blind-results.json')))await resultProof();}fs.writeFileSync(path.join(base,'records/proof-layout.json'),JSON.stringify({status:mode==='blind'?'blind boards ready':'four official proofs and blind boards ready',officialProofs:['01-family-trees.png','02-blind-family-test.png','03-siblings.png','04-age-chains.png'],seed,faceCrop:crop,faceCropLimitations:'One uniform relative face-region crop for every portrait; removes most clothing and outer hair/headwear, but residual headwear or collar may remain. No identity-specific masking or retouching.',treePortraitPixels:96,siblingPortraitPixels:[256,96],agePortraitPixels:[256,96],anonymousPortraitPixels:128,ageChainIdentities:['L1_201','L1_203','L2_201','L2_203'],blindTest:'No human test claimed. Independent judge responses and scoring handled by root.'},null,2));console.log(JSON.stringify({mode,loaded:images.size,seed,neutralBoards:'/tmp/lineage-blind'}));})().catch(e=>{console.error(e.message);process.exitCode=1;});
