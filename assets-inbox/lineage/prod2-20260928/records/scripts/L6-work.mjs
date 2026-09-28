import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const base=path.resolve('output/astra-lineage-prod2-v1');
const raw='/Users/rexxa/feudal-lord-analysis/astra-raw/lineage-prod2-20260928/L6';
fs.mkdirSync(raw,{recursive:true});fs.mkdirSync(base+'/assets/L6',{recursive:true});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const defs={
101:{sex:'male',hair:'black',face:'long rectangular',cue:'hooded grey eyes',markers:['natural black bob','grey eyes','slender shoulders'],age:24,married:true},
102:{sex:'female',hair:'brown',face:'broad oval',cue:'wide-set eyes',markers:['brown hair','grey green eyes','broad shoulders'],age:24,married:true},
201:{sex:'male',hair:'dark blond (approved I103 legacy exception)',face:'long oval',cue:'hooded eyes',markers:['uneven dark blond bob','grey-green eyes','slender build','small mole beside left nostril'],age:24,father:101,mother:102,married:true},
202:{sex:'male',hair:'dark brown',face:'long oval',cue:'hooded eyes',markers:['long straight dark brown bob','blue eyes','broad muscular shoulders','small healed diagonal scar on left eyebrow'],age:21,father:101,mother:102},
203:{sex:'female',hair:'brown',face:'oval',cue:'wide-set eyes',markers:['long copper-brown loose braid','green eyes','slight narrow shoulders','three freckles high on right cheek'],age:24,father:101,mother:102,married:true},
204:{sex:'female',hair:'dark brown',face:'oval',cue:'wide-set eyes',markers:['shorter wavy dark brown shoulder-length hair','grey eyes','rounder sturdy shoulders','small mole below left outer eye'],age:21,father:101,mother:102},
205:{sex:'female',hair:'chestnut',face:'heart-shaped',cue:'arched brows',markers:['chestnut hair beneath linen veil','amber eyes','sturdy shoulders','dimple on left cheek'],age:24,married:true},
206:{sex:'male',hair:'black',face:'broad oval',cue:'straight brows',markers:['long smooth black bob','brown eyes','broad shoulders','small healed notch in right eyebrow'],age:25,married:true},
301:{sex:'male',hair:'dark blond',face:'long oval',cue:'hooded eyes',markers:['short tousled dark blond bob','amber eyes','slender shoulders','dimple on left cheek'],age:24,father:201,mother:205},
302:{sex:'female',hair:'chestnut',face:'oval',cue:'hooded eyes',markers:['long chestnut braid','grey-green eyes','sturdy shoulders','mole on right cheek'],age:21,father:201,mother:205},
303:{sex:'male',hair:'brown-black',face:'oval',cue:'wide-set eyes',markers:['long straight brown-black bob','green eyes','broad shoulders','notch in left eyebrow'],age:24,father:206,mother:203},
304:{sex:'female',hair:'brown',face:'oval',cue:'wide-set eyes',markers:['short wavy brown bob','brown eyes','slender shoulders','three freckles on right cheek'],age:21,father:206,mother:203}
};
const rows=JSON.parse(fs.readFileSync(base+'/records/pool3-source-rows.json'));
const common='ONE complete square chest-up portrait for southern England circa 1300-1450, natural realistic hand-painted muted gouache/tempera matching references, flat warm grey-brown opaque background, upper-left soft light. No text, numbers, frames, crowns, modern items, photorealism or caricature. Entire head in frame. Earl household highest nobility costume: deep crimson or deep blue fine wool with white ermine bearing sparse black tail tips, restrained gold clasp/trim. No merchant hats, no apron. Whole image painted together, not assembled layers.';
const jobs=[];const records=[];
for(const [num,d]of Object.entries(defs)){
const identity='L6_'+num;const gen=+num<200?1:+num<300?2:3;
const stages=gen===1?['young','mature','old']:(['205','206'].includes(num)?['young','mature']:gen===3?['baby','child','young']:['baby','child','young','mature']);
for(const stage of stages){
const id=identity+'_'+stage;const legacy=(num==='101'||num==='102')||(num==='201'&&['young','mature'].includes(stage));
const age=stage==='baby'?((+num%2)?1:0):stage==='child'?((+num%2)?9:6):stage==='young'?d.age:stage==='mature'?d.age+20:65;
const maritalStatus=d.married&&['young','mature','old'].includes(stage)?'married':'unmarried';
const rec={id,file:`assets/L6/${id}.png`,identity,lineage:'L6',generation:gen,stage,age,sex:d.sex,maritalStatus,clothing:stage==='baby'?'Earl fine crimson/deep blue swaddle with small ermine trim and linen infant bonnet':'Earl fine crimson/deep blue wool, ermine mantle, gold clasp; married adult women veil and wimple',fatherIdentity:d.father?'L6_'+d.father:null,motherIdentity:d.mother?'L6_'+d.mother:null,commonTraits:{hair:d.hair,faceShape:d.face,feature:d.cue},differenceMarkers:{markers:d.markers,age},status:'candidate',qa:{status:'candidate',runtime:'not installed'},generationRecords:[]};
if(legacy){const sourceID='I'+(num==='201'?'103':num)+'_'+stage;const src=base+'/references/'+sourceID+'.png';fs.copyFileSync(src,base+'/'+rec.file);const source=rows.find(r=>r.id===sourceID);rec.age=+source.age;rec.clothing=source.clothing;rec.reusedSource='references/'+sourceID+'.png';rec.sha256=hash(src);rec.processing='Exact byte copy of approved portrait-pool3 image';rec.generationRecords=[{tool:'reused approved original',prompt:source.prompt,referenceImages:[rec.reusedSource],sourceSHA256:rec.sha256,model:null,seed:null}];rec.qa.visualObservation='Approved original reused unchanged; existing old stage reused rather than redundantly redrawn';}
else{
const refs=[];if(stage!=='young')refs.push(base+`/assets/L6/${identity}_young.png`);if(d.father)refs.push(base+`/assets/L6/L6_${d.father}_young.png`,base+`/assets/L6/L6_${d.mother}_young.png`);if(!refs.length)refs.push(base+'/references/I101_young.png',base+'/references/I102_young.png');
let prompt=common+` Subject ${id}, ${d.sex}, exact age ${age}. Family common traits ONLY ${d.hair} hair, ${d.face} general face shape, ${d.cue}. Individual distinctions: ${d.markers.join('; ')}. Do not clone either parent's exact nose/chin.`;
if(stage==='young')prompt+=d.father?' Input references are actual father and mother, inherit a recognisable family resemblance while clearly a new individual.':' Input references are costume/style only; external spouse must have entirely distinct face.';
else prompt+=' FIRST reference is this exact same person as young adult: preserve eye spacing, identity landmarks and underlying facial proportions. Other references are actual father and mother for inheritance.';
if(stage==='baby')prompt+=' Render TRUE infant age 0-2: oversized round infant head, very small nose, chubby baby cheeks, tiny neck, no adult jaw, linen infant bonnet and swaddled body, not a toddler or preschool child. Hair color may peek at forehead; no adult jewellery.';
if(stage==='child')prompt+=' Render clearly 6-9-year-old primary-school child, small child neck, short midface, round cheeks, child shoulders, no adolescent jaw or breasts. Natural age-appropriate wool garment with small ermine collar. Girl hair uncovered with no veil. Boy natural bob, no adult hat.';
if(stage==='mature')prompt+=' Age the exact young person by TWENTY YEARS visibly: crow feet, forehead and nasolabial lines, slightly looser jaw/under-eye tissue, visible grey hair strands without making elderly. Maintain same identity and permanent marks.';
if(['young','mature'].includes(stage)&&d.sex==='female')prompt+=maritalStatus==='married'?' Married adult: linen veil AND wimple covering hair, no uncovered hair.':' Unmarried young woman: hair visible, no veil or wimple.';
rec.prompt=prompt;rec.referenceImages=refs;rec.processing='Sharp resize to256 square and ensure RGBA only, no face compositing';jobs.push({id,prompt,refs,rawFile:raw+'/'+id+'.png',final:base+'/'+rec.file});}
records.push(rec);
}}
fs.writeFileSync(base+'/records/L6.json',JSON.stringify(records,null,2));fs.writeFileSync(base+'/records/L6-jobs.json',JSON.stringify(jobs,null,2));
console.log({records:records.length,generate:jobs.length});
