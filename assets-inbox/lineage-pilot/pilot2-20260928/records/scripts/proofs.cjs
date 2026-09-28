'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createCanvas, loadImage} = require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const base = path.resolve(__dirname, '..');
const seed = 20260929;
const stages = ['baby', 'child', 'young', 'mature'];
const identities = [
  {id:'L1_203', lane:'gentry'}, {id:'L1_204', lane:'gentry'},
  {id:'L2_201', lane:'brothers'}, {id:'L2_202', lane:'brothers'},
  {id:'L2_203', lane:'sisters'}, {id:'L2_204', lane:'sisters'},
];
const images = new Map();
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rel = (id, stage) => `assets/${identities.find(entry=>entry.id===id).lane}/${id}_${stage}.png`;
const writeJSON = (file, value) => fs.writeFileSync(path.join(base,file), `${JSON.stringify(value,null,2)}\n`);
function random(initial) {let state=initial>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function canvas(width,height) {const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');ctx.fillStyle='#e8e6e0';ctx.fillRect(0,0,width,height);return {canvas,ctx};}
function text(ctx,value,x,y,size=20) {ctx.fillStyle='#292929';ctx.font=`${size}px sans-serif`;ctx.fillText(value,x,y);}
function portrait(ctx,id,stage,x,y,size=256) {ctx.drawImage(images.get(`${id}_${stage}`),x,y,size,size);}
function save(canvas,file) {fs.writeFileSync(path.join(base,file),canvas.toBuffer('image/png'));}
function verifyFrozen() {const file=path.join(base,'records/blind-frozen.json');if(!fs.existsSync(file))return;const frozen=JSON.parse(fs.readFileSync(file,'utf8'));for(const entry of frozen.inputs)if(hash(path.join(base,entry.file))!==entry.sha256)throw Error(`Frozen input changed: ${entry.file}`);}
function blind() {
  const pairs=[];
  for(let index=0;index<identities.length;index+=2)for(const stage of ['child','young'])pairs.push({relation:'different',left:{id:identities[index].id,stage},right:{id:identities[index+1].id,stage}});
  for(const identity of identities)pairs.push({relation:'same',left:{id:identity.id,stage:'child'},right:{id:identity.id,stage:'young'}});
  const rng=random(seed);
  for(let index=pairs.length-1;index>0;index--){const other=Math.floor(rng()*(index+1));[pairs[index],pairs[other]]=[pairs[other],pairs[index]];}
  pairs.forEach((pair,index)=>{if(rng()<0.5)[pair.left,pair.right]=[pair.right,pair.left];pair.number=index+1;});
  const {canvas:board,ctx}=canvas(1672,1232);
  pairs.forEach((pair,index)=>{const x=24+(index%3)*552,y=24+Math.floor(index/3)*302;text(ctx,String(pair.number),x+252,y+20,22);portrait(ctx,pair.left.id,pair.left.stage,x,y+30);portrait(ctx,pair.right.id,pair.right.stage,x+264,y+30);});
  save(board,'proofs/01-same-person-blind.png');
  fs.mkdirSync('/tmp/lineage-pilot2-blind',{recursive:true});
  fs.copyFileSync(path.join(base,'proofs/01-same-person-blind.png'),'/tmp/lineage-pilot2-blind/board.png');
  writeJSON('records/blind-key.json',{seed,algorithm:'Mulberry32, Fisher-Yates ordering, independent random orientation after ordering',rule:'Six sibling pairs (three identities pairs at child and young) and six within-identity child-young pairs. Labels, metadata and answer key are not shown to the judge.',pairs});
  const inputs=identities.flatMap(identity=>stages.map(stage=>({file:rel(identity.id,stage),sha256:hash(path.join(base,rel(identity.id,stage)))})));
  writeJSON('records/blind-frozen.json',{status:'Frozen before independent judgment',seed,board:'proofs/01-same-person-blind.png',boardSHA256:hash(path.join(base,'proofs/01-same-person-blind.png')),inputs});
}
function ages() {
  const {canvas:board,ctx}=canvas(1216,2870);
  text(ctx,'Pilot 2 | Same identity, four life stages | 256 px + actual 96 px',24,36,25);
  identities.forEach((identity,index)=>{const y=72+index*462;text(ctx,identity.id,24,y+23,24);stages.forEach((stage,column)=>{const x=24+column*296;portrait(ctx,identity.id,stage,x,y+37);portrait(ctx,identity.id,stage,x+80,y+307,96);text(ctx,stage,x,y+432,21);});});
  save(board,'proofs/02-age-chains.png');
}
async function comparison() {
  const {canvas:board,ctx}=canvas(670,1990);
  text(ctx,'Young stage | original pilot / pilot 2',24,38,26);
  text(ctx,'Before',24,76,22);text(ctx,'After',354,76,22);
  for(const [index,identity] of identities.entries()) {const y=105+index*310;const oldFile=path.join(base,`references/before-${identity.id}_young.png`);ctx.drawImage(await loadImage(oldFile),24,y,256,256);portrait(ctx,identity.id,'young',354,y);text(ctx,identity.id,24,y+282,20);}
  save(board,'proofs/03-before-after.png');
}
(async()=>{
  fs.mkdirSync(path.join(base,'proofs'),{recursive:true});
  const missing=[];
  for(const identity of identities)for(const stage of stages){const file=path.join(base,rel(identity.id,stage));if(!fs.existsSync(file)){missing.push(rel(identity.id,stage));continue;}const image=await loadImage(file);if(image.width!==256||image.height!==256)throw Error(`Wrong dimensions: ${file}`);images.set(`${identity.id}_${stage}`,image);}
  if(missing.length)throw Error(`Waiting for ${missing.length} of 24 inputs:\n${missing.join('\n')}`);
  verifyFrozen();blind();ages();await comparison();
  const files=['01-same-person-blind.png','02-age-chains.png','03-before-after.png'];
  const proofs=[];for(const file of files){const image=await loadImage(path.join(base,'proofs',file));proofs.push({file:`proofs/${file}`,width:image.width,height:image.height,sha256:hash(path.join(base,'proofs',file))});}
  writeJSON('records/proof-layout.json',{status:'ready for independent judgment',proofs,seed,inputCount:24,blindPairs:12,blindDifferentPairs:6,blindSamePairs:6,blindPortraitSize:256,blindAnnotations:'Pair numbers only. Identical backgrounds, spacing and portrait dimensions.',agePortraitSizes:[256,96],beforeAfterPortraitSize:256,processing:'Only uniform canvas compositing and downsampling for 96 px evidence. No portrait edits, individual masks or facial retouching.',judgment:'No self-judgment or score in this generator. Independent judge coordinated by root.'});
  console.log(JSON.stringify({status:'PASS',inputs:images.size,proofs,neutralBoard:'/tmp/lineage-pilot2-blind/board.png'}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
