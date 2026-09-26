const fs=require('fs');const path=require('path');const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
async function run(){
const records=[];for(const name of ['metadata-herds.json','metadata-large-animals.json','metadata-small-animals.json','metadata-workers.json','metadata-carts.json']) {const f=path.join(root,'records',name);records.push(...JSON.parse(fs.readFileSync(f)));}
const images=new Map();for(const r of records)images.set(r.file,await loadImage(path.join(root,r.file)));
const find=(part)=>{const r=records.find(r=>r.file.endsWith('/'+part+'.png'));if(!r)throw Error('Missing '+part);return r;};
const canvas=createCanvas(1440,1130),c=canvas.getContext('2d');c.fillStyle='#e9e4d5';c.fillRect(0,0,1440,1130);c.fillStyle='#34372d';c.font='bold 27px sans-serif';c.fillText('WAVE 13 · MARKET-DAY ROAD',50,45);c.font='17px sans-serif';c.fillText('Offline candidate composition · actual source scales 0.5 / 0.3 · NE travel · no game installation',50,76);
const placed=[];
function sprite(id,x,y,ox,oy,s){const r=find(id);const img=images.get(r.file);const [w,h]=r.cell;const p=r.pivot||[w/2,h-4];placed.push({id,file:r.file,ground:[x,y],pivot:p,scale:s,sourceCell:[0,0]});c.drawImage(img,0,0,w,h,ox+(x-p[0])*s,oy+(y-p[1])*s,w*s,h*s);}
function pair(animal,layer,x,y,ox,oy,s){sprite(animal,x,y,ox,oy,s);sprite(layer,x,y,ox,oy,s);}
function scene(ox,oy,s,label){c.font='bold 20px sans-serif';c.fillStyle='#33362c';c.fillText(label,ox,oy-18);c.fillStyle='#969b78';c.fillRect(ox,oy,1800*s,1050*s);c.save();c.beginPath();c.rect(ox,oy,1800*s,1050*s);c.clip();c.strokeStyle='#b8a98a';c.lineWidth=240*s;c.lineCap='round';c.beginPath();c.moveTo(ox-60*s,oy+1090*s);c.lineTo(ox+1860*s,oy+130*s);c.stroke();
const group=[
 ['horse_draught-v1','packsaddle_sacks-v1',220,960],['horse_draught-v1','packsaddle_wool-v1',340,900],['horse_draught-v1','packsaddle_cloth-v1',460,840],
];for(const [a,b,x,y]of group)pair(a,b,x,y,ox,oy,s);
sprite('wk_packhorse_leader-v1',565,802,ox,oy,s);sprite('cattle_drove-v1',775,712,ox,oy,s);sprite('wk_drover_m-v1',915,630,ox,oy,s);sprite('goose_flock_a-v1',1070,545,ox,oy,s);sprite('wk_goosegirl_f-v1',1170,500,ox,oy,s);sprite('pig_cluster-v1',1302,443,ox,oy,s);sprite('wk_swineherd_m-v1',1415,385,ox,oy,s);pair('horse_riding-v1','saddle_rider_merchant-v1',1610,291,ox,oy,s);
c.restore();}
scene(50,120,.5,'ZOOM 1.0 · source ×0.5');scene(50,745,.3,'ZOOM 0.6 · source ×0.3');
c.fillStyle='#34372d';c.font='bold 19px sans-serif';c.fillText('LAYER ORDER',1000,145);c.font='17px sans-serif';['Pack train: sacks / wool / cloth','Cattle drove + drover','Goose flock + goosegirl','Pig cluster + swineherd','Riding merchant','', 'Source cells are not enlarged.', 'Separate animal, load and human', 'layers share local ground anchors.', '', 'No gameplay, pathfinding or', 'animation runtime is represented.'].forEach((t,i)=>c.fillText(t,1000,179+i*27));
c.font='16px sans-serif';c.fillText('Scale controls perception: at 0.6, animal species are clearer than fine clothing or individual cargo contents.',50,1104);
fs.writeFileSync(path.join(root,'proofs/03-market-road-zoom.png'),canvas.toBuffer('image/png'));
fs.writeFileSync(path.join(root,'records/herds-market-proof.json'),JSON.stringify({kind:'offline candidate composition, not gameplay',canvas:[1440,1130],sourceScales:[0.5,0.3],placements:placed,sourceHashes:Object.fromEntries([...new Set(placed.map(p=>p.file))].map(f=>[f,require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]))},null,2));
}
run().catch(e=>{console.error(e);process.exit(1)});
