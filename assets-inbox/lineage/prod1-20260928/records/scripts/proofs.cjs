'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const base=path.resolve(__dirname,'..');
const families=['L3','L4','L5'];
const core=['101','102','201','202','203','204','301','302','303','304'];
const seed=20261001;
const images=new Map();
const stagesFor=id=>['101','102'].includes(id)?['young','mature','old']:['205','206'].includes(id)?['young','mature']:id.startsWith('2')?['baby','child','young','mature']:['baby','child','young'];
const lineageEntries=families.flatMap(family=>[...core,'205','206'].flatMap(id=>stagesFor(id).map(stage=>({id:`${family}_${id}_${stage}`,file:`assets/${family}/${family}_${id}_${stage}.png`,identity:`${family}_${id}`,family,stage}))));
const commonEntries=[['baby',14],['toddler',12],['child',14]].flatMap(([stage,count])=>Array.from({length:count},(_,index)=>{const id=`C_${stage}_${String(index+1).padStart(2,'0')}`;return{id,file:`assets/common/${id}.png`,stage};}));
const extraEntries=['L1_203','L1_204','L2_201','L2_202','L2_203','L2_204'].map(identity=>({id:`${identity}_baby-v2`,identity,stage:'baby',file:`assets/pilot2-baby/${identity}_baby-v2.png`}));
const entries=[...lineageEntries,...commonEntries,...extraEntries];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json=(file,value)=>fs.writeFileSync(path.join(base,file),JSON.stringify(value,null,2)+'\n');
function rng(initial){let state=initial>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function shuffled(items,random){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
function canvas(width,height){const board=createCanvas(width,height),ctx=board.getContext('2d');ctx.fillStyle='#e8e6e0';ctx.fillRect(0,0,width,height);return{board,ctx};}
function text(ctx,value,x,y,size=18){ctx.fillStyle='#242424';ctx.font=`${size}px sans-serif`;ctx.fillText(value,x,y);}
function portrait(ctx,id,x,y,size=256){const image=images.get(id);if(image){ctx.drawImage(image,x,y,size,size);}else{ctx.strokeStyle="#aaa69c";ctx.strokeRect(x,y,size,size);text(ctx,"pending",x+8,y+size/2,12);}}
function save(board,file){fs.writeFileSync(path.join(base,file),board.toBuffer('image/png'));}
function line(ctx,points){ctx.beginPath();ctx.strokeStyle='#776854';ctx.lineWidth=2;points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
function card(ctx,family,id,x,y){text(ctx,`${family}_${id}`,x,y+18,18);stagesFor(id).forEach((stage,i)=>{portrait(ctx,`${family}_${id}_${stage}`,x+i*102,y+30,96);text(ctx,stage,x+i*102,y+146,14);});}
function trees(outputFile="proofs/01-family-trees.png"){
 const {board,ctx}=canvas(2568,2550);
 text(ctx,'Three lineages | 114 portraits | each portrait exactly 96 px',24,34,24);
 families.forEach((family,index)=>{
  const top=65+index*825; text(ctx,`${family} | ${['Gentry A','Merchant','Reeve'][index]}`,24,top+24,24);
  card(ctx,family,'101',970,top+42);card(ctx,family,'102',1390,top+42);
  line(ctx,[[1276,top+126],[1378,top+126],[1378,top+225],[228,top+225],[228,top+263]]);
  line(ctx,[[1378,top+225],[2340,top+225],[2340,top+263]]);
  const childOrder=['201','205','202','204','206','203'];
  childOrder.forEach((id,i)=>{const x=24+i*420;card(ctx,family,id,x,top+270);if(['201','202','203','204'].includes(id))line(ctx,[[x+204,top+225],[x+204,top+263]]);});
  const grandchildren=[['301',234],['302',654],['303',1494],['304',1914]];
  for(const [father,mother,cx,targets] of [['201','205',444,[438,858]],['206','203',2124,[1698,2118]]]){
    const left=24+childOrder.indexOf(father)*420+204,right=24+childOrder.indexOf(mother)*420+204;
    line(ctx,[[left,top+430],[left,top+457],[right,top+457],[right,top+430]]);
    text(ctx,`${family}_${father} + ${family}_${mother}`,cx-110,top+484,16);
    line(ctx,[[cx,top+492],[cx,top+527],[targets[0],top+527],[targets[0],top+563]]);
    line(ctx,[[cx,top+527],[targets[1],top+527],[targets[1],top+563]]);
  }
  grandchildren.forEach(([id,x])=>card(ctx,family,id,x,top+570));
 });
 save(board,outputFile);
}
function familyBlind(){
 const items=shuffled(families.flatMap(family=>core.map(id=>({id:`${family}_${id}_young`,identity:`${family}_${id}`,family}))),rng(seed));
 const {board,ctx}=canvas(1728,1516);
 items.forEach((item,i)=>{const x=24+(i%6)*284,y=24+Math.floor(i/6)*298;text(ctx,String(i+1),x+118,y+20,22);portrait(ctx,item.id,x,y+28);item.number=i+1;});
 save(board,'proofs/02-family-blind.png');json('records/family-key.json',{seed,algorithm:'Mulberry32 Fisher-Yates',rule:'Thirty young core portraits; number-only board. All images 256 px. Three families of ten. No external spouse or common pool.',items});
}
function identityBlind(){
 const pairs=families.flatMap(family=>[
  {relation:'different',left:`${family}_201_child`,right:`${family}_202_child`},
  {relation:'different',left:`${family}_203_young`,right:`${family}_204_young`},
  {relation:'different',left:`${family}_301_young`,right:`${family}_302_young`},
  {relation:'same',left:`${family}_101_young`,right:`${family}_101_mature`},
  {relation:'same',left:`${family}_201_child`,right:`${family}_201_young`},
  {relation:'same',left:`${family}_203_young`,right:`${family}_203_mature`}
 ]);
 const random=rng(seed+1),ordered=shuffled(pairs,random),{board,ctx}=canvas(1696,1860);
 ordered.forEach((pair,i)=>{if(random()<0.5)[pair.left,pair.right]=[pair.right,pair.left];pair.number=i+1;const x=24+(i%3)*560,y=24+Math.floor(i/3)*306;text(ctx,String(i+1),x+253,y+20,22);portrait(ctx,pair.left,x,y+30);portrait(ctx,pair.right,x+264,y+30);});
 save(board,'proofs/03-same-person-blind.png');json('records/identity-key.json',{seed:seed+1,algorithm:'Mulberry32 Fisher-Yates plus randomized left/right',rule:'18 pairs: nine siblings/different and nine cross-stage/same; six young/mature, three child/young. Pair number only, no labels. Pair selection precommitted before images final. Sex/age cues are not controlled; this is not a human psychometric study.',pairs:ordered});
}
function anonymous96(){
 const familyKey=JSON.parse(fs.readFileSync(path.join(base,'records/family-key.json'),'utf8'));
 const identityKey=JSON.parse(fs.readFileSync(path.join(base,'records/identity-key.json'),'utf8'));
 const family=canvas(688,656);
 familyKey.items.forEach((item,i)=>{const x=16+(i%6)*112,y=16+Math.floor(i/6)*128;text(family.ctx,String(item.number),x+42,y+15,14);portrait(family.ctx,item.id,x,y+22,96);});
 save(family.board,'records/proof-family-blind-96.png');
 const identity=canvas(688,808);
 identityKey.pairs.forEach((pair,i)=>{const x=16+(i%3)*224,y=16+Math.floor(i/3)*132;text(identity.ctx,String(pair.number),x+96,y+16,14);portrait(identity.ctx,pair.left,x,y+24,96);portrait(identity.ctx,pair.right,x+108,y+24,96);});
 save(identity.board,'records/proof-identity-blind-96.png');
}

function common(){const {board,ctx}=canvas(2256,1514);text(ctx,'Common baby / toddler / child pool | 40 portraits | 256 px',24,34,23);commonEntries.forEach((entry,i)=>{const x=24+(i%8)*278,y=58+Math.floor(i/8)*286;portrait(ctx,entry.id,x,y);text(ctx,entry.id,x,y+277,16);});save(board,'proofs/04-common-pool.png');}
(async()=>{
 if(process.argv[2]==='--family-only'){
  const chosen=lineageEntries.filter(e=>e.stage==='young'&&core.includes(e.identity.split('_')[1]));
  for(const entry of chosen)images.set(entry.id,await loadImage(path.join(base,entry.file)));
  familyBlind();
  json('records/family-inputs.json',{inputs:chosen.map(e=>({file:e.file,sha256:hash(path.join(base,e.file))})),proofSHA256:hash(path.join(base,'proofs/02-family-blind.png'))});
  fs.mkdirSync('/tmp/lineage-prod1-blind',{recursive:true});fs.copyFileSync(path.join(base,'proofs/02-family-blind.png'),'/tmp/lineage-prod1-blind/family.png');
  console.log('Family30 frozen separately; remaining age stages still pending');return;
 }
 if(process.argv[2]==='--preview'){
  for(const entry of entries){const file=path.join(base,entry.file);if(!fs.existsSync(file))continue;const image=await loadImage(file);if(image.width!==256||image.height!==256)throw Error(`Wrong size ${entry.file}`);images.set(entry.id,image);}
  fs.mkdirSync(path.join(base,'records/proof-work'),{recursive:true});trees('records/proof-work/partial-family-trees.png');console.log(JSON.stringify({status:'PREVIEW ONLY',loaded:images.size,total:160,file:'records/proof-work/partial-family-trees.png',frozen:false}));return;
 }
 if(process.argv[2]!=='final')throw Error('Use final only after explicit root freeze approval. No premature official boards.');
 const missing=entries.filter(entry=>!fs.existsSync(path.join(base,entry.file)));if(missing.length)throw Error(`Missing ${missing.length}/160: ${missing.map(e=>e.file).join(', ')}`);
 const frozenPath=path.join(base,'records/frozen.json');if(fs.existsSync(frozenPath)){const frozen=JSON.parse(fs.readFileSync(frozenPath,'utf8'));for(const input of frozen.inputs)if(hash(path.join(base,input.file))!==input.sha256)throw Error(`Frozen input changed: ${input.file}`);}
 for(const entry of entries){const image=await loadImage(path.join(base,entry.file));if(image.width!==256||image.height!==256)throw Error(`Wrong size ${entry.file}`);images.set(entry.id,image);}
 trees();familyBlind();identityBlind();common();anonymous96();
 const proofFiles=['01-family-trees.png','02-family-blind.png','03-same-person-blind.png','04-common-pool.png'];
 const proofs=[];for(const file of proofFiles){const image=await loadImage(path.join(base,'proofs',file));proofs.push({file:`proofs/${file}`,width:image.width,height:image.height,sha256:hash(path.join(base,'proofs',file))});}
 json('records/frozen.json',{status:'Frozen before independent judgment',seed,inputs:entries.map(entry=>({file:entry.file,sha256:hash(path.join(base,entry.file))})),proofs});
 json('records/proof-layout.json',{status:'Ready for external blind judgment; no self score',assetCount:160,pilot2BabyCorrections:6,lineageCount:114,commonCount:40,familyBlind:30,identityPairs:18,differentPairs:9,samePairs:9,youngMatureSamePairs:6,childYoungSamePairs:3,proofs,supplementalAnonymous96:['records/proof-family-blind-96.png','records/proof-identity-blind-96.png'],processing:'Unedited final portraits composited at equal size. Family tree uniformly resized to actual 96 px; blind portraits remain 256 px. No face crop or retouch.'});
 fs.mkdirSync('/tmp/lineage-prod1-blind',{recursive:true});fs.copyFileSync(path.join(base,'proofs/02-family-blind.png'),'/tmp/lineage-prod1-blind/family.png');fs.copyFileSync(path.join(base,'proofs/03-same-person-blind.png'),'/tmp/lineage-prod1-blind/identity.png');
 console.log(JSON.stringify({status:'PASS',inputs:entries.length,proofs}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
