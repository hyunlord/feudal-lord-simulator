const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
(async()=>{
const generations=JSON.parse(fs.readFileSync(path.join(root,'records/portraits-generation.json')));
for(const id of ['concern','success']) { const raw=await loadImage(path.join(root,'sources/portraits/'+id+'-raw.png'));const c=createCanvas(192,192),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(raw,0,0,192,192);fs.writeFileSync(path.join(root,'assets/ui/advisor_steward_portrait_'+id+'.png'),c.toBuffer('image/png')); }
let order; do { order=['neutral','concern','success']; for(let i=2;i>0;i--){const j=crypto.randomInt(i+1);[order[i],order[j]]=[order[j],order[i]];} } while(order.join(',')==='neutral,concern,success');
const c=createCanvas(420,168),ctx=c.getContext('2d');ctx.fillStyle='#ddd2bd';ctx.fillRect(0,0,420,168);ctx.fillStyle='#332d25';ctx.textAlign='center';ctx.font='16px sans-serif';
for(let i=0;i<3;i++){const im=await loadImage(path.join(root,'assets/ui/advisor_steward_portrait_'+order[i]+'.png'));ctx.drawImage(im,28+i*134,20,96,96);ctx.fillText(String.fromCharCode(65+i),76+i*134,145);}
fs.writeFileSync(path.join(root,'proofs/02-portraits-shuffled.png'),c.toBuffer('image/png'));
fs.writeFileSync(path.join(root,'records/portraits-shuffle-key.json'),JSON.stringify({literalPixels:96,order:Object.fromEntries(order.map((v,i)=>[String.fromCharCode(65+i),v])),randomMethod:'crypto.randomInt Fisher-Yates; reject unchanged original order',blindJudgePending:true},null,2));
const rows=['neutral','concern','success'].map(id=>({id:'ui/advisor_steward_portrait_'+id,file:'assets/ui/advisor_steward_portrait_'+id+'.png',width:192,height:192,status:'candidate',role:'청지기 '+id,processing:id==='neutral'?'Byte-identical copy of supplied accepted neutral':'Builtin identity-preserving edit, full square downsample to 192×192, no crop or retouch',generationRecords:id==='neutral'?[{mode:'reuse',prompt:null,reference:'references/astra-ui-p0-rework-reference-files/advisor_steward_portrait_neutral.png',reason:'Explicit keep instruction'}]:[{...generations.find(g=>g.id===id),mode:'builtin image_gen edit',model:'not provided',seed:'not provided',raw:'sources/portraits/'+id+'-raw.png'}],qa:{pixelSize:'192×192',blind96px:'pending independent observer',identity:'Same man, clothing type, pose and light retained; facial expression is deliberately stronger'}}));
fs.writeFileSync(path.join(root,'records/portraits.json'),JSON.stringify(rows,null,2));
console.log('3 portraits, 96px shuffled proof, generation metadata saved.');
})();
