const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
let sharp;try{sharp=require('sharp');}catch{sharp=require(process.env.MAPKIT_SHARP||'/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp');}
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const kinds=['open_field','coastal_port','chalk_downs','forest_edge','fen_drainage'];
async function main(){
 const records=[],thumbs={};
 assert.equal(fs.readdirSync(path.join(root,'maps')).filter(n=>n.endsWith('.jpg')).length,20);
 assert.equal(fs.readdirSync(path.join(root,'slots')).filter(n=>n.endsWith('.json')).length,20);
 for(const kind of kinds)for(let n=1;n<=4;n++){
  const id=`${kind}-0${n}`,image=`maps/${id}.jpg`,m=read(`slots/${id}.json`),im=await sharp(path.join(root,image)).metadata();
  assert.equal(im.width,1600);assert.equal(im.height,1000);assert.equal(m.mapId,id);assert.equal(m.image,image);assert.equal(m.width,1600);assert.equal(m.height,1000);
  assert(m.slots.length>=20&&m.slots.length<=30);assert.equal(new Set(m.slots.map(s=>s.id)).size,m.slots.length);
  const landmarks=new Set(m.landmarks.map(l=>l.id));let minDistance=Infinity;
  for(const s of m.slots){
   assert(Number.isInteger(s.x)&&Number.isInteger(s.y));const {width:w,height:h}=s.clearance;assert(w>=60&&h>=45,`${id}/${s.id} undersized`);
   assert(s.x-w/2>=0&&s.x+w/2<=1600&&s.y-h>=0&&s.y<=1000);
   assert(s.allowedKinds.length>0&&s.allowedKinds.every(k=>['manor','village','market','abbey'].includes(k)));
   assert(s.landmarkRefs.every(ref=>landmarks.has(ref)));
  }
  for(let i=0;i<m.slots.length;i++)for(let j=i+1;j<m.slots.length;j++){
   const a=m.slots[i],b=m.slots[j];minDistance=Math.min(minDistance,Math.hypot(a.x-b.x,a.y-b.y));
   const overlap=Math.min(a.x+a.clearance.width/2,b.x+b.clearance.width/2)>Math.max(a.x-a.clearance.width/2,b.x-b.clearance.width/2)&&Math.min(a.y,b.y)>Math.max(a.y-a.clearance.height,b.y-b.clearance.height);
   assert(!overlap,`${id}/${a.id}/${b.id} overlapping footprints`);
  }
  assert(minDistance>=90,`${id} spacing ${minDistance}`);
  for(const l of m.landmarks)assert(l.x>=0&&l.x<1600&&l.y>=0&&l.y<1000);
  thumbs[id]=await sharp(path.join(root,image)).resize(160,100).removeAlpha().raw().toBuffer();
  records.push({id,image,sha256:hash(image),slots:m.slots.length,slotJsonSha256:hash(`slots/${id}.json`),landmarks:m.landmarks.length,minAnchorDistancePx:minDistance,minimumClearance:[Math.min(...m.slots.map(s=>s.clearance.width)),Math.min(...m.slots.map(s=>s.clearance.height))]});
 }
 assert.equal(new Set(records.map(m=>m.sha256)).size,20);
 const differences=[];for(const k of kinds)for(let a=1;a<=4;a++)for(let b=a+1;b<=4;b++){
  const x=thumbs[`${k}-0${a}`],y=thumbs[`${k}-0${b}`];let sum=0;for(let i=0;i<x.length;i++)sum+=Math.abs(x[i]-y[i]);differences.push({a:`${k}-0${a}`,b:`${k}-0${b}`,thumbnailMeanAbsoluteChannelDifference:sum/x.length,interpretation:'Supporting pixel difference only; geographic distinction judged visually.'});
 }
 const overlays=read('overlays/manifest.json');assert.equal(overlays.length,6);for(const a of overlays)assert.equal(hash(a.path),a.sha256);
 const demo=read('proofs/neighbor-18.json'),source=read('references/neighbor-world.json'),slots=read(`slots/${demo.mapId}.json`).slots;
 assert.equal(demo.placements.length,18);assert.equal(new Set(demo.placements.map(p=>p.slotId)).size,18);
 for(const p of demo.placements){const s=slots.find(s=>s.id===p.slotId),o=source.placements.find(o=>o.houseId===p.houseId);assert(s&&o);assert.equal(p.x,s.x);assert.equal(p.y,s.y);assert.equal(p.estateId,o.estateId);assert.equal(p.kind,o.sprite);assert(s.allowedKinds.includes(p.kind));}
 assert.equal(hash(demo.image),demo.imageSha256);assert.equal(hash(`maps/${demo.mapId}.jpg`),demo.baseMapSha256);
 const result={status:'PASS',mapCount:20,slotCount:records.reduce((sum,r)=>sum+r.slots,0),range:[Math.min(...records.map(r=>r.slots)),Math.max(...records.map(r=>r.slots))],overlaysByteIdentical:6,neighborEstates:18,footprintBoundsAndPairwiseNonOverlap:true,records,differences,limitations:['Visual dry-land annotation is not a pixel collision mask.','No engine/pathfinding/hydrology validation.','Different file bytes do not alone prove different geographic composition.']};
 fs.writeFileSync(path.join(root,'provenance/VALIDATION.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,maps:20,slots:result.slotCount,range:result.range,overlays:6,neighbor:18}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
