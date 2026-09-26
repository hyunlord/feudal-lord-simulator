import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';
import fs from 'node:fs/promises';
import{svg,label}from'/tmp/astra-wave12-work-20260926/build.mjs';
const W='/tmp/astra-wave17-work-20260926',D=W+'/delivery',R9='/tmp/astra-wave9-work-20260925/astra-wave9-reference-files';
await fs.mkdir(D+'/proofs',{recursive:true});await fs.mkdir(D+'/reference',{recursive:true});
for(const [source,name]of[[R9+'/house_l1-v2.png','house_l1-v2.png'],['/tmp/astra-wave12-work-20260926/delivery/assets/bld/quay-v1.png','quay-v1.png'],[R9+'/ridge_growing_a-v1.png','ridge_growing_a-v1.png']])await fs.copyFile(source,D+'/reference/'+name);
const bg=svg(1100,740,`<rect width="1100" height="740" fill="#959b7a"/><path d="M230 740L1100 305V740Z" fill="#748e93"/><path d="M230 740L1100 305" stroke="#b9b19a" stroke-width="14"/><path d="M110 500L700 205M210 595L800 300" stroke="#b3a78b" stroke-width="45"/>`);
const titles=['01  WARNING: beacon lit','02  RAID: quay cargo burning','03  DISTANT FIRE: smoke column','04  AFTERMATH: trampled field and departure'];
const desc=['Large flame signal above unchanged tower','Fire overlay shares quay canvas and origin','Frame 2 of 4 shown; no gore or enlarged figures','Damage remains in the world after the raiders leave'];
let panels=[],text='';
for(let stage=0;stage<4;stage++){
let cps=[{input:D+'/reference/house_l1-v2.png',left:250,top:245},{input:D+'/reference/house_l1-v2.png',left:380,top:180},{input:D+'/reference/house_l1-v2.png',left:510,top:275},{input:D+'/assets/bld/royal_warehouse-v1.png',left:650,top:90},{input:D+'/assets/bld/beacon_lit-v1.png',left:350,top:350},{input:D+'/reference/quay-v1.png',left:710,top:402}];
let growth=await sharp(D+'/reference/ridge_growing_a-v1.png').extract({left:0,top:0,width:128,height:64}).png().toBuffer();for(let i=0;i<3;i++)cps.push({input:stage===3?D+'/assets/decal/trampled_field-v1.png':growth,left:90+i*65,top:505+i*30});
if(stage>=1)cps.push({input:D+'/assets/event/raid_burning_quay-v1.png',left:710,top:402});
if(stage>=2){let sm=await sharp(D+'/assets/event/raid_smoke_column_sheet-v1.png').extract({left:256,top:0,width:128,height:192}).png().toBuffer();cps.push({input:sm,left:800,top:248});}
if(stage===1||stage===2){for(let i=0;i<2;i++){let r=await sharp(D+'/assets/wk/wk_raider-v1.png').extract({left:74*3,top:0,width:74,height:74}).png().toBuffer();cps.push({input:r,left:675-i*70,top:410+i*35});}}
if(stage===3){let adult=await sharp(D+'/assets/wk/wk_refugee_family-v1.png').extract({left:74*2,top:0,width:74,height:74}).png().toBuffer(),bundle=await sharp(D+'/assets/prop/refugee_bundle_sheet-v1.png').extract({left:74*2,top:0,width:74,height:74}).png().toBuffer(),child=await sharp(D+'/assets/prop/refugee_child_sheet-v1.png').extract({left:74*2,top:0,width:74,height:74}).png().toBuffer();cps.push({input:adult,left:210,top:422},{input:bundle,left:210,top:422},{input:child,left:230,top:422});}
let scene=await sharp(bg).composite(cps).png().toBuffer();let small=await sharp(scene).resize(550,370).png().toBuffer();let x=30+stage%2*610,y=105+Math.floor(stage/2)*450;panels.push({input:small,left:x,top:y});text+=label(x,y-13,titles[stage],19)+label(x,y+395,desc[stage],13);
}
const head=label(30,33,'WAVE 17 / COASTAL VILLAGE RAID RECONSTRUCTION',25)+label(30,60,'Candidate proof | all sprites displayed at game zoom 1.0 = source x0.5 | identical layout across four stages',15);panels.push({input:svg(1250,1050,head+text+label(30,1020,'Scene background is a neutral assembly guide. Buildings, workers and effects are actual delivered or supplied PNGs.',14)),left:0,top:0});await sharp({create:{width:1250,height:1050,channels:4,background:'#e9e3d5'}}).composite(panels).png().toFile(D+'/proofs/02_coastal_raid.png');
