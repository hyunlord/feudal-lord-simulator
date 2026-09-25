const fs = require('node:fs');
const path = require('node:path');
const {createCanvas,loadImage}=require('/tmp/astra-wave4b-work-20260925/node_modules/@napi-rs/canvas');
const root=path.resolve(__dirname,'..');
const landmarks=[
 {id:'P1',eyes:[[390,402],[522,403]],shoulderY:856,anchorX:627},
 {id:'P2',eyes:[[404,376],[525,367]],shoulderY:858,anchorX:627},
 {id:'P3',eyes:[[389,391],[525,392]],shoulderY:873,anchorX:627},
 {id:'P4',eyes:[[393,402],[524,400]],shoulderY:858,anchorX:627},
 {id:'P5',eyes:[[409,350],[526,341]],shoulderY:790,anchorX:627},
 {id:'P6',eyes:[[398,374],[522,368]],shoulderY:855,anchorX:627},
];
const labels=['P1 Merchant man','P2 Merchant woman','P3 Parish priest','P4 Labourer man','P5 Labourer woman','P6 Older widow'];
(async()=>{
 fs.mkdirSync(path.join(root,'assets/portraits'),{recursive:true});fs.mkdirSync(path.join(root,'proofs'),{recursive:true});
 const records=[];
 for(const [index,lm] of landmarks.entries()){
  const source=`sources/pt_pilot_${lm.id}-v1${lm.id==='P6'?'-alpha':''}.png`;
  const img=await loadImage(path.join(root,source));
  const eyeY=(lm.eyes[0][1]+lm.eyes[1][1])/2;
  const scale=96/(lm.shoulderY-eyeY), dx=128-lm.anchorX*scale, dy=112-eyeY*scale;
  const files=[];
  for(const size of [256,128,96]){
   const c=createCanvas(size,size),g=c.getContext('2d');const k=size/256;
   g.fillStyle='#8e8575';g.fillRect(0,0,size,size);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
   g.drawImage(img,dx*k,dy*k,img.width*scale*k,img.height*scale*k);
   const file=`assets/portraits/pt_pilot_${lm.id}-v1${size===256?'':`_${size}`}.png`;
   fs.writeFileSync(path.join(root,file),c.toBuffer('image/png')); files.push(file);
  }
  records.push({id:lm.id,source,nativeSize:[img.width,img.height],sourceLandmarks:lm,landmarkMethod:'Visual manual annotation: pupil centers and upper-arm/shoulder contour break; not anatomical tracking.',transform:{type:'uniform scale plus translation; no rotation or reflection',scale,translate:[dx,dy]},registeredEyeYs:lm.eyes.map(p=>p[1]*scale+dy),registeredShoulderY:lm.shoulderY*scale+dy,background:'#8e8575 opaque RGBA',files,derivatives:'Each output sampled directly from native source; no chained resizing.',limitations:lm.id==='P6'?'Selected imagegen alpha edit; prior opaque-background source retained separately.':''});
 }
 fs.writeFileSync(path.join(root,'records/portrait-processing.json'),JSON.stringify(records,null,2));
 const c=createCanvas(1696,520),g=c.getContext('2d');g.fillStyle='#f0e9db';g.fillRect(0,0,c.width,c.height);g.fillStyle='#332c24';g.font='bold 24px sans-serif';g.fillText('Portrait pilot | Actual pixels: 96 px and 256 px',24,36);g.font='16px sans-serif';g.fillText('Candidate only | Same left-facing pose | Native paintings registered, not mirrored or redrawn',24,62);
 for(let i=0;i<6;i++){
  const x=24+i*280;
  for(const [size,y] of [[96,92],[256,232]]){const f=`assets/portraits/pt_pilot_P${i+1}-v1${size===256?'':'_96'}.png`;g.drawImage(await loadImage(path.join(root,f)),x,y);}
  g.fillStyle='#332c24';g.font='15px sans-serif';g.fillText(labels[i],x,212);
 }
 fs.writeFileSync(path.join(root,'proofs/01-portraits.png'),c.toBuffer('image/png'));
 console.log('Processed 6 portraits, 12 direct-source derivatives, proof01.');
})();
