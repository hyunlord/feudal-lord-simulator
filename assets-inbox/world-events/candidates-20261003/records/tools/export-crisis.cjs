const fs=require('fs');
const crypto=require('crypto');
const sharp=require('/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp');
const base='/Users/rexxa/fls-astra-worldevents-output';
const inputs=JSON.parse(fs.readFileSync(base+'/provenance/crisis-generation-inputs.json'));
const specs={
 'plague-bodycart':{id:'plague-cart',height:535,pivotMaster:[805,865],people:2,rule:'Open road beside closed households; no building overlap; path points lower-left to upper-right.'},
 'plague-closure':{id:'plague-marker-brazier',height:925,pivotMaster:[800,851],people:0,worldWidth:16,rule:'Beside doorway on bare ground, never pasted onto wall; keep exit passable.'},
 'flood-sandbags':{id:'sandbags',height:420,pivotMaster:[724,775],people:2,rule:'Dry side of flooded field or riverside; bank spans flood edge; no repeated sack tiling.'},
 'revolt-gathering':{id:'revolt',height:420,pivotMaster:[724,805],people:8,rule:'Open manor forecourt or market approach; keep whole group intact and outside buildings.'}
};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
const assets=[];
for(const input of inputs){const spec=specs[input.id]; const scale=60/spec.height;const w=Math.round(1448*scale),h=Math.round(1086*scale);const left=Math.floor((320-w)/2),top=Math.floor((240-h)/2);
 for(const season of ['summer','winter']){
  const source=input[season].source,master='masters/crisis/'+spec.id+'-'+season+'.png',file='assets/new/'+spec.id+'-'+season+'.png';fs.copyFileSync(source,base+'/'+master);
  const resized=await sharp(source).resize(w,h,{kernel:'lanczos3'}).toBuffer();await sharp({create:{width:320,height:240,channels:4,background:'#00000000'}}).composite([{input:resized,left,top}]).png({compressionLevel:9}).toFile(base+'/'+file);
  const {data,info}=await sharp(base+'/'+file).raw().toBuffer({resolveWithObject:true});let transparent=0,partial=0,minX=320,minY=240,maxX=-1,maxY=-1;for(let y=0;y<240;y++)for(let x=0;x<320;x++){const a=data[(y*320+x)*4+3];if(a===0)transparent++;else{if(a<255)partial++;if(a>8){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}}
  assets.push({id:spec.id,season,file,master,source,prompt:input[season].prompt,tool:'image_gen.imagegen',reference:season==='summer'?'references/EXISTING-WORLD-ART.jpg':spec.id+'-summer master',sha256:hash(base+'/'+file),masterSha256:hash(base+'/'+master),width:320,height:240,pivot:[Math.round(left+spec.pivotMaster[0]*scale),Math.round(top+spec.pivotMaster[1]*scale)],adultHeightPx:60,adultHeightMeasurement:spec.people?'Manual visual vertical head-to-foot estimate; source '+spec.height+' px; tolerance ±8%.':'Virtual H calibrated from freestanding sign≈0.7H; no actor present.',worldWidth:spec.worldWidth??null,people:spec.people,frames:1,kind:'static-whole-ground-group',placementRule:spec.rule,alphaBounds:[minX,minY,maxX-minX+1,maxY-minY+1],transparentPixels:transparent,partialAlphaPixels:partial,status:'candidate-uninstalled',seasonalRegistration:'Same source canvas and export transform; approximate visual pose registration, not pixel-identical silhouettes.'});
 }
}
fs.writeFileSync(base+'/provenance/crisis.json',JSON.stringify({assets,exception:'Latest user explicitly requested plague door marks. Art uses freestanding marked plank beside doorway rather than wall component; scoped exception to older art-bible mark ban. This is visual project direction, not historical attestation.',qa:'Eight masters inspected. Counts2/0/2/8 preserved. No exposed body, no gore, no beak masks. Summer/winter same1448x1086 masters and320x240 exports, same pivots. Manual scene readability remains root reviewer responsibility.'},null,2));
const comps=assets.map((a,i)=>({input:base+'/'+a.file,left:(i%4)*320,top:Math.floor(i/4)*240}));await sharp({create:{width:1280,height:480,channels:3,background:'#d6c9ac'}}).composite(comps).jpeg({quality:90}).toFile(base+'/proofs/crisis-assets-contact.jpg');
console.log(JSON.stringify(assets.map(a=>({id:a.id,season:a.season,file:a.file,pivot:a.pivot,adultHeightPx:a.adultHeightPx,alphaBounds:a.alphaBounds})),null,2));
})();
