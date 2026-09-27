const fs=require('fs'),path=require('path');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const base=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(base,f)));
(async()=>{const props=read('records/metadata-life-props.json'),birds=read('records/metadata-life-birds.json');
const ground=read('records/metadata-life-ground.json');
const lookup=(id)=>[...props,...birds,...ground].find(x=>x.id===id||x.id.endsWith('/'+id)||x.file.endsWith('/'+id+'.png'));
const screenshot=await loadImage(path.join(base,'references/현재_평소화면.jpg'));
const scene=createCanvas(1280,800),c=scene.getContext('2d');c.drawImage(screenshot,0,0);const before=c.getImageData(0,0,1280,800).data;
const mask=createCanvas(1280,800),m=mask.getContext('2d');const placements=[];
async function place(id,x,y,count=0){const a=lookup(id);if(!a)throw Error('Missing '+id);const im=await loadImage(path.join(base,a.file)),w=a.frameLayout?.cellWidth||a.width,h=a.frameLayout?.cellHeight||a.height,p=Array.isArray(a.pivot)?a.pivot:[a.pivot.x,a.pivot.y],s=a.displayScale;for(const ctx of[c,m])ctx.drawImage(im,0,0,w,h,x-p[0]*s,y-p[1]*s,w*s,h*s);placements.push({id,file:a.file,anchor:[x,y],frame:0,scale:s,pivot:p,animalCount:count});}
await place('clothesline_a',571,410);await place('clothesline_b',684,410);await place('child_hoop',598,398);await place('child_ball',603,402);await place('child_wooden_sword',609,400);await place('doorstep_chair',630,443);await place('doorstep_barrel',718,410);await place('well_bucket',644,408);
await place('chicken_flock_a',610,456,2);await place('cat_idle_a',624,411,1);await place('village_dog_sleep',700,420,1);await place('crow_flight_sheet',738,361,1);await place('pigeon_perched_a',632,419,1);
const cow=await loadImage(path.join(base,'references/cattle_pair-v1.png'));for(const ctx of[c,m])ctx.drawImage(cow,499,458,128*.24,96*.24);placements.push({id:'reference_cattle_pair',file:'references/cattle_pair-v1.png',topLeft:[499,458],scale:.24,animalCount:2});
const after=c.getImageData(0,0,1280,800).data,ma=m.getImageData(0,0,1280,800).data;let changed=0,outside=0;for(let i=0;i<after.length;i+=4){const differs=after[i]!==before[i]||after[i+1]!==before[i+1]||after[i+2]!==before[i+2]||after[i+3]!==before[i+3];if(differs){changed++;if(ma[i+3]===0)outside++;}}
if(outside)throw Error('Screenshot pixels outside masks changed '+outside);
fs.writeFileSync(path.join(base,'records/life-scene-composite.png'),scene.toBuffer('image/png'));
const proof=createCanvas(1280,1220),p=proof.getContext('2d');p.fillStyle='#e1d8be';p.fillRect(0,0,1280,1220);p.fillStyle='#30271d';p.font='bold 19px sans-serif';p.fillText('Offline candidate composite · 8 animals · original normal screenshot',20,27);p.drawImage(scene,0,40);
p.font='17px sans-serif';p.fillText('World crop 1.0 (320 × 180)',20,872);p.fillText('Same crop 0.6 (192 × 108)',370,872);p.drawImage(scene,480,310,320,180,20,890,320,180);p.drawImage(scene,480,310,320,180,370,890,192,108);
p.fillText('Native asset samples — enlarged for inspection, NOT world scale',610,872);let q=0;for(const id of ['child_hoop','clothesline_a','doorstep_chair','well_bucket']){const a=lookup(id),im=await loadImage(path.join(base,a.file));p.drawImage(im,610+q*155,900,a.width,a.height);q++;}
p.font='16px sans-serif';p.fillText('Cattle torso: 31.30 px × 0.24 = 7.512 screen px. Animal ratios preserved; no visibility inflation.',20,1121);p.fillText('At zoom 0.6, small animal species and toy details are not reliably identifiable. Clothesline silhouette remains visible.',20,1151);p.fillText('Candidate only. No game installation or runtime rendering claim. UI pixels and all pixels outside overlays unchanged.',20,1181);
fs.mkdirSync(path.join(base,'proofs'),{recursive:true});fs.writeFileSync(path.join(base,'proofs/02-life.png'),proof.toBuffer('image/png'));
fs.writeFileSync(path.join(base,'records/life-proof-qa.json'),JSON.stringify({source:'references/현재_평소화면.jpg',method:'Offline source-over composition, no repaint. Main image source pixel exact outside overlay alpha.',animalCount:placements.reduce((s,x)=>s+x.animalCount,0),placements,sourcePixelsChanged:changed,changedOutsideOverlayAlpha:outside,crop:{source:[480,310,320,180],scales:[1,.6]},verdict:'candidate_with_visibility_limit',limitations:['At accurate cattle scale, small species and toy details are not identifiable at zoom0.6. Native-size inspection inset is explicitly not world scale.','One fixed screenshot composite, not installed runtime, occlusion or animation verification.']},null,2));})();
